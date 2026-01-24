import { differenceInDays } from "date-fns";

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
  let weeksFromDpp: number | null = null;
  let weeksFromManual: number | null = null;

  // Calculate based on DPP if provided
  if (dpp) {
    const dppDate = new Date(dpp);
    const now = new Date();
    const daysUntilDpp = differenceInDays(dppDate, now);
    // 40 weeks = 280 days, current days = 280 - daysUntilDpp
    const currentDays = 280 - daysUntilDpp;
    weeksFromDpp = Math.floor(currentDays / 7);
  }

  // Calculate based on initial weeks and set date
  if (initialWeeks !== null && setAt) {
    const setAtDate = new Date(setAt);
    const now = new Date();
    const daysElapsed = differenceInDays(now, setAtDate);
    const weeksElapsed = Math.floor(daysElapsed / 7);
    weeksFromManual = initialWeeks + weeksElapsed;
  } else if (initialWeeks !== null) {
    weeksFromManual = initialWeeks;
  }

  // Use the higher value between DPP calculation and manual input
  // This handles cases where DPP might be incorrect or outdated
  let result: number | null = null;
  if (weeksFromDpp !== null && weeksFromManual !== null) {
    result = Math.max(weeksFromDpp, weeksFromManual);
  } else if (weeksFromDpp !== null) {
    result = weeksFromDpp;
  } else {
    result = weeksFromManual;
  }

  // Clamp between 0 and 42
  if (result !== null) {
    return Math.max(0, Math.min(42, result));
  }

  return result;
}
