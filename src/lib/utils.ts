import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse a date string (YYYY-MM-DD) as a local date without timezone shift.
 * This prevents the off-by-one-day issue when working with dates from the database.
 */
export function getLocalDate(dateString: string): Date {
  // Use parseISO and then adjust to local midnight
  const parsed = parseISO(dateString);
  // Create a new date using local year/month/day to avoid timezone issues
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}
