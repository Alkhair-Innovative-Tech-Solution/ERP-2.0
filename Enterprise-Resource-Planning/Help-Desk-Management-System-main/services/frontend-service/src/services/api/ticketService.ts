/**
 * Ticket Service
 * All ticket-related API calls
 */

import apiClient from './axiosClient';
import { Ticket, Comment, ChatMessage } from '../../types';
import { ENV } from '../../config/env';

import { fileService } from './fileService';

export interface AuditLogEntry {
  id: string;
  action_type: string;
  category: string;
  model_name: string;
  object_id: string;
  performed_by_id: string | null;
  old_state: any;
  new_state: any;
  changes: any;
  reason: string;
  timestamp: string;
}

export interface CreateTicketData {
  subject: string;
  description: string;
  department: string; // name
  departmentId?: string; // id
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  status?: string;
  requestorId: string;
  attachments?: File[];
  attachmentIds?: string[]; // IDs of files already uploaded to file-service
}

export interface UpdateTicketData {
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  assignee_id?: string;
  department_id?: string;
  status?: string;
}

export interface TicketFilters {
  status?: string;
  priority?: string;
  department?: string;
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

class TicketService {
  private departmentCache: Map<string, string> = new Map();
  private employeeCache: Map<string, { name: string; code: string }> = new Map();

  // Helper: Map Backend API Response to Frontend Ticket
  private async mapToTicket(data: any): Promise<Ticket> {
    // Get department name if not cached
    let deptDisplay = data.department_id || 'Unknown';
    if (data.department_id && !this.departmentCache.has(data.department_id)) {
      try {
        const deptService = (await import('./departmentService')).default;
        const depts = await deptService.getDepartments();
        depts.forEach(d => {
          this.departmentCache.set(d.id, `${d.dept_code} | ${d.dept_name}`);
        });
      } catch (error) {
        console.warn('Failed to fetch departments', error);
      }
    }
    deptDisplay = this.departmentCache.get(data.department_id) || deptDisplay;

    // Get requestor name + employee code if not cached
    let requestorName = 'Unknown User';
    if (data.requestor_id) {
      if (!this.employeeCache.has(data.requestor_id)) {
        try {
          const response = await apiClient.get<any>(`${ENV.AUTH_SERVICE_URL}/api/employees/employees/by-user/${data.requestor_id}`);
          if (response && response.employee_id) {
            const employee = response;
            this.employeeCache.set(data.requestor_id, {
              name: employee.full_name,
              code: employee.employee_code || employee.employee_id || 'N/A'
            });
          } else {
            // Fallback if not found
            this.employeeCache.set(data.requestor_id, {
              name: 'User',
              code: data.requestor_id.slice(0, 8).toUpperCase()
            });
          }
        } catch (error) {
          // Silently fail and use fallback
          console.warn('Failed to fetch requestor info for', data.requestor_id);
          this.employeeCache.set(data.requestor_id, {
            name: 'User',
            code: data.requestor_id.slice(0, 8).toUpperCase()
          });
        }
      }
      const requestorInfo = this.employeeCache.get(data.requestor_id);
      if (requestorInfo) {
        requestorName = requestorInfo.name;
      }
    }

    // Fetch assignee name if ticket has one
    let assigneeName: string | undefined;
    if (data.assignee_id) {
      if (!this.employeeCache.has(data.assignee_id)) {
        try {
          const response = await apiClient.get<any>(`${ENV.AUTH_SERVICE_URL}/api/employees/employees/by-user/${data.assignee_id}`);
          if (response && response.employee_id) {
            this.employeeCache.set(data.assignee_id, {
              name: response.full_name,
              code: response.employee_code || response.employee_id || 'N/A'
            });
          } else {
            this.employeeCache.set(data.assignee_id, {
              name: 'Assignee',
              code: data.assignee_id.slice(0, 8).toUpperCase()
            });
          }
        } catch {
          this.employeeCache.set(data.assignee_id, {
            name: 'Assignee',
            code: data.assignee_id.slice(0, 8).toUpperCase()
          });
        }
      }
      const assigneeInfo = this.employeeCache.get(data.assignee_id);
      if (assigneeInfo) assigneeName = assigneeInfo.name;
    }

    const mappedAttachments = (data.attachments || []).map((att: any) => ({
      id: att.id,
      name: att.filename,
      url: att.file_id ? fileService.getFileUrl(att.file_id) : (att.file || ''),
      size: att.file_size,
      type: att.content_type,
      uploadDate: att.created_at,
    }));

    return {
      id: data.id,
      ticketId: data.ticket_id
        ? data.ticket_id
        : (data.status === 'draft'
          ? `D-${data.version || 1}`
          : `#${data.id.slice(0, 8).toUpperCase()}`),
      subject: data.title,
      description: data.description,
      department: deptDisplay,
      priority: data.priority,
      category: data.category,
      status: data.status,
      requestorId: data.requestor_id,
      requestorName: requestorName,
      assigneeId: data.assignee_id ? String(data.assignee_id) : undefined,
      assigneeName: assigneeName,
      submittedDate: data.created_at,
      assignedDate: null,
      attachments: mappedAttachments,
      acknowledgedAt: data.acknowledged_at,
    };
  }

