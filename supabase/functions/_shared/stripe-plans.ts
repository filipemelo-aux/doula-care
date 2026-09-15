// Mapeamento único dos planos Stripe (checkout web).
// Mantenha sincronizado com platform_plan_limits e com os produtos das lojas.

export type PlanSlug = "pro" | "premium";
export type BillingPeriod = "monthly" | "yearly";

export interface StripePlan {
  priceId: string;
  pixPriceId: string; // preço avulso (Pix) equivalente ao período
  plan: PlanSlug;
  billing: BillingPeriod;
  planId: string; // platform_plan_limits.id
}

export const STRIPE_PLANS: StripePlan[] = [
  {
    priceId: "price_1UFjexD010uWXrBY9J3J6Y1K",
    pixPriceId: "price_1UFuTMD010uWXrBY0Rx1UxdI",
    plan: "pro",
    billing: "monthly",
    planId: "a4bd9641-83cb-41bc-aae3-5028cf13e29d",
  },
  {
    priceId: "price_1UFjeyD010uWXrBYAHRdeLCj",
    pixPriceId: "price_1UFuTND010uWXrBY1e26DkFW",
    plan: "pro",
    billing: "yearly",
    planId: "a4bd9641-83cb-41bc-aae3-5028cf13e29d",
  },
  {
    priceId: "price_1UFjezD010uWXrBYkGEMY4cE",
    pixPriceId: "price_1UFuTND010uWXrBYE5lWz3m5",
    plan: "premium",
    billing: "monthly",
    planId: "e84bd89e-cc54-42f6-8f9c-e9354c7058bd",
  },
  {
    priceId: "price_1UFjf0D010uWXrBYoM7vEZTL",
    pixPriceId: "price_1UFuTND010uWXrBYdI0c0Lqf",
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

export function findPixPriceId(plan: string, billing: string): string | undefined {
  return STRIPE_PLANS.find((p) => p.plan === plan && p.billing === billing)?.pixPriceId;
}

export function findPlanByPixPriceId(priceId?: string | null): StripePlan | undefined {
  if (!priceId) return undefined;
  return STRIPE_PLANS.find((p) => p.pixPriceId === priceId);
}
