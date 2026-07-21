import apiClient from './axiosClient';
import { Notification } from '../../types';

export interface NotificationFilters {
  read?: boolean;
  type?: string;
  page?: number;
  pageSize?: number;
}

export interface NotificationListResponse {
  results: Notification[];
  count: number;
  next: string | null;
  previous: string | null;
  unreadCount: number;
}

class NotificationService {
  async getNotifications(userId: string, filters?: NotificationFilters): Promise<NotificationListResponse> {
    const params = new URLSearchParams({ user_id: userId });

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }

    return apiClient.get<NotificationListResponse>(`/api/v1/notifications/?${params.toString()}`);
  }

  async getUnreadCount(userId: string): Promise<number> {
    const response = await apiClient.get<{ count: number }>(`/api/v1/notifications/unread-count/?user_id=${userId}`);
    return response.count;
  }

  async markAsRead(id: string): Promise<Notification> {
    return apiClient.post<Notification>(`/api/v1/notifications/${id}/read/`);
  }

  async markAllAsRead(userId: string): Promise<void> {
    return apiClient.post(`/api/v1/notifications/mark-all-read/?user_id=${userId}`);
  }

  async deleteNotification(id: string): Promise<void> {
    return apiClient.delete(`/api/v1/notifications/${id}/`);
  }

  async deleteAllNotifications(userId: string): Promise<void> {
    return apiClient.delete(`/api/v1/notifications/delete-all/?user_id=${userId}`);
  }
}

export const notificationService = new NotificationService();
export default notificationService;
