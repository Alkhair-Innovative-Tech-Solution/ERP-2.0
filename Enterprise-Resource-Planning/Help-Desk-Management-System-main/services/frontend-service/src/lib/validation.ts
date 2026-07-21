/**
 * Validation utilities and schemas
 * Client-side validation for forms and inputs
 */

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper function
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

export const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return { valid: errors.length === 0, errors };
};

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;
  return phoneRegex.test(phone);
};

export const validateURL = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const validateRequired = (value: any): boolean => {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined;
};

export const validateMinLength = (value: string, min: number): boolean => {
  return value.length >= min;
};

export const validateMaxLength = (value: string, max: number): boolean => {
  return value.length <= max;
};

export const validateNumeric = (value: string): boolean => {
  return /^\d+$/.test(value);
};

export const validateAlphanumeric = (value: string): boolean => {
  return /^[a-zA-Z0-9]+$/.test(value);
};

// Form validation helpers
export interface ValidationRule {
  validator: (value: any) => boolean;
  message: string;
}

export interface FieldValidation {
  value: any;
  rules: ValidationRule[];
}

export const validateField = (field: FieldValidation): string | null => {
  for (const rule of field.rules) {
    if (!rule.validator(field.value)) {
      return rule.message;
    }
  }
  return null;
};

export const validateForm = (fields: Record<string, FieldValidation>): Record<string, string> => {
  const errors: Record<string, string> = {};

  for (const [key, field] of Object.entries(fields)) {
    const error = validateField(field);
    if (error) {
      errors[key] = error;
    }
  }

  return errors;
};

// Ticket validation
export const validateTicketSubject = (subject: string): string | null => {
  if (!validateRequired(subject)) {
    return 'Subject is required';
  }
  if (!validateMinLength(subject, 10)) {
    return 'Subject must be at least 10 characters';
  }
  if (!validateMaxLength(subject, 200)) {
    return 'Subject must be less than 200 characters';
  }
  return null;
};

export const validateTicketDescription = (description: string): string | null => {
  if (!validateRequired(description)) {
    return 'Description is required';
  }
  if (!validateMinLength(description, 20)) {
    return 'Description must be at least 20 characters';
  }
  return null;
};

// File validation
export const MAX_FILE_SIZE = 250 * 1024 * 1024; // 250MB
export const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB
export const SERVER_MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

export const ALLOWED_FILE_TYPES = {
  documents: ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  images: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
  videos: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'],
};

export const validateFileType = (file: File): string | null => {
  const allAllowedTypes = [
    ...ALLOWED_FILE_TYPES.documents,
    ...ALLOWED_FILE_TYPES.images,
    ...ALLOWED_FILE_TYPES.videos,
  ];

  if (!allAllowedTypes.includes(file.type)) {
    return `File type ${file.type} is not allowed. Allowed types: PDF, TXT, DOCX, XLSX, JPG, PNG, GIF, MP4, MOV, MKV, AVI`;
  }
  return null;
};

export const validateFileSize = (file: File): string | null => {
  if (file.size > MAX_FILE_SIZE) {
    return `File size (${formatFileSize(file.size)}) exceeds maximum allowed size of ${formatFileSize(MAX_FILE_SIZE)}`;
  }
  return null;
};

export const validateTotalFileSize = (files: File[]): string | null => {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_TOTAL_SIZE) {
    return `Total file size (${formatFileSize(totalSize)}) exceeds maximum allowed size of ${formatFileSize(MAX_TOTAL_SIZE)}`;
  }
  return null;
};



