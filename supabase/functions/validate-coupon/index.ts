import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

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

function describe(coupon: Stripe.Coupon): string {
  if (coupon.percent_off) {
    const base = `${Number(coupon.percent_off)
      .toFixed(2)
      .replace(/\.00$/, "")
      .replace(".", ",")}% de desconto`;
    return withDuration(base, coupon);
  }
  if (coupon.amount_off) {
    const value = (coupon.amount_off / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: (coupon.currency || "brl").toUpperCase(),
    });
    return withDuration(`${value} de desconto`, coupon);
  }
  return "Desconto aplicado";
}

function withDuration(base: string, coupon: Stripe.Coupon): string {
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
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

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

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const promos = await stripe.promotionCodes.list({ code, active: true, limit: 1 });

    if (promos.data.length === 0) {
      return json({ valid: false, message: "Cupom não encontrado ou expirado" });
    }

    const promo = promos.data[0];
    const coupon = promo.coupon;
    if (!coupon?.valid) {
      return json({ valid: false, message: "Cupom não está mais disponível" });
    }

    return json({
      valid: true,
      code: promo.code,
      description: describe(coupon),
      percent_off: coupon.percent_off ?? null,
      amount_off: coupon.amount_off ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[validate-coupon]", message);
    return json({ error: message }, 500);
  }
});
