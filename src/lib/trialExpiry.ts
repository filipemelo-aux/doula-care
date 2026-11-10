export interface TrialPromotion {
  id: string;
  status: string;
  promotion_type: string;
  trial_ends_at: string | null;
}

export function hasEndedTrial(promo: TrialPromotion | null | undefined, now = Date.now()): boolean {
  if (!promo || promo.promotion_type !== "trial_15d") return false;
  if (promo.status === "expired") return true;
  if (promo.status !== "trial_active" || !promo.trial_ends_at) return false;
  return new Date(promo.trial_ends_at).getTime() <= now;
}

export function needsTrialNotice(
  promo: TrialPromotion | null | undefined,
  plan: string,
  hasActiveSubscription: boolean,
  now = Date.now(),
): boolean {
  if (hasActiveSubscription || !hasEndedTrial(promo, now)) return false;
  // Preserve paid/manual plans and lifetime access; also handle expiry before the scheduled downgrade.
  return plan === "free" || promo?.status === "trial_active";
}