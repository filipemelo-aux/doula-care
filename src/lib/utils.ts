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
 * If the name has more than 4 parts (excluding prefixes), abbreviate the 3rd actual name with first letter + "."
 * Prefixes like "de", "da", "do", "dos", "das", "e" are not counted as names.
 * Example: "Maria José da Silva Santos" -> "Maria José da S. Santos"
 */
export function abbreviateName(fullName: string): string {
  const parts = fullName.split(" ");
  const prefixes = ["de", "da", "do", "dos", "das", "e", "del", "della", "di"];
  
  // Count actual names (excluding prefixes)
  const actualNames = parts.filter(part => !prefixes.includes(part.toLowerCase()));
  
  if (actualNames.length <= 4) {
    return fullName;
  }
  
  // Find the index of the 3rd actual name in the original parts array
  let actualNameCount = 0;
  let indexToAbbreviate = -1;
  
  for (let i = 0; i < parts.length; i++) {
    if (!prefixes.includes(parts[i].toLowerCase())) {
      actualNameCount++;
      if (actualNameCount === 3) {
        indexToAbbreviate = i;
        break;
      }
    }
  }
  
  if (indexToAbbreviate === -1) {
    return fullName;
  }
  
  // Abbreviate the 3rd actual name
  const abbreviated = parts.map((part, index) => {
    if (index === indexToAbbreviate) {
      return part.charAt(0).toUpperCase() + ".";
    }
    return part;
  });
  
  return abbreviated.join(" ");
}
