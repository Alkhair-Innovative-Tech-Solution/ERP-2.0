/**
 * Analytics Service
 * All analytics and reporting API calls
 */

import apiClient from './axiosClient';

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

class AnalyticsService {
  // Get dashboard statistics
  async getDashboardStats(role?: string): Promise<DashboardStats> {
    const url = role ? `/api/analytics/dashboard/${role}/` : '/api/analytics/dashboard/';
    return apiClient.get<DashboardStats>(url);
  }

  // Get comprehensive analytics
  async getAnalytics(filters?: {
    startDate?: string;
    endDate?: string;
    department?: string;
  }): Promise<AnalyticsData> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value);
        }
      });
    }
    
    return apiClient.get<AnalyticsData>(`/api/analytics/?${params.toString()}`);
  }

  // Get department load
  async getDepartmentLoad(): Promise<AnalyticsData['departmentLoad']> {
    return apiClient.get('/api/analytics/department-load/');
  }

  // Get priority trends
  async getPriorityTrends(period: 'week' | 'month' | 'year' = 'month'): Promise<AnalyticsData['priorityTrend']> {
    return apiClient.get(`/api/analytics/priority-trends/?period=${period}`);
  }

  // Get ticket volume
  async getTicketVolume(period: 'week' | 'month' | 'year' = 'month'): Promise<AnalyticsData['ticketVolume']> {
    return apiClient.get(`/api/analytics/ticket-volume/?period=${period}`);
  }

  // Get status distribution
  async getStatusDistribution(): Promise<AnalyticsData['statusDistribution']> {
    return apiClient.get('/api/analytics/status-distribution/');
  }

  // Get resolution time analytics
  async getResolutionTime(): Promise<AnalyticsData['resolutionTime']> {
    return apiClient.get('/api/analytics/resolution-time/');
  }

  // Get satisfaction rating
  async getSatisfactionRating(): Promise<AnalyticsData['satisfactionRating']> {
    return apiClient.get('/api/analytics/satisfaction/');
  }

  // Export report
  async exportReport(format: 'csv' | 'pdf' | 'xlsx', filters?: any): Promise<Blob> {
    const params = new URLSearchParams();
    params.append('format', format);
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.append(key, String(value));
        }
      });
    }
    
    return apiClient.get(`/api/analytics/export/?${params.toString()}`, {
      responseType: 'blob',
    });
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;