  // Get all tickets with filters
  async getTickets(filters?: TicketFilters): Promise<TicketListResponse> {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.status) params.append('status', filters.status);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.requestorId) params.append('requestor_id', filters.requestorId);
      if (filters.assigneeId) params.append('assignee_id', filters.assigneeId);
      if (filters.search) params.append('search', filters.search);
      if (filters.page) params.append('page', String(filters.page));
      if (filters.pageSize) params.append('page_size', String(filters.pageSize));
    }

    const response = await apiClient.get<any>(`${ENV.TICKET_SERVICE_URL}/api/v1/tickets/`, {
      params: Object.fromEntries(params.entries())
    });

    // Handle both paginated { count, results } and legacy flat array responses
    const rawList: any[] = Array.isArray(response) ? response : (response?.results ?? []);
    const count: number = Array.isArray(response) ? response.length : (response?.count ?? rawList.length);
    const tickets = await Promise.all(rawList.map(data => this.mapToTicket(data)));

    return { results: tickets, count, next: null, previous: null };
  }

  // Get single ticket by ID
  async getTicketById(id: string): Promise<Ticket> {
    const response = await apiClient.get<any>(`${ENV.TICKET_SERVICE_URL}/api/v1/tickets/${id}`);
    return await this.mapToTicket(response);
  }

  // Create new ticket
  async createTicket(data: CreateTicketData): Promise<Ticket> {
    try {
      const payload = {
        title: data.subject,
        description: data.description,
        department_id: data.departmentId || '00000000-0000-0000-0000-000000000000', // Mock/Placeholder if not provided
        priority: data.priority,
        category: data.category || '',
        requestor_id: data.requestorId, // Should come from auth context
        status: data.status || 'draft'
      };

      const ticketResponse = await apiClient.post<any>(`${ENV.TICKET_SERVICE_URL}/api/v1/tickets/`, payload);

      // Handle attachments - Use pre-uploaded attachmentIds from NewRequestPage
      const allAttachmentIds: string[] = data.attachmentIds || [];

      // Link all attachments to the ticket in ticket-service
      if (allAttachmentIds.length > 0) {
        await Promise.all(allAttachmentIds.map(async (fileId) => {
          // We need metadata from file-service or assume it was provided.
          // For now, we link by fileId. The backend should handle metadata fetch or we fetch here if needed.
          // Based on current backend implementation, we pass the file_id.
          await apiClient.post(`${ENV.TICKET_SERVICE_URL}/api/v1/tickets/${ticketResponse.id}/attachments`, {
            file_id: fileId,
            // Backend might need filename/size/type, so we fallback or hope the endpoint is smart
            filename: 'attachment', 
            file_size: 0,
            content_type: 'application/octet-stream'
          });
        }));
      }

      return this.mapToTicket(ticketResponse);
    } catch (error) {
      console.error('Create ticket failed:', error);
      throw error; // Let UI handle error
    }
  }

  // Update ticket
  async updateTicket(id: string, data: UpdateTicketData): Promise<Ticket> {
    try {
      const response = await apiClient.patch<any>(
        `${ENV.TICKET_SERVICE_URL}/api/v1/tickets/${id}`,
        data
      );
      return this.mapToTicket(response);
    } catch (error) {
      console.error('Update ticket failed:', error);
      throw error;
    }
  }

  // Delete ticket
  async deleteTicket(id: string): Promise<void> {
    return apiClient.delete(`${ENV.TICKET_SERVICE_URL}/api/v1/tickets/${id}`);
  }

  // Assign ticket to an assignee
  async assignTicket(ticketId: string, assigneeId: string, departmentId?: string): Promise<Ticket> {
    try {
      const response = await apiClient.post<any>(
        `${ENV.TICKET_SERVICE_URL}/api/v1/tickets/${ticketId}/assign`,
        { assignee_id: assigneeId, department_id: departmentId }
      );
      return this.mapToTicket(response);
    } catch (error) {
      console.error('Assign ticket failed:', error);
      throw error;
    }
  }

  // Confirm Initial Review (Moderate & Assign)
  async confirmReview(ticketId: string, data: {
    title: string;
    description: string;
    priority: string;
    category: string;
    assignee_id: string;
    department_id?: string;
  }): Promise<Ticket> {
    try {
      const response = await apiClient.post<any>(
        `${ENV.TICKET_SERVICE_URL}/api/v1/tickets/${ticketId}/confirm-review`,
        data
      );
      return await this.mapToTicket(response);
    } catch (error) {
      console.error('Confirm review failed:', error);
      throw error;
    }
  }

  // Reassign ticket
  async reassignTicket(ticketId: string, assigneeId: string, reason: string): Promise<Ticket> {
    // Use assign endpoint with new assignee
    return this.assignTicket(ticketId, assigneeId);
  }

  // Change ticket status
  async changeStatus(ticketId: string, status: string, reason?: string): Promise<Ticket> {
    // Map frontend status to backend FSM action names
    const actionMap: Record<string, string> = {
      'in_progress': 'start_progress',
      'resolved': 'resolve',
      'completed': 'resolve',  // 'completed' also maps to resolve
      'closed': 'close',
      'submitted': 'submit',
      'assigned': 'assign',
      'rejected': 'reject',
      'waiting_approval': 'review',
    };

    const action = actionMap[status] || status;

    const data = await apiClient.post(`${ENV.TICKET_SERVICE_URL}/api/v1/tickets/${ticketId}/status`, {
      action,
      reason,
    });
    return this.mapToTicket(data);
  }

  // Change ticket priority
  async changePriority(ticketId: string, priority: string): Promise<Ticket> {
    return this.updateTicket(ticketId, { priority: priority as any });
  }

  // Submit ticket (draft -> submitted)
  async submitTicket(ticketId: string): Promise<Ticket> {
    return this.changeStatus(ticketId, 'submitted');
  }

  // Add comment / chat message
  async addComment(ticketId: string, content: string): Promise<Comment> {
    try {
      // Get current user for sender_id
      const userStr = localStorage.getItem('user');
      let senderId = '00000000-0000-0000-0000-000000000000'; // System/Default
      let senderName = 'System';

      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          senderId = user.id;
          senderName = user.name;
        } catch (e) {
          console.warn('Failed to parse user from localStorage');
        }
      }

      // If content starts with [System], it might be a system message
      // The backend doesn't distinguishing yet, but we can treat all as chat messages

      const response = await apiClient.post<any>(`${ENV.COMMUNICATION_SERVICE_URL}/api/v1/chat/messages`, {
        ticket_id: ticketId,
        message: content,
        mentions: []
      });

      // Map response to Comment/ChatMessage
      return {
        id: response.id,
        ticketId: response.ticket_id,
        userId: response.sender_id,
        userName: senderName, // We use the name we have, as backend doesn't return it yet
        userRole: 'system', // TODO: Determine role
        content: response.message,
        timestamp: response.created_at,
        type: 'comment',
      };
    } catch (error) {
      console.error('Add comment failed:', error);
      throw error;
    }
  }

  // Get comments / chat messages
  async getComments(ticketId: string): Promise<Comment[]> {
    try {
      const response = await apiClient.get<any[]>(`${ENV.COMMUNICATION_SERVICE_URL}/api/v1/chat/messages/ticket/${ticketId}`);

      // Map response to Comment[] - API now includes sender_name, sender_role, employee_code
      const comments = response.map((msg) => ({
        id: msg.id,
        ticketId: msg.ticket_id,
        userId: msg.sender_id,
        userName: msg.sender_name || 'Unknown',
        userRole: msg.sender_role || 'user',
        employeeCode: msg.employee_code,
        content: msg.message,
        timestamp: msg.created_at,
        type: 'comment' as const,
      }));

      return comments;
    } catch (error) {
      console.warn('Get comments failed, falling back to empty:', error);
      return [];
    }
  }

  // Approve ticket
  async approveTicket(ticketId: string): Promise<Ticket> {
    // Backend uses status update for approval flow
    return this.changeStatus(ticketId, 'approved');
  }

  // Reject ticket with reason
  async rejectTicket(ticketId: string, reason: string): Promise<Ticket> {
    try {
      const response = await apiClient.post<any>(
        `${ENV.TICKET_SERVICE_URL}/api/v1/tickets/${ticketId}/reject`,
        { reason }
      );
      return await this.mapToTicket(response);
    } catch (error) {
      console.error('Reject ticket failed:', error);
      throw error;
    }
  }

  // Postpone ticket with reason
  async postponeTicket(ticketId: string, reason: string): Promise<Ticket> {
    try {
      const response = await apiClient.post<any>(
        `${ENV.TICKET_SERVICE_URL}/api/v1/tickets/${ticketId}/postpone`,
        { reason }
      );
      return await this.mapToTicket(response);
    } catch (error) {
      console.error('Postpone ticket failed:', error);
      throw error;
    }
  }

  // Join Sub-Ticket
  async joinSubTicket(ticketId: string): Promise<Ticket> {
    // TODO: Implement
    return this.getTicketById(ticketId);
  }

  // Acknowledge ticket
  async acknowledgeTicket(ticketId: string, notes?: string): Promise<Ticket> {
    try {
      const response = await apiClient.patch<any>(
        `${ENV.TICKET_SERVICE_URL}/api/v1/tickets/${ticketId}/acknowledge`,
        { notes }
      );
      return await this.mapToTicket(response);
    } catch (error) {
      console.error('Acknowledge ticket failed:', error);
      throw error;
    }
  }

  // Update progress
  async updateProgress(ticketId: string, progressPercentage: number): Promise<Ticket> {
    try {
      const response = await apiClient.patch<any>(
        `${ENV.TICKET_SERVICE_URL}/api/v1/tickets/${ticketId}/progress`,
        { progress_percent: progressPercentage }
      );
      return await this.mapToTicket(response);
    } catch (error) {
      console.error('Update progress failed:', error);
      throw error;
    }
  }

  // Update SLA
  async updateSLA(ticketId: string, dueAt: string, reason: string): Promise<Ticket> {
    try {
      const response = await apiClient.patch<any>(
        `${ENV.TICKET_SERVICE_URL}/api/v1/tickets/${ticketId}/sla`,
        { due_at: dueAt, reason }
      );
      return await this.mapToTicket(response);
    } catch (error) {
      console.error('Update SLA failed:', error);
      throw error;
    }
  }

  // Get Ticket History (Audit Log)
  async getHistory(ticketId: string): Promise<AuditLogEntry[]> {
    try {
      return await apiClient.get<AuditLogEntry[]>(
        `${ENV.TICKET_SERVICE_URL}/api/v1/tickets/${ticketId}/history`
      );
    } catch (error) {
      console.error('Get history failed:', error);
      return [];
    }
  }

  // Complete ticket
  async completeTicket(ticketId: string, note: string, image?: File): Promise<Ticket> {
    // 1. Upload image if exists
    if (image) {
      const uploadRes = await fileService.uploadFile(image, 'completion_proof', ticketId);

      // Add attachment reference
      await apiClient.post(`${ENV.TICKET_SERVICE_URL}/api/v1/tickets/${ticketId}/attachments`, {
        file_id: uploadRes.id,
        filename: uploadRes.filename,
        file_size: uploadRes.size,
        content_type: uploadRes.content_type
      });
    }

    // 2. Call status update to 'resolve'
    try {
      const response = await apiClient.post<any>(`${ENV.TICKET_SERVICE_URL}/api/v1/tickets/${ticketId}/status`, {
        action: 'resolve',
        reason: note
      });
      return await this.mapToTicket(response);
    } catch (error) {
      console.error('Complete ticket failed:', error);
      throw error;
    }
  }

  // Split ticket into subtickets
  async splitTicket(ticketId: string, subtickets: Array<{ subject: string; description: string }>): Promise<Ticket> {
    return apiClient.post<Ticket>(`${ENV.TICKET_SERVICE_URL}/api/v1/tickets/${ticketId}/split`, {
      subtickets,
    });
  }

  // Get ticket statistics
  async getStatistics(role?: string): Promise<any> {
    const params = role ? `?role=${role}` : '';
    return apiClient.get(`${ENV.TICKET_SERVICE_URL}/api/v1/tickets/statistics${params}`);
  }
}

export const ticketService = new TicketService();
export default ticketService;
