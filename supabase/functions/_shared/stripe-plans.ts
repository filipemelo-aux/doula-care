// Mapeamento único dos planos Stripe (checkout web).
// Mantenha sincronizado com platform_plan_limits e com os produtos das lojas.

export type PlanSlug = "pro" | "premium";
export type BillingPeriod = "monthly" | "yearly";

export interface StripePlan {
  priceId: string;
  plan: PlanSlug;
  billing: BillingPeriod;
  planId: string; // platform_plan_limits.id
}

export const STRIPE_PLANS: StripePlan[] = [
  {
    priceId: "price_1UFYJsKEFTkSbUTT1FkSTpgJ",
    plan: "pro",
    billing: "monthly",
    planId: "a4bd9641-83cb-41bc-aae3-5028cf13e29d",
  },
  {
    priceId: "price_1UFYK6KEFTkSbUTTBZZ8zQ1m",
    plan: "pro",
    billing: "yearly",
    planId: "a4bd9641-83cb-41bc-aae3-5028cf13e29d",
  },
  {
    priceId: "price_1UFYKQKEFTkSbUTT9YH89lNp",
    plan: "premium",
    billing: "monthly",
    planId: "e84bd89e-cc54-42f6-8f9c-e9354c7058bd",
  },
  {
    priceId: "price_1UFYKlKEFTkSbUTTQruEoYa5",
    plan: "premium",
    billing: "yearly",
    planId: "e84bd89e-cc54-42f6-8f9c-e9354c7058bd",
  },
];

export function findPlanByPriceId(priceId?: string | null): StripePlan | undefined {
  if (!priceId) return undefined;
  return STRIPE_PLANS.find((p) => p.priceId === priceId);
}

export function findPriceId(plan: string, billing: string): string | undefined {
  return STRIPE_PLANS.find((p) => p.plan === plan && p.billing === billing)?.priceId;
}
