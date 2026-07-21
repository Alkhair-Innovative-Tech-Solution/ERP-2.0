export const ROLES = {
  REQUESTOR: 'requestor',
  MODERATOR: 'moderator',
  ASSIGNEE: 'assignee',
  ADMIN: 'admin',
} as const;

export const TICKET_STATUS = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  RESOLVED: 'resolved',
} as const;

export const TICKET_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export const NOTIFICATION_TYPES = {
  TICKET_ASSIGNED: 'ticket_assigned',
  TICKET_COMPLETED: 'ticket_completed',
  TICKET_REJECTED: 'ticket_rejected',
  NEW_COMMENT: 'new_comment',
  TICKET_APPROVED: 'ticket_approved',
  SUCCESS: 'success',
  WARNING: 'warning',
  INFO: 'info',
} as const;

export const API_ENDPOINTS = {
  LOGIN: '/api/users/login/',
  REGISTER: '/api/users/register/',
  FORGOT_PASSWORD: '/api/users/forgot-password/',
  RESET_PASSWORD: '/api/users/reset-password/',
  TICKETS: '/api/tickets/',
  USERS: '/api/users/',
  ANALYTICS: '/api/analytics/',
  NOTIFICATIONS: '/api/notifications/',
} as const;

export const ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  DASHBOARD: (role: string) => `/${role}/dashboard`,
  REQUESTS: (role: string) => `/${role}/requests`,
  PROFILE: (role: string) => `/${role}/profile`,
} as const;

export const DATE_FORMATS = {
  DISPLAY: 'MMM DD, YYYY',
  DATETIME: 'MMM DD, YYYY HH:mm',
  TIME: 'HH:mm',
} as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
} as const;

export const DEPARTMENTS = [
  'Development',
  'Finance & Accounts',
  'Procurement',
  'Basic Maintenance',
  'IT',
  'Architecture',
  'Administration',
] as const;

