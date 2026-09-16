import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { findPlanByPriceId } from "../_shared/stripe-plans.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[check-subscription] ${step}${d}`);
};

/**
 * Lightweight polling fallback — reads Stripe as source of truth
 * and reconciles local DB if needed. Does NOT generate payments
 * or manage recurrence; that is Stripe's job via webhooks.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_LIVE_API_KEY") ?? Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe key not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.email) throw new Error("User not authenticated");

    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    // ── Read local subscription (fast path) ──
    const { data: localSub } = await supabase
      .from("subscriptions")
      .select("id, plan_id, status, current_period_start, current_period_end, stripe_subscription_id, stripe_customer_id")
      .eq("user_id", user.id)
      .in("status", ["active", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // ── Verify against Stripe (source of truth) ──
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      // If local says active but Stripe says no customer → reconcile
      if (localSub?.status === "active") {
        await supabase
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("id", localSub.id);
        logStep("Local subscription canceled (no Stripe customer)");
      }
      return jsonResponse({ subscribed: false });
    }

    const customerId = customers.data[0].id;
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      logStep("No active Stripe subscription");
      if (localSub?.status === "active") {
        await supabase
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("id", localSub.id);
        logStep("Local subscription canceled (Stripe has no active sub)");
      }
      return jsonResponse({ subscribed: false });
    }

    // ── Active Stripe subscription found — reconcile local state ──
    const stripeSub = subscriptions.data[0];
    const item = stripeSub.items.data[0] as unknown as
      { current_period_start?: number; current_period_end?: number } | undefined;
    const rawEnd = (stripeSub as unknown as { current_period_end?: number }).current_period_end
      ?? item?.current_period_end;
    const rawStart = (stripeSub as unknown as { current_period_start?: number }).current_period_start
      ?? item?.current_period_start;
    const subscriptionEnd = rawEnd ? new Date(rawEnd * 1000).toISOString() : null;
    const subscriptionStart = rawStart ? new Date(rawStart * 1000).toISOString() : null;

    // Resolve plan: Stripe price is the source of truth; local row is a fallback
    const priceId = stripeSub.items.data[0]?.price?.id;
    const mapped = findPlanByPriceId(priceId);
    let planId = mapped?.planId || localSub?.plan_id || null;
    let planSlug = mapped?.plan || "unknown";

    if (!mapped && planId) {
      const { data: planData } = await supabase
        .from("platform_plan_limits")
        .select("plan")
        .eq("id", planId)
        .single();
      if (planData) planSlug = planData.plan;
    }

    // Reconcile local subscription record (cria quando o checkout web ainda
    // não gerou registro local — ex.: webhook atrasado)
    const record = {
      status: "active",
      current_period_start: subscriptionStart,
      current_period_end: subscriptionEnd,
      stripe_customer_id: customerId,
      stripe_subscription_id: stripeSub.id,
    };

    if (localSub) {
      await supabase
        .from("subscriptions")
        .update({ ...record, plan_id: planId ?? localSub.plan_id })
        .eq("id", localSub.id);
    } else if (planId) {
      const { data: existingByStripe } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("stripe_subscription_id", stripeSub.id)
        .maybeSingle();

      if (existingByStripe?.id) {
        await supabase
          .from("subscriptions")
          .update({ ...record, plan_id: planId })
          .eq("id", existingByStripe.id);
      } else {
        await supabase.from("subscriptions").insert({
          ...record,
          user_id: user.id,
          plan_id: planId,
          platform: "web",
          product_id: priceId ?? null,
        });
      }
    }

    // Reconcile organization plan
    if (planSlug !== "unknown") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (profile?.organization_id) {
        await supabase
          .from("organizations")
          .update({
            plan: planSlug as "free" | "pro" | "premium",
            status: "ativo",
            next_billing_date: subscriptionEnd ? subscriptionEnd.split("T")[0] : null,
          })
          .eq("id", profile.organization_id);
      }
    }

    logStep("Subscription verified", { plan: planSlug, end: subscriptionEnd });

    return jsonResponse({
      subscribed: true,
      plan: planSlug,
      plan_id: planId,
      subscription_end: subscriptionEnd,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[check-subscription] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
