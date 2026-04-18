import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[create-checkout-session] ${step}${d}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    // 2. Parse body
    const body = await req.json();
    const { plan_id, billing_type } = body ?? {};

    const VALID_BILLING = ["monthly", "yearly", "one_time_monthly", "one_time_yearly"];
    if (!plan_id || !VALID_BILLING.includes(billing_type)) {
      return new Response(
        JSON.stringify({ error: "plan_id e billing_type são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Fetch plan from database (service role to bypass RLS)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: planRows, error: planError } = await supabaseAdmin
      .from("platform_plan_limits")
      .select("id, name, plan, price_monthly, price_yearly, is_free")
      .eq("id", plan_id)
      .limit(1);

    if (planError || !planRows || planRows.length === 0) {
      logStep("Plan not found", { plan_id, planError });
      return new Response(
        JSON.stringify({ error: "Plano não encontrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const plan = planRows[0];

    if (plan.is_free) {
      return new Response(
        JSON.stringify({ error: "Plano gratuito não requer pagamento" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Determine price
    const isYearlyPeriod = billing_type === "yearly" || billing_type === "one_time_yearly";
    const isOneTime = billing_type === "one_time_monthly" || billing_type === "one_time_yearly";
    const unitAmount = isYearlyPeriod ? plan.price_yearly : plan.price_monthly;
    const recurringInterval = isYearlyPeriod ? "year" : "month";

    if (!unitAmount || unitAmount <= 0) {
      return new Response(
        JSON.stringify({ error: "Preço inválido para este plano" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Plan resolved", { name: plan.name, unitAmount, recurringInterval });

    // 5. Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // 6. Check if Stripe customer exists
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing Stripe customer found", { customerId });
    }

    const origin = req.headers.get("origin") || body?.return_url || "https://doulacare.app.br";

    // 7. Create Stripe Checkout session
    // - Subscription (monthly/yearly): cartão + boleto (Stripe não permite Pix recorrente)
    // - One-time (one_time_monthly/one_time_yearly): cartão + boleto + Pix, sem renovação
    const useOneTime = isOneTime || billing_type === "yearly"; // anual continua sendo cobrança única
    const periodLabel = isYearlyPeriod ? "Anual" : "Mensal";
    const oneTimeSuffix = isOneTime ? " — Avulso" : "";

    const sessionParams: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email!,
      locale: "pt-BR",
      success_url: `${origin}/admin/assinatura?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${origin}/admin/assinatura?canceled=true`,
      metadata: {
        user_id: user.id,
        plan_id: plan_id,
        billing_type: billing_type,
      },
    };

    if (useOneTime) {
      // Cobrança única (anual padrão ou avulso 1 mês/1 ano) — habilita Pix, cartão e boleto
      sessionParams.mode = "payment";
      sessionParams.payment_method_types = ["card", "boleto", "pix"];
      sessionParams.line_items = [
        {
          price_data: {
            currency: "brl",
            product_data: { name: `Plano ${plan.name} (${periodLabel}${oneTimeSuffix})` },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ];
      sessionParams.payment_intent_data = {
        metadata: {
          user_id: user.id,
          plan_id: plan_id,
          billing_type: billing_type,
        },
      };
    } else {
      // Mensal recorrente — cartão + boleto (Stripe não suporta Pix recorrente)
      sessionParams.mode = "subscription";
      sessionParams.payment_method_types = ["card", "boleto"];
      sessionParams.line_items = [
        {
          price_data: {
            currency: "brl",
            product_data: { name: `Plano ${plan.name}` },
            unit_amount: unitAmount,
            recurring: { interval: recurringInterval },
          },
          quantity: 1,
        },
      ];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    logStep("Stripe session created", { sessionId: session.id });

    // 8. Save pending payment record
    const orderNsu = `STRIPE-${session.id}`;
    const { error: paymentError } = await supabaseAdmin
      .from("plan_payments")
      .insert({
        user_id: user.id,
        plan_id: plan_id,
        amount: unitAmount,
        billing_type: billing_type,
        status: "pending",
        gateway: "stripe",
        gateway_payment_id: session.id,
        order_nsu: orderNsu,
      });

    if (paymentError) {
      logStep("Warning: failed to save plan_payment", { paymentError });
    } else {
      logStep("Plan payment saved as pending");
    }

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
