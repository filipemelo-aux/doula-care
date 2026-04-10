import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const normalizeDigits = (value: unknown) =>
  typeof value === "string" ? value.replace(/\D/g, "") : "";

const isLikelyBase64Image = (value: string | null) => {
  if (!value) return false;
  if (value.startsWith("data:image/")) return true;
  return /^[A-Za-z0-9+/=\s]+$/.test(value) && value.replace(/\s/g, "").length > 100;
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
    const { plan_id, billing_type, phone, customer: rawCustomer, address: rawAddress } = body ?? {};

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
      .select("full_name, phone, cpf, street, number, neighborhood, city, state, zip_code")
      .eq("user_id", userId)
      .maybeSingle();

    const customerInput = rawCustomer && typeof rawCustomer === "object" ? rawCustomer : {};
    const addressInput = rawAddress && typeof rawAddress === "object" ? rawAddress : {};

    const userName =
      normalizeText((customerInput as Record<string, unknown>)?.name) ||
      profile?.full_name ||
      client?.full_name ||
      "Usuário";
    const userEmail =
      normalizeText((customerInput as Record<string, unknown>)?.email) ||
      claimsData.user.email ||
      "";
    const userPhone =
      normalizeDigits((customerInput as Record<string, unknown>)?.phone_number) ||
      normalizeDigits(phone) ||
      normalizeDigits(client?.phone);
    const userDocument =
      normalizeDigits((customerInput as Record<string, unknown>)?.document) ||
      normalizeDigits(client?.cpf);

    const address = {
      street:
        normalizeText((addressInput as Record<string, unknown>)?.street) ||
        normalizeText(client?.street),
      number:
        normalizeText((addressInput as Record<string, unknown>)?.number) ||
        normalizeText(client?.number),
      complement: normalizeText((addressInput as Record<string, unknown>)?.complement),
      neighborhood:
        normalizeText((addressInput as Record<string, unknown>)?.neighborhood) ||
        normalizeText(client?.neighborhood),
      city:
        normalizeText((addressInput as Record<string, unknown>)?.city) ||
        normalizeText(client?.city),
      state: (
        normalizeText((addressInput as Record<string, unknown>)?.state) ||
        normalizeText(client?.state)
      ).toUpperCase(),
      zipcode:
        normalizeDigits((addressInput as Record<string, unknown>)?.zipcode) ||
        normalizeDigits(client?.zip_code),
    };

    const missingFields: string[] = [];
    if (userPhone.length < 10) missingFields.push("telefone");
    if (userDocument.length !== 11) missingFields.push("cpf");
    if (!address.street) missingFields.push("rua");
    if (!address.number) missingFields.push("número");
    if (!address.neighborhood) missingFields.push("bairro");
    if (!address.city) missingFields.push("cidade");
    if (address.state.length !== 2) missingFields.push("estado");
    if (address.zipcode.length !== 8) missingFields.push("cep");

    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Preencha telefone, CPF e endereço completo antes de gerar o Pix",
          missing_fields: missingFields,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
    const webhookUrl = `${supabaseUrl}/functions/v1/webhook-infinitepay`;

    const infinitePayBody = {
      handle: "meualishop",
      redirect_url: "https://doulacare.app.br/pagamento-sucesso",
      webhook_url: webhookUrl,
      order_nsu: orderNsu,
      customer: {
        name: userName,
        email: userEmail,
        phone_number: userPhone,
        document: userDocument,
        address: {
          street: address.street,
          number: address.number,
          complement: address.complement || undefined,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
          zipcode: address.zipcode,
        },
      },
      address: {
        street: address.street,
        number: address.number,
        complement: address.complement || undefined,
        neighborhood: address.neighborhood,
        city: address.city,
        state: address.state,
        zipcode: address.zipcode,
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

    const qrCodeCandidate =
      ipData?.qr_code_base64 ||
      ipData?.pix?.qr_code_base64 ||
      ipData?.pix?.qr_code ||
      ipData?.qr_code ||
      null;
    const qrCodeBase64 =
      typeof qrCodeCandidate === "string" && isLikelyBase64Image(qrCodeCandidate)
        ? qrCodeCandidate.replace(/\s/g, "")
        : null;
    const pixCode = ipData?.pix_code || ipData?.pix?.copy_paste || ipData?.pix?.code || ipData?.pix?.emv || null;
    const checkoutUrl = ipData?.url || ipData?.checkout_url || ipData?.link || null;
    const checkoutSlug = ipData?.slug || null;

    if (!pixCode) {
      console.error("InfinitePay did not return PIX copy-paste code");
      return new Response(
        JSON.stringify({ error: "Pix não foi gerado corretamente", details: ipData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      checkout_url: checkoutUrl,
      checkout_slug: checkoutSlug,
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
        created_at: new Date().toISOString(),
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
