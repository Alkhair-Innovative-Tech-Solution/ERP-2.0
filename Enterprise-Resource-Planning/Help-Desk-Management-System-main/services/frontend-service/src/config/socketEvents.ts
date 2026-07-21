/**
 * WebSocket Event Constants
 * Centralized socket event names for type safety
 */

export const SOCKET_EVENTS = {
  // Connection Events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  RECONNECT: 'reconnect',
  
  // Chat Events
  CHAT_MESSAGE: 'chat_message',
  CHAT_TYPING: 'chat_typing',
  CHAT_READ: 'chat_read',
  
  // Notification Events
  NOTIFICATION_NEW: 'notification_new',
  NOTIFICATION_READ: 'notification_read',
  NOTIFICATION_DELETE: 'notification_delete',
  
  // Ticket Events
  TICKET_CREATED: 'ticket_created',
  TICKET_UPDATED: 'ticket_updated',
  TICKET_ASSIGNED: 'ticket_assigned',
  TICKET_STATUS_CHANGED: 'ticket_status_changed',
  TICKET_PRIORITY_CHANGED: 'ticket_priority_changed',
  TICKET_COMMENT_ADDED: 'ticket_comment_added',
  
  // User Events
  USER_ONLINE: 'user_online',
  USER_OFFLINE: 'user_offline',
  USER_TYPING: 'user_typing',
} as const;

export type SocketEvent = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];

// Event payload types
export interface ChatMessagePayload {
  ticketId: string;
  message: string;
  userId: string;
  userName: string;
  timestamp: string;
}

export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  message: string;
  ticketId?: string;
  timestamp: string;
}

export interface TicketUpdatePayload {
  ticketId: string;
  changes: Record<string, any>;
  updatedBy: string;
  timestamp: string;
}

