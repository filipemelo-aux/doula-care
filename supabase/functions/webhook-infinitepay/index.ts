import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    console.log("Webhook received:", JSON.stringify(body));

    const orderNsu = body?.order_nsu || body?.data?.order_nsu;
    const status = body?.status || body?.data?.status;

    if (!orderNsu) {
      console.error("Missing order_nsu in webhook payload");
      return new Response(JSON.stringify({ error: "Missing order_nsu" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (status !== "paid" && status !== "approved" && status !== "completed") {
      console.log(`Ignoring webhook with status: ${status}`);
      return new Response(JSON.stringify({ ok: true, action: "ignored" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Find payment by order_nsu
    const { data: payment, error: paymentError } = await supabase
      .from("plan_payments")
      .select("*")
      .eq("order_nsu", orderNsu)
      .single();

    if (paymentError || !payment) {
      console.error("Payment not found for order_nsu:", orderNsu, paymentError);
      return new Response(JSON.stringify({ error: "Payment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: already paid → skip
    if (payment.status === "paid") {
      console.log("Payment already paid, skipping:", orderNsu);
      return new Response(JSON.stringify({ ok: true, action: "already_paid" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Update payment status to paid
    const { error: updateError } = await supabase
      .from("plan_payments")
      .update({ status: "paid" })
      .eq("id", payment.id);

    if (updateError) {
      console.error("Error updating payment:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update payment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Fetch the plan details to get the plan slug (free/pro/premium)
    const { data: planData, error: planError } = await supabase
      .from("platform_plan_limits")
      .select("id, plan, name")
      .eq("id", payment.plan_id)
      .single();

    if (planError || !planData) {
      console.error("Plan not found for plan_id:", payment.plan_id, planError);
      return new Response(JSON.stringify({ error: "Plan not found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Calculate subscription period
    const now = new Date();
    const periodEnd = new Date(now);

    if (payment.billing_type === "yearly") {
      periodEnd.setDate(periodEnd.getDate() + 365);
    } else {
      periodEnd.setDate(periodEnd.getDate() + 30);
    }

    // 5. Cancel any existing active subscription for this user
    await supabase
      .from("subscriptions")
      .update({ status: "canceled" })
      .eq("user_id", payment.user_id)
      .eq("status", "active");

    // 6. Create new active subscription
    const { error: subError } = await supabase.from("subscriptions").insert({
      user_id: payment.user_id,
      plan_id: payment.plan_id,
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
    });

    if (subError) {
      console.error("Error creating subscription:", subError);
      return new Response(JSON.stringify({ error: "Failed to create subscription" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. Update the organization's plan to match the purchased plan
    // Find the user's organization via profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", payment.user_id)
      .single();

    if (profile?.organization_id) {
      const orgPlan = planData.plan as "free" | "pro" | "premium";
      const { error: orgError } = await supabase
        .from("organizations")
        .update({
          plan: orgPlan,
          billing_cycle: payment.billing_type === "yearly" ? "yearly" : "monthly",
          next_billing_date: periodEnd.toISOString().split("T")[0],
        })
        .eq("id", profile.organization_id);

      if (orgError) {
        console.error("Error updating organization plan:", orgError);
        // Non-fatal: subscription is active, org plan update failed
      } else {
        console.log(`Organization ${profile.organization_id} upgraded to plan: ${orgPlan}`);
      }
    }

    console.log("Payment confirmed & subscription activated for user:", payment.user_id);

    return new Response(
      JSON.stringify({ ok: true, action: "payment_confirmed", user_id: payment.user_id, plan: planData.plan }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
