import { differenceInWeeks } from "date-fns";

/**
 * Calculate current pregnancy weeks based on DPP or initial weeks
 * @param initialWeeks - The pregnancy weeks recorded at registration
 * @param setAt - The date when pregnancy weeks was recorded
 * @param dpp - Data Prevista para o Parto (Expected Delivery Date)
 * @returns Current pregnancy weeks
 */
export function calculateCurrentPregnancyWeeks(
  initialWeeks: number | null,
  setAt: string | null,
  dpp?: string | null
): number | null {
  // If DPP is provided, calculate based on it (40 weeks - weeks until DPP)
  if (dpp) {
    const dppDate = new Date(dpp);
    const now = new Date();
    const weeksUntilDpp = differenceInWeeks(dppDate, now);
    const currentWeeks = 40 - weeksUntilDpp;
    return Math.max(0, Math.min(45, currentWeeks)); // Clamp between 0 and 45
  }

  // Fallback to calculation based on initial weeks and set date
  if (initialWeeks === null || !setAt) return initialWeeks;

  const setAtDate = new Date(setAt);
  const now = new Date();
  const weeksElapsed = differenceInWeeks(now, setAtDate);

  return initialWeeks + weeksElapsed;
}
