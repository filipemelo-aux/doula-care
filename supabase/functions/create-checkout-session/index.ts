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
    const { plan_id, billing_type } = body ?? {};

    if (!plan_id || typeof plan_id !== "string") {
      return new Response(JSON.stringify({ error: "plan_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["monthly", "yearly"].includes(billing_type)) {
      return new Response(
        JSON.stringify({ error: "billing_type deve ser 'monthly' ou 'yearly'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Get plan
    const { data: planRows, error: planError } = await supabaseAdmin.rpc("get_plan_by_id", {
      p_plan_id: plan_id,
    });

    if (planError || !planRows || planRows.length === 0) {
      return new Response(JSON.stringify({ error: "Plano não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const plan = planRows[0];

    if (plan.is_free) {
      return new Response(JSON.stringify({ error: "Plano gratuito não requer pagamento" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amount: number = billing_type === "monthly" ? plan.price_monthly : plan.price_yearly;

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: `Preço ${billing_type} não configurado para este plano` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine which gateway to use
    // For now, use "mock" gateway. When Stripe is ready, check for STRIPE_SECRET_KEY
    const gateway = "mock";

    const timestamp = Date.now();
    const orderNsu = `${userId}_${plan_id}_${timestamp}`;
    let gatewayPaymentId: string | null = null;

    if (gateway === "mock") {
      // Mock gateway: generate a fake payment ID
      gatewayPaymentId = `mock_${orderNsu}`;
      console.log("[create-checkout-session] Mock gateway - payment created:", gatewayPaymentId);
    }
    // Future: else if (gateway === "stripe") { ... }

    // Save to plan_payments
    const { error: insertError } = await supabaseAdmin.from("plan_payments").insert({
      user_id: userId,
      plan_id: plan_id,
      order_nsu: orderNsu,
      amount: amount,
      billing_type: billing_type,
      status: "pending",
      gateway: gateway,
      gateway_payment_id: gatewayPaymentId,
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar pagamento" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        payment_id: gatewayPaymentId,
        order_nsu: orderNsu,
        gateway: gateway,
        status: "pending",
        amount: amount,
        plan_name: plan.name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
