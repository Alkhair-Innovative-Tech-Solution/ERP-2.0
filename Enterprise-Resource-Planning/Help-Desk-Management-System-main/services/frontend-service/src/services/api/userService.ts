/**
 * User Service
 * All user-related API calls
 */

import apiClient from './axiosClient';
import { User } from '../../types';

export interface LoginData {
  email: string;
  password: string;
  role: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  employeeCode: string;
  department: string;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  department?: string;
  avatar?: File;
  role?: 'requestor' | 'moderator' | 'assignee' | 'admin';
  status?: 'active' | 'inactive' | 'pending';
}

export interface UserFilters {
  role?: string;
  department?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface UserListResponse {
  results: User[];
  count: number;
  next: string | null;
  previous: string | null;
}

class UserService {
  // Login
  async login(data: LoginData): Promise<{ user: User; token: string }> {
    return apiClient.post<{ user: User; token: string }>('/api/users/login/', data);
  }

  // Register
  async register(data: RegisterData): Promise<{ user: User; token: string }> {
    return apiClient.post<{ user: User; token: string }>('/api/users/register/', data);
  }

  // Get current user
  async getCurrentUser(): Promise<User> {
    return apiClient.get<User>('/api/users/me/');
  }

  // Get all users
  async getUsers(filters?: UserFilters): Promise<UserListResponse> {
    const params = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }

    const response = await apiClient.get<any>(`/api/permissions/hdms-users?${params.toString()}`);

    // Map backend snake_case to frontend camelCase
    const mappedResults = (response.results || []).map((user: any) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department, // Backend sends dept_name as 'department'
      status: user.status,
      employeeCode: user.employee_code,
      phone: user.phone,
      lastLogin: user.last_login,
      joinDate: user.join_date,
    }));

    return {
      results: mappedResults,
      count: response.count,
      next: null,
      previous: null
    };
  }

  // Get user by ID
  async getUserById(id: string): Promise<User> {
    return apiClient.get<User>(`/api/users/${id}/`);
  }

  // Update user
  async updateUser(id: string, data: UpdateUserData): Promise<User> {
    const formData = new FormData();

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (value instanceof File) {
          formData.append(key, value);
        } else {
          formData.append(key, String(value));
        }
      }
    });

    return apiClient.patch<User>(`/api/users/${id}/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  // Delete user
  async deleteUser(id: string): Promise<void> {
    return apiClient.delete(`/api/users/${id}/`);
  }

  // Change password
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    return apiClient.post('/api/users/change-password/', {
      oldPassword,
      newPassword,
    });
  }

  // Forgot password
  async forgotPassword(email: string): Promise<void> {
    return apiClient.post('/api/users/forgot-password/', { email });
  }

  // Reset password
  async resetPassword(token: string, newPassword: string): Promise<void> {
    return apiClient.post('/api/users/reset-password/', {
      token,
      newPassword,
    });
  }

  // Get user departments
  async getDepartments(): Promise<string[]> {
    return apiClient.get<string[]>('/api/users/departments/');
  }
}

export const userService = new UserService();
export default userService;

