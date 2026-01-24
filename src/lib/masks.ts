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

export function toUpperCase(value: string): string {
  return value.toUpperCase();
}

// Mask for baby weight in kg (format: X.XXX)
export function maskWeight(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, "");
  
  if (digits.length === 0) return "";
  
  // Pad with leading zeros if needed to have at least 4 digits
  const padded = digits.slice(0, 5);
  
  if (padded.length <= 3) {
    // Less than 1kg - format as 0.XXX
    return `0.${padded.padStart(3, "0").slice(-3)}`;
  } else {
    // 1kg or more - format as X.XXX or XX.XXX
    const intPart = padded.slice(0, -3);
    const decPart = padded.slice(-3);
    return `${intPart}.${decPart}`;
  }
}

// Mask for baby height in cm (format: XX.XX)
export function maskHeight(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, "");
  
  if (digits.length === 0) return "";
  
  // Limit to 4 digits max
  const padded = digits.slice(0, 4);
  
  if (padded.length <= 2) {
    // Less than 1cm - format as 0.XX
    return `0.${padded.padStart(2, "0").slice(-2)}`;
  } else {
    // 1cm or more - format as X.XX or XX.XX
    const intPart = padded.slice(0, -2);
    const decPart = padded.slice(-2);
    return `${intPart}.${decPart}`;
  }
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
