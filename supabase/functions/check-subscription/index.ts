import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map Stripe product IDs to internal plan slugs
const PRODUCT_TO_PLAN: Record<string, string> = {
  "prod_UKM6hbhYC9HypI": "pro",
  "prod_UKM6QipeLhe3VE": "pro",
  "prod_UKM6TAbsh0NPKM": "premium",
  "prod_UKM7UM7sJu38Nq": "premium",
};

// Map internal plan slugs to platform_plan_limits IDs
const PLAN_TO_DB_ID: Record<string, string> = {
  "pro": "a4bd9641-83cb-41bc-aae3-5028cf13e29d",
  "premium": "e84bd89e-cc54-42f6-8f9c-e9354c7058bd",
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

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData?.user?.email) throw new Error("User not authenticated");

    const user = userData.user;
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find Stripe customer
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerId = customers.data[0].id;
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subscription = subscriptions.data[0];
    const productId = subscription.items.data[0].price.product as string;
    const planSlug = PRODUCT_TO_PLAN[productId] || "unknown";
    const planDbId = PLAN_TO_DB_ID[planSlug];
    const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
    const subscriptionStart = new Date(subscription.current_period_start * 1000).toISOString();

    // Sync to local subscriptions table
    if (planDbId) {
      // Cancel any existing active subs
      await supabaseClient
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("user_id", user.id)
        .eq("status", "active");

      // Upsert current subscription
      await supabaseClient.from("subscriptions").upsert({
        user_id: user.id,
        plan_id: planDbId,
        status: "active",
        current_period_start: subscriptionStart,
        current_period_end: subscriptionEnd,
      }, { onConflict: "user_id,plan_id" }).select();

      // Also update organization plan
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (profile?.organization_id) {
        await supabaseClient
          .from("organizations")
          .update({
            plan: planSlug as "free" | "pro" | "premium",
            next_billing_date: subscriptionEnd.split("T")[0],
          })
          .eq("id", profile.organization_id);
      }
    }

    return new Response(JSON.stringify({
      subscribed: true,
      plan: planSlug,
      plan_id: planDbId,
      subscription_end: subscriptionEnd,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
