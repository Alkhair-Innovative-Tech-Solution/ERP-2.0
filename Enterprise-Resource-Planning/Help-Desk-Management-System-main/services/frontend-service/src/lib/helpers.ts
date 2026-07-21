import { TICKET_STATUS, TICKET_PRIORITY, ROLES } from './constants';
import { THEME } from './theme';
import { Clock, CheckCircle, XCircle, AlertCircle, Loader } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

export const formatDate = (dateString: string | Date, format: 'short' | 'long' | 'time' = 'short'): string => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  if (isNaN(date.getTime())) return 'Invalid Date';
  
  const formatOptions: Record<'short' | 'long' | 'time', Intl.DateTimeFormatOptions> = {
    short: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' },
    time: { hour: '2-digit', minute: '2-digit' },
  };
  
  const options = formatOptions[format];
  return new Intl.DateTimeFormat('en-US', options).format(date);
};

export const formatRelativeTime = (dateString: string | Date): string => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  
  const diffDays = Math.floor(diffInSeconds / 86400);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  
  return formatDate(date, 'short');
};

export const getStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    'draft': '#9ca3af',
    'pending': '#fbbf24',
    'submitted': '#60a5fa',
    'assigned': '#60a5fa',
    'in_progress': '#3b82f6',
    'completed': '#22c55e',
    'resolved': '#34d399',
    'closed': '#6b7280',
    'rejected': '#ef4444',
  };
  return statusColors[status.toLowerCase()] || '#6b7280';
};

export const getStatusColorClasses = (status: string): string => {
  const statusColors: Record<string, string> = {
    [TICKET_STATUS.PENDING]: `bg-yellow-100 text-yellow-800`,
    [TICKET_STATUS.ASSIGNED]: `bg-blue-100 text-blue-800`,
    [TICKET_STATUS.IN_PROGRESS]: `bg-indigo-100 text-indigo-800`,
    [TICKET_STATUS.COMPLETED]: `bg-green-100 text-green-800`,
    [TICKET_STATUS.REJECTED]: `bg-red-100 text-red-800`,
    [TICKET_STATUS.RESOLVED]: `bg-green-100 text-green-800`,
  };
  return statusColors[status] || `bg-gray-100 text-gray-800`;
};

export const getStatusIcon = (status: string): LucideIcon => {
  const statusIcons: Record<string, LucideIcon> = {
    [TICKET_STATUS.PENDING]: Clock,
    [TICKET_STATUS.ASSIGNED]: AlertCircle,
    [TICKET_STATUS.IN_PROGRESS]: Loader,
    [TICKET_STATUS.COMPLETED]: CheckCircle,
    [TICKET_STATUS.REJECTED]: XCircle,
    [TICKET_STATUS.RESOLVED]: CheckCircle,
  };
  return statusIcons[status] || AlertCircle;
};

export const getStatusBorderColor = (status: string): string => {
  const borderColors: Record<string, string> = {
    [TICKET_STATUS.PENDING]: 'border-yellow-300',
    [TICKET_STATUS.ASSIGNED]: 'border-blue-300',
    [TICKET_STATUS.IN_PROGRESS]: 'border-indigo-300',
    [TICKET_STATUS.COMPLETED]: 'border-green-300',
    [TICKET_STATUS.REJECTED]: 'border-red-300',
    [TICKET_STATUS.RESOLVED]: 'border-green-300',
  };
  return borderColors[status] || 'border-gray-300';
};

export const getPriorityColor = (priority: string): string => {
  const classes: Record<string, string> = {
    'high': 'bg-red-500 text-white',
    'medium': 'bg-yellow-500 text-black',
    'low': 'bg-green-500 text-white',
    'urgent': 'bg-red-700 text-white',
  };
  return classes[priority.toLowerCase()] || 'bg-gray-500 text-white';
};

export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    'draft': 'Draft',
    'pending': 'Pending',
    'submitted': 'Submitted',
    'assigned': 'Assigned',
    'in_progress': 'In Progress',
    'completed': 'Completed',
    'resolved': 'Resolved',
    'closed': 'Closed',
    'rejected': 'Rejected',
  };
  return labels[status.toLowerCase()] || status;
};

export const getPriorityLabel = (priority: string): string => {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
};

export const truncateText = (text: string, maxLength: number = 100): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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
  
  return { valid: errors.length === 0, errors };
};

export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const getAvatarColor = (name: string): string => {
  const colors = [
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#f59e0b', // amber
    '#10b981', // green
    '#ef4444', // red
    '#06b6d4', // cyan
    '#6366f1', // indigo
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

export const generateTicketId = (): string => {
  const prefix = 'TKT';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

export const canAccessRoute = (userRole: string, requiredRole: string | string[]): boolean => {
  if (Array.isArray(requiredRole)) {
    return requiredRole.includes(userRole);
  }
  return userRole === requiredRole;
};

export const sortByDate = <T extends { [key: string]: any }>(
  array: T[],
  dateField: keyof T,
  order: 'asc' | 'desc' = 'desc'
): T[] => {
  return [...array].sort((a, b) => {
    const dateA = new Date(a[dateField] as string).getTime();
    const dateB = new Date(b[dateField] as string).getTime();
    return order === 'asc' ? dateA - dateB : dateB - dateA;
  });
};

export const filterTickets = <T extends { status?: string; priority?: string; department?: string }>(
  tickets: T[],
  filters: {
    status?: string;
    priority?: string;
    department?: string;
    search?: string;
  }
): T[] => {
  return tickets.filter(ticket => {
    if (filters.status && ticket.status !== filters.status) return false;
    if (filters.priority && ticket.priority !== filters.priority) return false;
    if (filters.department && ticket.department !== filters.department) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const searchableFields = Object.values(ticket).join(' ').toLowerCase();
      if (!searchableFields.includes(searchLower)) return false;
    }
    return true;
  });
};

