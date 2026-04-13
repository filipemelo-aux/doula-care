import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[webhook-payment] ${step}${d}`);
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Read raw body for both Stripe signature verification and JSON parsing
    const rawBody = await req.text();

    // Check if this is a Stripe webhook (has signature header)
    const stripeSignature = req.headers.get("stripe-signature");

    if (stripeSignature) {
      return await handleStripeWebhook(rawBody, stripeSignature);
    }

    // Fallback: legacy mock gateway
    const body = JSON.parse(rawBody);
    const gateway = body?.gateway || "unknown";
    logStep("Received webhook for gateway", { gateway });

    const supabase = getSupabaseAdmin();

    if (gateway === "mock") {
      return await handleMockWebhook(supabase, body);
    }

    return new Response(
      JSON.stringify({ error: "Unknown gateway" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ===================== STRIPE WEBHOOK =====================

async function handleStripeWebhook(rawBody: string, signature: string) {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!stripeKey || !webhookSecret) {
    logStep("ERROR: Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  // Validate Stripe signature
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (err) {
    logStep("Signature verification failed", { error: (err as Error).message });
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  logStep("Event received", { type: event.type, id: event.id });

  const supabase = getSupabaseAdmin();

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(supabase, event.data.object as Stripe.Checkout.Session);
      break;

    case "invoice.payment_succeeded":
      await handleInvoiceSucceeded(supabase, stripe, event.data.object as Stripe.Invoice);
      break;

    case "invoice.payment_failed":
      await handleInvoiceFailed(supabase, stripe, event.data.object as Stripe.Invoice);
      break;

    default:
      logStep("Unhandled event type", { type: event.type });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * 1. checkout.session.completed
 * - Extract metadata (user_id, plan_id, billing_type)
 * - Create/update subscription as active
 * - Set period based on billing_type
 * - Save stripe_customer_id and stripe_subscription_id
 */
async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session
) {
  const metadata = session.metadata || {};
  const userId = metadata.user_id;
  const planId = metadata.plan_id;
  const billingType = metadata.billing_type;

  if (!userId || !planId || !billingType) {
    logStep("ERROR: Missing metadata in checkout session", { metadata });
    return;
  }

  const stripeCustomerId = typeof session.customer === "string"
    ? session.customer
    : session.customer?.id;
  const stripeSubscriptionId = typeof session.subscription === "string"
    ? session.subscription
    : (session.subscription as any)?.id;

  logStep("checkout.session.completed", {
    userId, planId, billingType, stripeCustomerId, stripeSubscriptionId,
  });

  const now = new Date();
  const periodEnd = new Date(now);
  if (billingType === "yearly") {
    periodEnd.setDate(periodEnd.getDate() + 365);
  } else {
    periodEnd.setDate(periodEnd.getDate() + 30);
  }

  // Cancel existing active subscriptions for this user
  await supabase
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("user_id", userId)
    .eq("status", "active");

  // Create new subscription
  const { error: subError } = await supabase.from("subscriptions").insert({
    user_id: userId,
    plan_id: planId,
    status: "active",
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    stripe_customer_id: stripeCustomerId || null,
    stripe_subscription_id: stripeSubscriptionId || null,
  });

  if (subError) {
    logStep("ERROR: Failed to create subscription", { subError });
    return;
  }

  // Update plan_payments if exists
  const sessionId = session.id;
  await supabase
    .from("plan_payments")
    .update({ status: "paid", gateway_payment_id: sessionId })
    .eq("gateway_payment_id", sessionId)
    .eq("status", "pending");

  // Update organization plan
  await updateOrgPlan(supabase, userId, planId, billingType, periodEnd);

  logStep("Subscription activated for user", { userId, planId });
}

/**
 * 2. invoice.payment_succeeded
 * - Renew subscription automatically
 * - Update current_period_end
 */
async function handleInvoiceSucceeded(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  invoice: Stripe.Invoice
) {
  const subscriptionId = typeof invoice.subscription === "string"
    ? invoice.subscription
    : (invoice.subscription as any)?.id;

  if (!subscriptionId) {
    logStep("invoice.payment_succeeded: no subscription ID, skipping");
    return;
  }

  // Fetch subscription from Stripe to get current period
  const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
  const periodEnd = new Date(stripeSub.current_period_end * 1000).toISOString();
  const periodStart = new Date(stripeSub.current_period_start * 1000).toISOString();

  logStep("invoice.payment_succeeded", { subscriptionId, periodEnd });

  // Update local subscription
  const { data: localSubs, error } = await supabase
    .from("subscriptions")
    .select("id, user_id, plan_id")
    .eq("stripe_subscription_id", subscriptionId)
    .eq("status", "active")
    .limit(1);

  if (error || !localSubs || localSubs.length === 0) {
    logStep("No local subscription found for stripe sub", { subscriptionId });
    return;
  }

  const localSub = localSubs[0];

  await supabase
    .from("subscriptions")
    .update({
      status: "active",
      current_period_start: periodStart,
      current_period_end: periodEnd,
    })
    .eq("id", localSub.id);

  // Update org next_billing_date
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("user_id", localSub.user_id)
    .single();

  if (profile?.organization_id) {
    await supabase
      .from("organizations")
      .update({ next_billing_date: periodEnd.split("T")[0] })
      .eq("id", profile.organization_id);
  }

  logStep("Subscription renewed", { userId: localSub.user_id });
}

/**
 * 3. invoice.payment_failed
 * - Mark subscription as pending
 * - Notify user via org_notifications
 */
async function handleInvoiceFailed(
  supabase: ReturnType<typeof createClient>,
  _stripe: Stripe,
  invoice: Stripe.Invoice
) {
  const subscriptionId = typeof invoice.subscription === "string"
    ? invoice.subscription
    : (invoice.subscription as any)?.id;

  if (!subscriptionId) {
    logStep("invoice.payment_failed: no subscription ID, skipping");
    return;
  }

  logStep("invoice.payment_failed", { subscriptionId });

  // Find and update local subscription
  const { data: localSubs } = await supabase
    .from("subscriptions")
    .select("id, user_id")
    .eq("stripe_subscription_id", subscriptionId)
    .in("status", ["active", "pending"])
    .limit(1);

  if (!localSubs || localSubs.length === 0) {
    logStep("No local subscription found for failed payment", { subscriptionId });
    return;
  }

  const localSub = localSubs[0];

  // Mark as pending
  await supabase
    .from("subscriptions")
    .update({ status: "pending" })
    .eq("id", localSub.id);

  // Notify user: find their organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("user_id", localSub.user_id)
    .single();

  if (profile?.organization_id) {
    await supabase.from("org_notifications").insert({
      organization_id: profile.organization_id,
      title: "Falha no pagamento da assinatura",
      message:
        "O pagamento da sua assinatura falhou. Por favor, atualize seu método de pagamento para evitar a suspensão do serviço.",
      type: "billing",
    });
  }

  logStep("Subscription marked as pending due to payment failure", { userId: localSub.user_id });
}

// ===================== HELPERS =====================

async function updateOrgPlan(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  planId: string,
  billingType: string,
  periodEnd: Date
) {
  // Get plan slug
  const { data: planData } = await supabase
    .from("platform_plan_limits")
    .select("plan")
    .eq("id", planId)
    .single();

  if (!planData) {
    logStep("Plan not found for org update", { planId });
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("user_id", userId)
    .single();

  if (profile?.organization_id) {
    await supabase
      .from("organizations")
      .update({
        plan: planData.plan as "free" | "pro" | "premium",
        billing_cycle: billingType === "yearly" ? "yearly" : "monthly",
        next_billing_date: periodEnd.toISOString().split("T")[0],
        status: "ativo" as "ativo",
      })
      .eq("id", profile.organization_id);

    logStep("Organization plan & status updated", {
      orgId: profile.organization_id,
      plan: planData.plan,
      status: "ativo",
    });
  }
}

// ===================== MOCK GATEWAY (legacy) =====================

async function handleMockWebhook(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>
) {
  const orderNsu = body?.order_nsu as string;

  if (!orderNsu) {
    return new Response(JSON.stringify({ error: "Missing order_nsu" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: payment, error: paymentError } = await supabase
    .from("plan_payments")
    .select("*")
    .eq("order_nsu", orderNsu)
    .single();

  if (paymentError || !payment) {
    return new Response(JSON.stringify({ error: "Payment not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (payment.status === "paid") {
    return new Response(JSON.stringify({ ok: true, action: "already_paid" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await supabase.from("plan_payments").update({ status: "paid" }).eq("id", payment.id);

  const { data: planData } = await supabase
    .from("platform_plan_limits")
    .select("id, plan, name")
    .eq("id", payment.plan_id)
    .single();

  const now = new Date();
  const periodEnd = new Date(now);
  if (payment.billing_type === "yearly") {
    periodEnd.setDate(periodEnd.getDate() + 365);
  } else {
    periodEnd.setDate(periodEnd.getDate() + 30);
  }

  await supabase
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("user_id", payment.user_id)
    .eq("status", "active");

  await supabase.from("subscriptions").insert({
    user_id: payment.user_id,
    plan_id: payment.plan_id,
    status: "active",
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
  });

  if (planData) {
    await updateOrgPlan(supabase, payment.user_id, payment.plan_id, payment.billing_type, periodEnd);
  }

  logStep("Mock payment confirmed", { userId: payment.user_id });

  return new Response(
    JSON.stringify({ ok: true, action: "payment_confirmed" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
