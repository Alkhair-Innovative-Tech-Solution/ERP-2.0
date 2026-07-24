/**
 * Format CNIC to XXXXX-XXXXXXX-X format as user types.
 */
export function formatCNICInput(value: string): string {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, "");
  
  if (digits.length === 0) return "";
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
}

/**
 * Validate CNIC format. Returns error message or null.
 */
export function validateCNIC(cnic: string): string | null {
  if (!cnic || !cnic.trim()) return null; // Optional
  
  const digits = cnic.replace(/\D/g, "");
  if (digits.length !== 13) {
    return "CNIC must be 13 digits (XXXXX-XXXXXXX-X)";
  }
  return null;
}

/**
 * Validate Pakistan phone number. Returns error message or null.
 */
export function validatePhonePakistan(phone: string): string | null {
  if (!phone || !phone.trim()) return null; // Optional
  
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");
  
  if (cleaned.startsWith("+92")) {
    if (cleaned.length !== 13) return "Phone must be +92XXXXXXXXXX (12 digits after +92)";
  } else if (cleaned.startsWith("92")) {
    if (cleaned.length !== 12) return "Phone must be 92XXXXXXXXXX (12 digits)";
  } else if (cleaned.startsWith("0")) {
    if (cleaned.length !== 11) return "Phone must be 03XXXXXXXXX (11 digits)";
  } else {
    return "Phone must start with 0, +92, or 92";
  }
  
  return null;
}

/**
 * Clean phone number to +92 format.
 */
export function cleanPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");
  if (cleaned.startsWith("+92")) return cleaned;
  if (cleaned.startsWith("92")) return `+${cleaned}`;
  if (cleaned.startsWith("0")) return `+92${cleaned.slice(1)}`;
  return cleaned;
}
