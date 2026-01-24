import { differenceInWeeks } from "date-fns";

/**
 * Calculate current pregnancy weeks based on initial weeks and the date they were set
 * @param initialWeeks - The pregnancy weeks recorded at registration
 * @param setAt - The date when pregnancy weeks was recorded
 * @returns Current pregnancy weeks
 */
export function calculateCurrentPregnancyWeeks(
  initialWeeks: number | null,
  setAt: string | null
): number | null {
  if (initialWeeks === null || !setAt) return initialWeeks;

  const setAtDate = new Date(setAt);
  const now = new Date();
  const weeksElapsed = differenceInWeeks(now, setAtDate);

  return initialWeeks + weeksElapsed;
}
