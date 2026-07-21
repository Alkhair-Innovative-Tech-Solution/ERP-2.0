/**
 * Chat and Comment Type Definitions
 */

export type CommentType = 
  | 'comment' 
  | 'status_update' 
  | 'assignment' 
  | 'completion' 
  | 'rejection' 
  | 'approval';

export interface Comment {
  id: string;
  ticketId: string;
  userId: string;
  userName: string;
  userRole?: string;
  employeeCode?: string;
  content: string;
  timestamp: string;
  type: CommentType;
  edited?: boolean;
  editedAt?: string;
  attachments?: ChatAttachment[];
}

export interface ChatMessage {
  id: string;
  ticketId: string;
  userId: string;
  userName: string;
  userRole: string;
  employeeCode?: string;
  message: string;
  timestamp: string;
  read: boolean;
  readAt?: string;
  attachments?: ChatAttachment[];
}

export interface ChatAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: string;
}

export interface ChatTyping {
  ticketId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

export interface ChatReadReceipt {
  messageId: string;
  userId: string;
  readAt: string;
}

export interface ChatRoom {
  ticketId: string;
  participants: string[]; // User IDs
  lastMessage?: ChatMessage;
  lastMessageAt?: string;
  unreadCount: number;
}

