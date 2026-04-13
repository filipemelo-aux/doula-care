import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Stripe price mapping for each plan + billing type
const STRIPE_PRICES: Record<string, Record<string, string>> = {
  // Pro plan
  "a4bd9641-83cb-41bc-aae3-5028cf13e29d": {
    monthly: "price_1TLhO6KEFTkSbUTTa9b8f6Cp",
    yearly: "price_1TLhOOKEFTkSbUTTsQKLLGWD",
  },
  // Premium plan
  "e84bd89e-cc54-42f6-8f9c-e9354c7058bd": {
    monthly: "price_1TLhOgKEFTkSbUTTXtLz25nU",
    yearly: "price_1TLhPBKEFTkSbUTTNSzAqgyW",
  },
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

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
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
    const body = await req.json();
    const { plan_id, billing_type } = body ?? {};

    if (!plan_id || !["monthly", "yearly"].includes(billing_type)) {
      return new Response(
        JSON.stringify({ error: "plan_id e billing_type são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const priceLookup = STRIPE_PRICES[plan_id];
    if (!priceLookup) {
      return new Response(
        JSON.stringify({ error: "Plano não encontrado ou gratuito" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const priceId = priceLookup[billing_type];
    if (!priceId) {
      return new Response(
        JSON.stringify({ error: "Tipo de cobrança inválido para este plano" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if Stripe customer exists
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://doula-care.lovable.app";

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email!,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/assinatura?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${origin}/assinatura?canceled=true`,
      metadata: {
        user_id: user.id,
        plan_id: plan_id,
        billing_type: billing_type,
      },
    });

    console.log("[create-checkout-session] Stripe session created:", session.id);

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
