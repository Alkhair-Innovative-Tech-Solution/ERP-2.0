/**
 * Ticket Type Definitions
 */

import { Comment } from './chat';

export type TicketStatus =
  | 'draft'
  | 'pending'
  | 'submitted'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'resolved'
  | 'closed'
  | 'postponed'
  | 'waiting_approval';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Ticket {
  id: string;
  ticketId: string;
  subject: string;
  description: string;
  department: string;
  priority: TicketPriority;
  category?: string;
  status: TicketStatus;
  requestorId: string;
  requestorName: string;
  assigneeId?: string;
  assigneeName?: string;
  moderatorId?: string;
  moderatorName?: string;
  submittedDate: string;
  assignedDate?: string;
  acknowledgedAt?: string; // Mapped from backend acknowledged_at
  completedDate?: string;
  resolvedDate?: string;
  completionNote?: string;
  completionImage?: string;
  attachments?: {
    id: string;
    name: string;
    url: string;
    size: number;
    type: string;
    uploadDate: string;
  }[];
  comments?: Comment[];
  rejectionReason?: string;
  isApproved?: boolean;
  reassignmentReason?: string;
  parentTicketId?: string; // For subtickets
  subtickets?: Ticket[]; // Array of subtickets
}

export interface TicketFilters {
  status?: TicketStatus | 'all';
  priority?: TicketPriority | 'all';
  department?: string | 'all';
  assigneeId?: string;
  requestorId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface TicketListResponse {
  results: Ticket[];
  count: number;
  next: string | null;
  previous: string | null;
}

export interface TicketStats {
  total: number;
  pending: number;
  assigned: number;
  inProgress: number;
  completed: number;
  resolved: number;
  rejected: number;
}

export interface TicketTimelineEvent {
  id: string;
  type: 'created' | 'assigned' | 'status_changed' | 'commented' | 'completed' | 'rejected' | 'approved';
  userId: string;
  userName: string;
  timestamp: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface Draft {
  id: string;
  subject: string;
  description: string;
  department: string;
  priority: TicketPriority;
  requestorId: string;
  requestorName: string;
  createdAt: string;
  updatedAt: string;
  attachments?: Array<{
    name: string;
    type: string;
    size: number;
    data: string; // base64 encoded
  }>;
}

