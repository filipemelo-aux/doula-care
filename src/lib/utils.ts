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

  // Group parts into "name units" where prefix + next word = 1 unit
  // e.g. ["Maria", "José", "da", "Silva", "Santos", "Oliveira"] -> 
  //       [{parts: ["Maria"]}, {parts: ["José"]}, {parts: ["da", "Silva"]}, {parts: ["Santos"]}, {parts: ["Oliveira"]}]
  const nameUnits: { parts: string[]; startIndex: number }[] = [];
  let i = 0;
  while (i < parts.length) {
    if (prefixes.includes(parts[i].toLowerCase()) && i + 1 < parts.length) {
      // Prefix + next word = one unit
      nameUnits.push({ parts: [parts[i], parts[i + 1]], startIndex: i });
      i += 2;
    } else {
      nameUnits.push({ parts: [parts[i]], startIndex: i });
      i += 1;
    }
  }

  const totalNames = nameUnits.length; // first name + surnames
  const totalSurnames = totalNames - 1;

  // Determine which name positions (1-indexed) to abbreviate
  const positionsToAbbreviate: number[] = [];
  if (totalSurnames >= 5) {
    // 5+ surnames: abbreviate 3rd and 4th names
    positionsToAbbreviate.push(3, 4);
  } else if (totalSurnames === 4) {
    // 4 surnames: abbreviate 3rd name
    positionsToAbbreviate.push(3);
  }

  if (positionsToAbbreviate.length === 0) {
    return fullName;
  }

  // Build abbreviated name
  const result = nameUnits.map((unit, idx) => {
    const position = idx + 1; // 1-indexed
    if (positionsToAbbreviate.includes(position)) {
      // Get the main name (last part of the unit, the non-prefix part)
      const mainName = unit.parts[unit.parts.length - 1];
      if (unit.parts.length > 1) {
        // Has prefix: keep prefix + abbreviate main name
        return [...unit.parts.slice(0, -1), mainName.charAt(0).toUpperCase() + "."].join(" ");
      }
      return mainName.charAt(0).toUpperCase() + ".";
    }
    return unit.parts.join(" ");
  });

  return result.join(" ");
}
