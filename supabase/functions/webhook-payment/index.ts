import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Generic payment webhook handler.
 * Routes to the appropriate gateway handler based on the request.
 * 
 * Currently supports:
 * - Mock gateway (for testing)
 * - Stripe (placeholder for future integration)
 */
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
    const body = await req.json();
    const gateway = body?.gateway || "unknown";

    console.log(`[webhook-payment] Received webhook for gateway: ${gateway}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (gateway === "mock") {
      return await handleMockWebhook(supabase, body);
    }
    // Future: if (gateway === "stripe") { return await handleStripeWebhook(supabase, body, req); }

    console.warn(`[webhook-payment] Unknown gateway: ${gateway}`);
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

  // Find payment
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

  // Update payment status
  await supabase.from("plan_payments").update({ status: "paid" }).eq("id", payment.id);

  // Get plan details
  const { data: planData } = await supabase
    .from("platform_plan_limits")
    .select("id, plan, name")
    .eq("id", payment.plan_id)
    .single();

  // Calculate period
  const now = new Date();
  const periodEnd = new Date(now);
  if (payment.billing_type === "yearly") {
    periodEnd.setDate(periodEnd.getDate() + 365);
  } else {
    periodEnd.setDate(periodEnd.getDate() + 30);
  }

  // Cancel existing active subscriptions
  await supabase
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("user_id", payment.user_id)
    .eq("status", "active");

  // Create new subscription
  await supabase.from("subscriptions").insert({
    user_id: payment.user_id,
    plan_id: payment.plan_id,
    status: "active",
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
  });

  // Update organization plan
  if (planData) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", payment.user_id)
      .single();

    if (profile?.organization_id) {
      await supabase
        .from("organizations")
        .update({
          plan: planData.plan as "free" | "pro" | "premium",
          billing_cycle: payment.billing_type === "yearly" ? "yearly" : "monthly",
          next_billing_date: periodEnd.toISOString().split("T")[0],
        })
        .eq("id", profile.organization_id);
    }
  }

  console.log("[webhook-payment] Mock payment confirmed for user:", payment.user_id);

  return new Response(
    JSON.stringify({ ok: true, action: "payment_confirmed" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
