// Cupons cadastrados no Super Admin (valor em reais por plano).
// Códigos repetidos são permitidos: a identificação é feita pela
// combinação código + plano (+ periodicidade).
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

export interface CouponOffer {
  id: string;
  code: string;
  plan_id: string | null;
  plan: string | null; // slug: pro | premium
  plan_name: string | null;
  billing_period: "monthly" | "yearly" | "both";
  discount_amount: number | null; // centavos
  duration: "once" | "forever";
  description: string | null;
  organization_id: string | null;
  expires_at: string | null;
}

export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );
}

export async function getOrganizationId(
  admin: ReturnType<typeof adminClient>,
  userId: string
): Promise<string | null> {
  const { data } = await admin
    .from("profiles")
    .select("organization_id")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as any)?.organization_id ?? null;
}

/** Retorna todos os cupons cadastrados com esse código visíveis para a org. */
export async function findCoupons(
  admin: ReturnType<typeof adminClient>,
  code: string,
  organizationId: string | null
): Promise<CouponOffer[]> {
  const { data, error } = await admin
    .from("subscription_coupons")
    .select(
      "id, code, plan_id, billing_period, discount_amount, duration, description, organization_id, expires_at, is_active, platform_plan_limits:plan_id (plan, name)"
    )
    .ilike("code", code)
    .eq("is_active", true);

  if (error || !data) return [];

  const now = Date.now();
  return (data as any[])
    .filter((r) => !r.expires_at || new Date(r.expires_at).getTime() >= now)
    .filter(
      (r) => !r.organization_id || (organizationId && r.organization_id === organizationId)
    )
    .map((r) => ({
      id: r.id,
      code: r.code,
      plan_id: r.plan_id ?? null,
      plan: r.platform_plan_limits?.plan ?? null,
      plan_name: r.platform_plan_limits?.name ?? null,
      billing_period: (r.billing_period ?? "both") as CouponOffer["billing_period"],
      discount_amount: r.discount_amount ?? null,
      duration: (r.duration ?? "once") as CouponOffer["duration"],
      description: r.description ?? null,
      organization_id: r.organization_id ?? null,
      expires_at: r.expires_at ?? null,
    }))
    // cupom exclusivo da doula tem prioridade sobre o cupom geral
    .sort((a, b) => (b.organization_id ? 1 : 0) - (a.organization_id ? 1 : 0));
}

export function matchOffer(
  offers: CouponOffer[],
  plan: string,
  billing: string
): CouponOffer | undefined {
  return offers.find(
    (o) =>
      o.discount_amount &&
      o.discount_amount > 0 &&
      (!o.plan || o.plan === plan) &&
      (o.billing_period === "both" || o.billing_period === billing)
  );
}

export function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function describeOffer(offer: CouponOffer): string {
  if (!offer.discount_amount) return offer.description || "Desconto aplicado";
  const value = formatBRL(offer.discount_amount);
  const plan = offer.plan_name ? ` no plano ${offer.plan_name}` : "";
  const period =
    offer.billing_period === "monthly"
      ? " mensal"
      : offer.billing_period === "yearly"
        ? " anual"
        : "";
  const duration =
    offer.duration === "forever" ? "em todas as cobranças" : "na primeira cobrança";
  return `${value} de desconto${plan}${period} ${duration}`;
}
