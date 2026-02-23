// Input mask utilities for Brazilian formats

export function maskPhone(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, "");
  
  // Apply mask based on length
  if (digits.length <= 2) {
    return digits;
  } else if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  } else if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  } else {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }
}

export function maskCPF(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, "");
  
  // Apply mask: 000.000.000-00
  if (digits.length <= 3) {
    return digits;
  } else if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  } else if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  } else {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  }
}

export function maskCEP(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, "");
  
  // Apply mask: 00000-000
  if (digits.length <= 5) {
    return digits;
  } else {
    return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
  }
}

export function unmask(value: string): string {
  return value.replace(/\D/g, "");
}

const LOWERCASE_PREPOSITIONS = new Set([
  "de", "da", "do", "dos", "das", "den", "del", "di", "du",
  "e", "em", "na", "no", "nas", "nos", "ao", "aos", "à", "às",
]);

export function toTitleCase(value: string): string {
  if (!value) return value;
  return value
    .toLowerCase()
    .split(" ")
    .map((word, index) => {
      if (!word) return word;
      if (index > 0 && LOWERCASE_PREPOSITIONS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export function toUpperCase(value: string): string {
  return value.toUpperCase();
}

// Mask for baby weight in kg (format: X.XXX)
export function maskWeight(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, "").slice(0, 5);
  
  if (digits.length === 0) return "";
  
  // Pad with leading zeros to ensure at least 4 characters for proper formatting
  const padded = digits.padStart(4, "0");
  
  // Split into integer and decimal parts (last 3 digits are decimal)
  const intPart = padded.slice(0, -3).replace(/^0+/, "") || "0";
  const decPart = padded.slice(-3);
  
  return `${intPart}.${decPart}`;
}

// Mask for baby height in cm (format: XX.XX)
export function maskHeight(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, "").slice(0, 4);
  
  if (digits.length === 0) return "";
  
  // Pad with leading zeros to ensure at least 3 characters for proper formatting
  const padded = digits.padStart(3, "0");
  
  // Split into integer and decimal parts (last 2 digits are decimal)
  const intPart = padded.slice(0, -2).replace(/^0+/, "") || "0";
  const decPart = padded.slice(-2);
  
  return `${intPart}.${decPart}`;
}

// Parse masked weight to number
export function parseWeight(value: string): number | null {
  if (!value) return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

// Parse masked height to number
export function parseHeight(value: string): number | null {
  if (!value) return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

// Mask for Brazilian currency (R$ 1.234,56)
export function maskCurrency(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  const formatted = (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `R$ ${formatted}`;
}

// Parse masked currency to number
export function parseCurrency(value: string): number {
  const digits = value.replace(/\D/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}
