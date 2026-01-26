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

/**
 * Abbreviate a name for mobile display.
 * If the name has more than 4 parts, abbreviate the 3rd part with first letter + "."
 * Example: "Maria José da Silva Santos" -> "Maria José d. Silva Santos"
 */
export function abbreviateName(fullName: string): string {
  const parts = fullName.split(" ");
  
  if (parts.length <= 4) {
    return fullName;
  }
  
  // Abbreviate the 3rd name (index 2)
  const abbreviated = parts.map((part, index) => {
    if (index === 2) {
      return part.charAt(0).toLowerCase() + ".";
    }
    return part;
  });
  
  return abbreviated.join(" ");
}
