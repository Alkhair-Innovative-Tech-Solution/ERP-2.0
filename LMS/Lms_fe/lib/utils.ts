import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Shadcn-compatible cn utility: merges clsx conditions + resolves Tailwind conflicts
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  // Check if date is valid
  if (isNaN(d.getTime())) return 'Invalid Date';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (date: string | Date | null | undefined): string => {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  // Check if date is valid
  if (isNaN(d.getTime())) return 'Invalid Date';
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

export const getInitials = (firstName?: string, lastName?: string): string => {
  const first = firstName?.charAt(0).toUpperCase() || '';
  const last = lastName?.charAt(0).toUpperCase() || '';
  return first + last || 'U';
};

export const calculateDaysRemaining = (dueDate: string | Date | null | undefined): number => {
  if (!dueDate) return 0;
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const now = new Date();
  if (isNaN(due.getTime())) return 0;
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

