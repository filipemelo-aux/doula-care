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

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.user.id;
    const body = await req.json();
    const { order_nsu } = body;

    if (!order_nsu) {
      return new Response(JSON.stringify({ error: "order_nsu é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Find the payment
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("plan_payments")
      .select("*")
      .eq("order_nsu", order_nsu)
      .eq("user_id", userId)
      .single();

    if (paymentError || !payment) {
      return new Response(JSON.stringify({ error: "Pagamento não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already paid in our DB
    if (payment.status === "paid") {
      return new Response(
        JSON.stringify({ paid: true, status: "paid" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try InfinitePay's payment_check API
    const slug = payment.checkout_slug;
    if (slug) {
      try {
        const checkResponse = await fetch(
          "https://api.infinitepay.io/invoices/public/checkout/payment_check",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              handle: "meualishop",
              order_nsu: order_nsu,
              slug: slug,
            }),
          }
        );

        const checkData = await checkResponse.json();
        console.log("[check-payment-status] InfinitePay response:", JSON.stringify(checkData));

        if (checkData?.paid === true) {
          // Payment confirmed via InfinitePay - update our DB
          await supabaseAdmin
            .from("plan_payments")
            .update({ status: "paid" })
            .eq("id", payment.id);

          // Activate subscription (same logic as webhook)
          const { data: planData } = await supabaseAdmin
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

          // Cancel existing active subscriptions
          await supabaseAdmin
            .from("subscriptions")
            .update({ status: "canceled" })
            .eq("user_id", userId)
            .eq("status", "active");

          // Create new subscription
          await supabaseAdmin.from("subscriptions").insert({
            user_id: userId,
            plan_id: payment.plan_id,
            status: "active",
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
          });

          // Update organization plan
          if (planData) {
            const { data: profile } = await supabaseAdmin
              .from("profiles")
              .select("organization_id")
              .eq("user_id", userId)
              .single();

            if (profile?.organization_id) {
              await supabaseAdmin
                .from("organizations")
                .update({
                  plan: planData.plan as "free" | "pro" | "premium",
                  billing_cycle: payment.billing_type === "yearly" ? "yearly" : "monthly",
                  next_billing_date: periodEnd.toISOString().split("T")[0],
                })
                .eq("id", profile.organization_id);
            }
          }

          console.log("[check-payment-status] Payment confirmed and subscription activated for:", userId);

          return new Response(
            JSON.stringify({ paid: true, status: "paid" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (checkErr) {
        console.error("[check-payment-status] InfinitePay check error:", checkErr);
        // Fall through to return pending status
      }
    }

    // Also check if webhook already created subscription
    const { data: subscription } = await supabaseAdmin
      .from("subscriptions")
      .select("id, status")
      .eq("user_id", userId)
      .eq("plan_id", payment.plan_id)
      .eq("status", "active")
      .maybeSingle();

    if (subscription) {
      await supabaseAdmin
        .from("plan_payments")
        .update({ status: "paid" })
        .eq("id", payment.id);

      return new Response(
        JSON.stringify({ paid: true, status: "paid" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ paid: false, status: payment.status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-payment-status error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
