import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { STRIPE_PLANS, findPlanByPixPriceId, findPlanByPriceId } from "../_shared/stripe-plans.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, stripe-signature",
};

const log = (step: string, details?: unknown) =>
  console.log(`[stripe-webhook] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

const admin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

async function resolveUserId(
  supabase: ReturnType<typeof admin>,
  metadataUserId?: string | null,
  email?: string | null,
  customerId?: string | null
): Promise<string | null> {
  if (metadataUserId) return metadataUserId;

  if (customerId) {
    const { data } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.user_id) return data.user_id;
  }

  if (email) {
    const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const match = data?.users?.find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase()
    );
    if (match) return match.id;
  }

  return null;
}


async function syncSubscription(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  metadataUserId?: string | null
) {
  const supabase = admin();
  const priceId = subscription.items.data[0]?.price?.id;
  const planInfo = findPlanByPriceId(priceId);
  if (!planInfo) {
    log("Price not mapped, ignoring", { priceId });
    return;
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const customer = await stripe.customers.retrieve(customerId);
  const email = (customer as Stripe.Customer)?.email ?? null;

  const userId = await resolveUserId(
    supabase,
    metadataUserId ?? (subscription.metadata?.user_id as string | undefined),
    email,
    customerId

  );
  if (!userId) {
    log("User not resolved", { customerId, email });
    return;
  }

  const active = ["active", "trialing", "past_due"].includes(subscription.status);
  const status = subscription.status === "past_due"
    ? "billing_issue"
    : active
    ? "active"
    : "canceled";

  const periodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000).toISOString()
    : null;
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  const payload = {
    user_id: userId,
    plan_id: planInfo.planId,
    status,
    platform: "web",
    product_id: priceId,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
  };

  if (existing?.id) {
    await supabase.from("subscriptions").update(payload).eq("id", existing.id);
  } else {
    // encerra assinaturas web anteriores do mesmo usuário
    await supabase
      .from("subscriptions")
      .update({ status: "canceled" })
      .eq("user_id", userId)
      .eq("platform", "web")
      .in("status", ["active", "pending", "billing_issue"]);
    await supabase.from("subscriptions").insert(payload);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile?.organization_id) {
    await supabase
      .from("organizations")
      .update(
        status === "canceled"
          ? { plan: "free" as const }
          : {
              plan: planInfo.plan,
              status: "ativo",
              next_billing_date: periodEnd ? periodEnd.split("T")[0] : null,
            }
      )
      .eq("id", profile.organization_id);
  }

  log("Subscription synced", { userId, plan: planInfo.plan, status });
}

// Pagamento avulso por Pix: libera o plano por 30 dias (mensal) ou 365 (anual).
async function activatePixPayment(stripe: Stripe, session: Stripe.Checkout.Session) {
  const supabase = admin();

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
  const priceId = lineItems.data[0]?.price?.id;
  const planInfo =
    findPlanByPixPriceId(priceId) ??
    (session.metadata?.plan && session.metadata?.billing
      ? STRIPE_PLANS.find(
          (p) => p.plan === session.metadata!.plan && p.billing === session.metadata!.billing
        )
      : undefined);

  if (!planInfo) {
    log("Pix price not mapped, ignoring", { priceId });
    return;
  }

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const email = session.customer_details?.email ?? session.customer_email ?? null;

  const userId = await resolveUserId(
    supabase,
    session.metadata?.user_id ?? null,
    email,
    customerId
  );
  if (!userId) {
    log("Pix user not resolved", { customerId, email });
    return;
  }

  const days = planInfo.billing === "yearly" ? 365 : 30;

  // se já houver período vigente, o Pix estende a partir do fim dele
  const { data: current } = await supabase
    .from("subscriptions")
    .select("id, current_period_end")
    .eq("user_id", userId)
    .eq("platform", "web")
    .in("status", ["active", "grace_period", "billing_issue"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date();
  const base =
    current?.current_period_end && new Date(current.current_period_end) > now
      ? new Date(current.current_period_end)
      : now;
  const periodEnd = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  await supabase
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("user_id", userId)
    .eq("platform", "web")
    .in("status", ["active", "pending", "billing_issue", "grace_period"]);

  await supabase.from("subscriptions").insert({
    user_id: userId,
    plan_id: planInfo.planId,
    status: "active",
    platform: "web",
    product_id: priceId ?? planInfo.pixPriceId,
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    stripe_customer_id: customerId,
    stripe_subscription_id: null,
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile?.organization_id) {
    await supabase
      .from("organizations")
      .update({
        plan: planInfo.plan,
        status: "ativo",
        next_billing_date: periodEnd.toISOString().split("T")[0],
      })
      .eq("id", profile.organization_id);
  }

  log("Pix payment activated", { userId, plan: planInfo.plan, until: periodEnd.toISOString() });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_LIVE_API_KEY") ?? Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const webhookToken = Deno.env.get("STRIPE_WEBHOOK_TOKEN");
  if (!stripeKey) {
    return new Response("Stripe not configured", { status: 500, headers: corsHeaders });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  // 1) assinatura oficial do Stripe quando o segredo confere
  // 2) token exclusivo na URL do endpoint como alternativa
  // Em ambos os casos os dados são relidos direto da API do Stripe.
  let event: Stripe.Event | null = null;
  if (webhookSecret && signature) {
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      log("Signature check failed, trying URL token", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (!event) {
    const urlToken = new URL(req.url).searchParams.get("t");
    if (!webhookToken || urlToken !== webhookToken) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    try {
      event = JSON.parse(body) as Stripe.Event;
    } catch {
      return new Response("Invalid payload", { status: 400, headers: corsHeaders });
    }
  }

  try {
    log("Event received", { type: event.type });

    switch (event.type) {
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.completed": {
        const session = await stripe.checkout.sessions.retrieve(
          (event.data.object as Stripe.Checkout.Session).id
        );
        if (session.mode === "payment") {
          if (session.payment_status === "paid") {
            await activatePixPayment(stripe, session);
          } else {
            log("Pix pending, waiting confirmation", { sessionId: session.id });
          }
          break;
        }
        if (session.mode === "subscription" && session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(stripe, subscription, session.metadata?.user_id ?? null);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const incoming = event.data.object as Stripe.Subscription;
        const fresh = await stripe.subscriptions.retrieve(incoming.id);
        await syncSubscription(stripe, fresh);
        break;
      }

      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId =
          typeof invoice.subscription === "string" ? invoice.subscription : null;
        if (subId) {
          const subscription = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(stripe, subscription);
        }
        break;
      }
      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
