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
