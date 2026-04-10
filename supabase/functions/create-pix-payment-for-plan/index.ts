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
    // Auth
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

    // Parse & validate body
    const body = await req.json();
    const { plan_id, billing_type, phone } = body;

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

    // Service role client for admin queries
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 1. Get plan via get_plan_by_id
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

    // 2. Get user data (profile + client if exists)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("user_id", userId)
      .single();

    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("full_name, phone")
      .eq("user_id", userId)
      .maybeSingle();

    const userName = profile?.full_name || client?.full_name || "Usuário";
    const userEmail = claimsData.user.email || "";
    const userPhone = phone || client?.phone || "00000000000";

    // 3. Define amount (centavos)
    const amount: number = billing_type === "monthly" ? plan.price_monthly : plan.price_yearly;

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: `Preço ${billing_type} não configurado para este plano` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Generate order_nsu
    const timestamp = Date.now();
    const orderNsu = `${userId}_${plan_id}_${timestamp}`;

    // 5. Call InfinitePay API
    const infinitePayBody = {
      handle: "meualishop",
      redirect_url: "https://doulacare.app.br/pagamento-sucesso",
      webhook_url: "https://doulacare.app.br/webhook/infinitepay",
      order_nsu: orderNsu,
      customer: {
        name: userName,
        email: userEmail,
        phone_number: userPhone,
      },
      items: [
        {
          quantity: 1,
          price: amount,
          description: `Plano ${plan.name}`,
        },
      ],
      payment_methods: ["pix"],
    };

    console.log("InfinitePay request:", JSON.stringify(infinitePayBody));

    const ipResponse = await fetch(
      "https://api.infinitepay.io/invoices/public/checkout/links",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(infinitePayBody),
      }
    );

    const ipData = await ipResponse.json();

    if (!ipResponse.ok) {
      console.error("InfinitePay error:", JSON.stringify(ipData));
      return new Response(
        JSON.stringify({
          error: "Erro ao gerar pagamento Pix",
          details: ipData,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("InfinitePay response:", JSON.stringify(ipData));

    const qrCodeBase64 = ipData?.qr_code_base64 || ipData?.pix?.qr_code_base64 || null;
    const pixCode = ipData?.pix_code || ipData?.pix?.code || ipData?.pix?.emv || null;
    const checkoutUrl = ipData?.url || null;

    // 6. Save to plan_payments
    const { error: insertError } = await supabaseAdmin.from("plan_payments").insert({
      user_id: userId,
      plan_id: plan_id,
      order_nsu: orderNsu,
      amount: amount,
      billing_type: billing_type,
      status: "pending",
      qr_code_base64: qrCodeBase64,
      pix_code: pixCode,
      infinitepay_response: ipData,
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar pagamento" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Return
    return new Response(
      JSON.stringify({
        qr_code_base64: qrCodeBase64,
        pix_code: pixCode,
        checkout_url: checkoutUrl,
        order_nsu: orderNsu,
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
