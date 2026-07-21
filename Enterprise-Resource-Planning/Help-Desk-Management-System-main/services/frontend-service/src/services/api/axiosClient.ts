/**
 * Axios client configuration with interceptors
 * Handles authentication, error handling, and request/response transformation
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ENV } from '../../config/env';

// WebSocket Gateway URL
export const WS_GATEWAY_URL = ENV.WS_URL.replace('http', 'ws').replace('https', 'wss');

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: ENV.API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - Add auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // When sending FormData, remove the default application/json Content-Type
        // so the browser/XHR can set multipart/form-data with the correct boundary.
        if (config.data instanceof FormData && config.headers) {
          delete config.headers['Content-Type'];
        }

        const token = this.getToken();

        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
      },
      (error: AxiosError) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - Handle errors with token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Handle network errors (no response) - don't throw, let the calling code handle it
        if (!error.response && error.request) {
          // Network error - API might not be available
          // Return a formatted error that can be caught gracefully
          return Promise.reject(this.formatError(error));
        }

        // Handle 401 Unauthorized - Try token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          const refreshToken = this.getRefreshToken();

          if (refreshToken) {
            try {
              // Try to refresh the token
              const refreshResponse = await fetch(`${ENV.AUTH_SERVICE_URL}/api/auth/refresh`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refresh_token: refreshToken }),
              });

              if (refreshResponse.ok) {
                const data = await refreshResponse.json();
                const newAccessToken = data.access_token;

                // Store new token
                if (typeof window !== 'undefined') {
                  localStorage.setItem('token', newAccessToken);
                }

                // Retry original request with new token
                if (originalRequest.headers) {
                  originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                }
                return this.client(originalRequest);
              }
            } catch (refreshError) {
              console.error('Token refresh failed:', refreshError);
            }
          }

          // Refresh failed or no refresh token - clear auth and redirect
          this.clearAuth();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }

        // Handle 403 Forbidden
        if (error.response?.status === 403) {
          // Show permission denied message
          console.error('Permission denied');
        }

        // Handle 500 Server Error
        if (error.response?.status === 500) {
          console.error('Server error occurred:', error.response.statusText);
          console.error('Response Data:', error.response.data);
          console.error('Request URL:', error.config?.url);
        }

        return Promise.reject(this.formatError(error));
      }
    );
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }

  private getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refreshToken');
  }

  private clearAuth(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  private formatError(error: AxiosError): Error {
    // Handle response errors (API returned an error)
    if (error.response?.data) {
      const data = error.response.data as any;
      let message = data.message || data.detail || data.error || 'An error occurred';
      if (typeof message === 'object') {
        message = JSON.stringify(message);
      }
      const formattedError = new Error(message);
      (formattedError as any).status = error.response.status;
      (formattedError as any).response = error.response.data;
      return formattedError;
    }

    // Handle network errors (no response received)
    if (error.request) {
      const networkError = new Error('Network error. Please check your connection.');
      (networkError as any).isNetworkError = true;
      (networkError as any).code = error.code;
      return networkError;
    }

    // Handle other errors
    const otherError = new Error(error.message || 'An unexpected error occurred');
    (otherError as any).originalError = error;
    return otherError;
  }

  // Public methods
  get<T = any>(url: string, config?: any): Promise<T> {
    return this.client.get<T>(url, config).then(res => res.data);
  }

  post<T = any>(url: string, data?: any, config?: any): Promise<T> {
    return this.client.post<T>(url, data, config).then(res => res.data);
  }

  put<T = any>(url: string, data?: any, config?: any): Promise<T> {
    return this.client.put<T>(url, data, config).then(res => res.data);
  }

  patch<T = any>(url: string, data?: any, config?: any): Promise<T> {
    return this.client.patch<T>(url, data, config).then(res => res.data);
  }

  delete<T = any>(url: string, config?: any): Promise<T> {
    return this.client.delete<T>(url, config).then(res => res.data);
  }

  // File upload
  uploadFile<T = any>(url: string, file: File, onProgress?: (progress: number) => void): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    return this.client.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    }).then(res => res.data);
  }
}

export const apiClient = new ApiClient();
export default apiClient;
