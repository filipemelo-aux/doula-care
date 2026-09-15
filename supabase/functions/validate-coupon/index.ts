import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import {
  adminClient,
  describeOffer,
  findCoupons,
  getOrganizationId,
  hasDiscount,
} from "../_shared/db-coupons.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function describeStripe(coupon: Stripe.Coupon): string {
  let base = "Desconto aplicado";
  if (coupon.percent_off) {
    base = `${Number(coupon.percent_off)
      .toFixed(2)
      .replace(/\.00$/, "")
      .replace(".", ",")}% de desconto`;
  } else if (coupon.amount_off) {
    const value = (coupon.amount_off / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: (coupon.currency || "brl").toUpperCase(),
    });
    base = `${value} de desconto`;
  }
  if (coupon.duration === "forever") return `${base} em todas as cobranças`;
  if (coupon.duration === "once") return `${base} na primeira cobrança`;
  if (coupon.duration === "repeating" && coupon.duration_in_months) {
    return `${base} por ${coupon.duration_in_months} meses`;
  }
  return base;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const { data: userData, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError || !userData?.user) return json({ error: "Não autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code ?? "").trim();
    if (code.length < 3) return json({ valid: false, message: "Código inválido" });

    // 1) Cupons cadastrados no Super Admin (valor em reais por plano)
    const admin = adminClient();
    const orgId = await getOrganizationId(admin, userData.user.id);
    const offers = (await findCoupons(admin, code, orgId)).filter(hasDiscount);

    if (offers.length > 0) {
      return json({
        valid: true,
        code: offers[0].code,
        source: "internal",
        description: offers.map(describeOffer).join(" · "),
        offers: offers.map((o) => ({
          plan: o.plan,
          plan_id: o.plan_id,
          plan_name: o.plan_name,
          billing_period: o.billing_period,
          discount_type: o.discount_type,
          discount_amount: o.discount_amount,
          discount_percent: o.discount_percent,
          duration: o.duration,
          description: describeOffer(o),
        })),
      });
    }

    // 2) Fallback: código promocional criado direto no Stripe
    const stripeKey = Deno.env.get("STRIPE_LIVE_API_KEY") ?? Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ valid: false, message: "Cupom não encontrado" });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const promos = await stripe.promotionCodes.list({ code, active: true, limit: 1 });

    if (promos.data.length === 0 || !promos.data[0].coupon?.valid) {
      return json({ valid: false, message: "Cupom não encontrado ou expirado" });
    }

    const promo = promos.data[0];
    return json({
      valid: true,
      code: promo.code,
      source: "stripe",
      description: describeStripe(promo.coupon),
      offers: [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[validate-coupon]", message);
    return json({ error: message }, 500);
  }
});
