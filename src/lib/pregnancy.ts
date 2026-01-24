import { differenceInDays } from "date-fns";

/**
 * Calculate current pregnancy weeks based on DPP or initial weeks
 * @param initialWeeks - The pregnancy weeks recorded at registration
 * @param setAt - The date when pregnancy weeks was recorded
 * @param dpp - Data Prevista para o Parto (Expected Delivery Date)
 * @returns Current pregnancy weeks (can exceed 40 for post-term tracking)
 */
export function calculateCurrentPregnancyWeeks(
  initialWeeks: number | null,
  setAt: string | null,
  dpp?: string | null
): number | null {
  // If DPP is provided, calculate based on it (40 weeks = 280 days)
  if (dpp) {
    const dppDate = new Date(dpp);
    const now = new Date();
    const daysUntilDpp = differenceInDays(dppDate, now);
    // 40 weeks = 280 days, current days = 280 - daysUntilDpp
    const currentDays = 280 - daysUntilDpp;
    const currentWeeks = Math.floor(currentDays / 7);
    const currentDaysRemainder = currentDays % 7;
    return Math.max(0, currentWeeks); // No upper limit to track post-term
  }

  // Fallback to calculation based on initial weeks and set date
  if (initialWeeks === null || !setAt) return initialWeeks;

  const setAtDate = new Date(setAt);
  const now = new Date();
  const daysElapsed = differenceInDays(now, setAtDate);
  const weeksElapsed = Math.floor(daysElapsed / 7);

  return initialWeeks + weeksElapsed;
}

/**
 * Calculate current pregnancy days (remaining after weeks) based on DPP
 * @param dpp - Data Prevista para o Parto (Expected Delivery Date)
 * @returns Current pregnancy days remainder (0-6)
 */
export function calculateCurrentPregnancyDays(dpp: string | null): number {
  if (!dpp) return 0;
  
  const dppDate = new Date(dpp);
  const now = new Date();
  const daysUntilDpp = differenceInDays(dppDate, now);
  const currentDays = 280 - daysUntilDpp;
  return Math.max(0, currentDays % 7);
}

/**
 * Check if pregnancy is post-term (40+ weeks)
 * @param dpp - Data Prevista para o Parto (Expected Delivery Date)
 * @returns True if post-term
 */
export function isPostTerm(dpp: string | null): boolean {
  if (!dpp) return false;
  
  const weeks = calculateCurrentPregnancyWeeks(null, null, dpp);
  const days = calculateCurrentPregnancyDays(dpp);
  
  // Post-term is 40 weeks and 1+ days
  return weeks !== null && (weeks > 40 || (weeks === 40 && days >= 1));
}
