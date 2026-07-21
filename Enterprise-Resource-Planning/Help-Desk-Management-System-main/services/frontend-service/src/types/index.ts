/**
 * Type Definitions - Central Export
 * Re-export all types from individual files
 */

// User Types
export type {
  User,
  UserRole,
  UserProfile,
  UserStats,
} from './user';

// Ticket Types
export type {
  Ticket,
  TicketStatus,
  TicketPriority,
  TicketFilters,
  TicketListResponse,
  TicketStats,
  TicketTimelineEvent,
  Draft,
} from './ticket';

// Chat Types
export type {
  Comment,
  CommentType,
  ChatMessage,
  ChatAttachment,
  ChatTyping,
  ChatReadReceipt,
  ChatRoom,
} from './chat';

// Notification Types
export type {
  Notification,
  NotificationType,
  NotificationPreferences,
  NotificationStats,
  NotificationListResponse,
} from './notification';

// Dashboard & Analytics Types
export interface DashboardStats {
  totalRequests: number;
  pendingRequests: number;
  resolvedRequests: number;
  rejectedRequests: number;
  avgResolutionTime: string;
  satisfactionRating: number;
  inProgressRequests?: number;
  assignedTickets?: number;
}

export interface AnalyticsData {
  departmentLoad: Array<{
    department: string;
    assigned: number;
    completed: number;
    pending: number;
  }>;
  priorityTrend: Array<{
    date: string;
    low: number;
    medium: number;
    high: number;
    urgent: number;
  }>;
  ticketVolume: Array<{
    date: string;
    created: number;
    resolved: number;
  }>;
  statusDistribution: Array<{
    status: string;
    count: number;
  }>;
  resolutionTime: {
    average: number;
    median: number;
    byDepartment: Record<string, number>;
  };
  satisfactionRating: {
    average: number;
    total: number;
  };
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
}

export interface ApiError {
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
  statusCode?: number;
}

// Form Types
export interface FormErrors {
  [key: string]: string | undefined;
}

export interface FormState<T> {
  data: T;
  errors: FormErrors;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
}
