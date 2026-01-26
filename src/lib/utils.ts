import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { parseISO, format as dateFnsFormat } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime, format as tzFormat } from "date-fns-tz";

const BRAZIL_TIMEZONE = "America/Sao_Paulo";

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
 * Convert a date to Brazil timezone (America/Sao_Paulo)
 */
export function toBrazilTime(date: Date | string): Date {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  return toZonedTime(dateObj, BRAZIL_TIMEZONE);
}

/**
 * Format a date in Brazil timezone with the given format pattern
 */
export function formatBrazilDate(
  date: Date | string,
  formatStr: string = "dd/MM/yyyy"
): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  const brazilDate = toZonedTime(dateObj, BRAZIL_TIMEZONE);
  return tzFormat(brazilDate, formatStr, { locale: ptBR, timeZone: BRAZIL_TIMEZONE });
}

/**
 * Format a datetime in Brazil timezone with full date and time
 */
export function formatBrazilDateTime(
  date: Date | string,
  formatStr: string = "dd/MM/yyyy 'às' HH:mm"
): string {
  return formatBrazilDate(date, formatStr);
}

/**
 * Format just the time portion in Brazil timezone
 */
export function formatBrazilTime(
  date: Date | string,
  formatStr: string = "HH:mm"
): string {
  return formatBrazilDate(date, formatStr);
}

/**
 * Abbreviate a name for mobile display.
 * If the name has more than 4 parts (excluding prefixes), abbreviate the 3rd and 4th actual names with first letter + "."
 * Prefixes like "de", "da", "do", "dos", "das", "e" are not counted as names.
 * Example: "Maria José da Silva Santos Oliveira" -> "Maria José da S. S. Oliveira"
 */
export function abbreviateName(fullName: string): string {
  const parts = fullName.split(" ");
  const prefixes = ["de", "da", "do", "dos", "das", "e", "del", "della", "di"];
  
  // Count actual names (excluding prefixes)
  const actualNames = parts.filter(part => !prefixes.includes(part.toLowerCase()));
  
  if (actualNames.length <= 4) {
    return fullName;
  }
  
  // Find the indices of the 3rd and 4th actual names in the original parts array
  let actualNameCount = 0;
  const indicesToAbbreviate: number[] = [];
  
  for (let i = 0; i < parts.length; i++) {
    if (!prefixes.includes(parts[i].toLowerCase())) {
      actualNameCount++;
      if (actualNameCount === 3 || actualNameCount === 4) {
        indicesToAbbreviate.push(i);
      }
      if (actualNameCount >= 4) break;
    }
  }
  
  if (indicesToAbbreviate.length === 0) {
    return fullName;
  }
  
  // Abbreviate the 3rd and 4th actual names
  const abbreviated = parts.map((part, index) => {
    if (indicesToAbbreviate.includes(index)) {
      return part.charAt(0).toUpperCase() + ".";
    }
    return part;
  });
  
  return abbreviated.join(" ");
}
