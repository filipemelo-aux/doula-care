import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { findPixPriceId, findPriceId } from "../_shared/stripe-plans.ts";
import {
  adminClient,
  findCoupons,
  getOrganizationId,
  matchOffer,
} from "../_shared/db-coupons.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[CREATE-CHECKOUT] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_LIVE_API_KEY") ?? Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe key is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id });

    const body = await req.json().catch(() => ({}));
    const plan = String(body?.plan ?? "").toLowerCase();
    const billing = String(body?.billing ?? "").toLowerCase();
    const couponCode = typeof body?.coupon === "string" ? body.coupon.trim() : "";
    // Pix de assinatura é tratado fora da Stripe (QR Code da plataforma).
    const isPix = false;

    const priceId = findPriceId(plan, billing);
    if (!priceId) {
      return new Response(
        JSON.stringify({ error: "Plano ou periodicidade inválidos" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

    const origin = req.headers.get("origin") || "https://doulacare.app.br";

    // Cupom opcional:
    // 1) cupom cadastrado no Super Admin (valor em reais por plano)
    // 2) código promocional criado direto no Stripe
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
    if (couponCode) {
      const admin = adminClient();
      const orgId = await getOrganizationId(admin, user.id);
      const offers = await findCoupons(admin, couponCode, orgId);
      const offer = matchOffer(offers, plan, billing);

      if (offer) {
        const isPercent = offer.discount_type === "percent";
        const created = await stripe.coupons.create({
          ...(isPercent
            ? { percent_off: offer.discount_percent ?? 0 }
            : { amount_off: offer.discount_amount ?? 0, currency: "brl" }),
          duration: offer.duration === "forever" ? "forever" : "once",
          name: `${offer.code} · ${offer.plan_name ?? plan}`,
          metadata: { coupon_id: offer.id, code: offer.code, plan, billing },
        });
        discounts = [{ coupon: created.id }];
        logStep("Internal coupon applied", { code: offer.code, amount: offer.discount_amount });
      } else {
        const promos = await stripe.promotionCodes.list({
          code: couponCode,
          active: true,
          limit: 1,
        });
        if (promos.data.length > 0) {
          discounts = [{ promotion_code: promos.data[0].id }];
        }
      }
    }

    const metadata = {
      user_id: user.id,
      plan,
      billing,
      method: isPix ? "pix" : "card",
    };

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: isPix ? "payment" : "subscription",
      ...(isPix ? { payment_method_types: ["pix" as Stripe.Checkout.SessionCreateParams.PaymentMethodType] } : {}),
      allow_promotion_codes: isPix || discounts ? undefined : true,
      discounts,
      success_url: `${origin}/admin/assinatura?checkout=${isPix ? "pix" : "success"}`,
      cancel_url: `${origin}/admin/assinatura?checkout=cancel`,
      metadata,
      ...(isPix
        ? { payment_intent_data: { metadata } }
        : { subscription_data: { metadata } }),
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
