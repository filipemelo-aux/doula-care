import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[check-subscription] ${step}${d}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

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

    // 1. Check local subscription first (fastest path)
    const { data: localSub } = await supabase
      .from("subscriptions")
      .select("id, plan_id, status, current_period_start, current_period_end, stripe_subscription_id, stripe_customer_id")
      .eq("user_id", user.id)
      .in("status", ["active", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 2. Verify with Stripe for accuracy
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
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

      // If we have a local active sub but Stripe says no, mark as expired
      if (localSub?.status === "active") {
        await supabase
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("id", localSub.id);
        logStep("Local subscription canceled (no Stripe sub)");
      }

      return jsonResponse({ subscribed: false });
    }

    const stripeSub = subscriptions.data[0];
    const subscriptionEnd = new Date(stripeSub.current_period_end * 1000).toISOString();
    const subscriptionStart = new Date(stripeSub.current_period_start * 1000).toISOString();

    // Determine plan from local subscription or metadata
    let planId: string | null = localSub?.plan_id || null;
    let planSlug = "unknown";

    // If no local sub linked, try to find via stripe_subscription_id
    if (!planId && localSub?.stripe_subscription_id === stripeSub.id) {
      planId = localSub.plan_id;
    }

    // Resolve plan slug from DB
    if (planId) {
      const { data: planData } = await supabase
        .from("platform_plan_limits")
        .select("plan")
        .eq("id", planId)
        .single();
      if (planData) planSlug = planData.plan;
    }

    // Sync local subscription
    if (localSub) {
      await supabase
        .from("subscriptions")
        .update({
          status: "active",
          current_period_start: subscriptionStart,
          current_period_end: subscriptionEnd,
          stripe_customer_id: customerId,
          stripe_subscription_id: stripeSub.id,
        })
        .eq("id", localSub.id);
    } else if (planId) {
      // Cancel old subs and create new
      await supabase
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("user_id", user.id)
        .eq("status", "active");

      await supabase.from("subscriptions").insert({
        user_id: user.id,
        plan_id: planId,
        status: "active",
        current_period_start: subscriptionStart,
        current_period_end: subscriptionEnd,
        stripe_customer_id: customerId,
        stripe_subscription_id: stripeSub.id,
      });
    }

    // Update organization plan
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
            next_billing_date: subscriptionEnd.split("T")[0],
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
