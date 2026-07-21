/**
 * Auth Service Client
 * Handles all authentication operations with the auth-service backend
 */

import { ENV } from '../../config/env';

// ================== Types ==================

export interface LoginCredentials {
    employeeCode: string;
    password: string;
}

export interface UserPermissions {
    canViewAllTickets: boolean;
    canAssignTickets: boolean;
    canCloseTickets: boolean;
    canManageUsers: boolean;
}

export interface AuthUser {
    id: string;
    employeeId: string;
    employeeCode: string;
    name: string;
    email: string;
    department: string;
    role: 'admin' | 'moderator' | 'assignee' | 'requestor';
    permissions: UserPermissions;
}

export interface LoginResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: {
        id: string;
        employee_id: string;
        employee_code: string;
        name: string;
        email: string;
        department: string;
        role: string;
        permissions: {
            can_view_all_tickets: boolean;
            can_assign_tickets: boolean;
            can_close_tickets: boolean;
            can_manage_users: boolean;
        };
    };
}

export interface LoginError {
    error: 'invalid_credentials' | 'role_mismatch' | 'no_hdms_access' | 'no_hdms_role' | 'account_locked' | 'invalid_role';
    detail?: string;
    assigned_role?: string;
}

export interface LoginResult {
    success: boolean;
    user?: AuthUser;
    accessToken?: string;
    refreshToken?: string;
    error?: LoginError;
}

export interface RefreshResult {
    success: boolean;
    accessToken?: string;
    error?: string;
}

// ================== Auth Service Class ==================

class AuthService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = ENV.AUTH_SERVICE_URL;
    }

    /**
     * Login to HDMS with role validation
     */
    async login(credentials: LoginCredentials): Promise<LoginResult> {
        try {
            const response = await fetch(`${this.baseUrl}/api/auth/login-hdms`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    employee_code: credentials.employeeCode,
                    password: credentials.password,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                // Map backend response to frontend format
                const loginResponse = data as LoginResponse;
                const user: AuthUser = {
                    id: loginResponse.user.id,
                    employeeId: loginResponse.user.employee_id,
                    employeeCode: loginResponse.user.employee_code,
                    name: loginResponse.user.name,
                    email: loginResponse.user.email,
                    department: loginResponse.user.department,
                    role: loginResponse.user.role as AuthUser['role'],
                    permissions: {
                        canViewAllTickets: loginResponse.user.permissions.can_view_all_tickets,
                        canAssignTickets: loginResponse.user.permissions.can_assign_tickets,
                        canCloseTickets: loginResponse.user.permissions.can_close_tickets,
                        canManageUsers: loginResponse.user.permissions.can_manage_users,
                    },
                };

                return {
                    success: true,
                    user,
                    accessToken: loginResponse.access_token,
                    refreshToken: loginResponse.refresh_token,
                };
            } else {
                // Handle error response
                const errorData = data as any;
                let normalizedError: LoginError = {
                    error: errorData.error || 'invalid_credentials',
                    detail: typeof errorData.detail === 'string'
                        ? errorData.detail
                        : (errorData.detail ? JSON.stringify(errorData.detail) : 'Login failed'),
                    assigned_role: errorData.assigned_role
                };

                return {
                    success: false,
                    error: normalizedError,
                };
            }
        } catch (error) {
            console.error('Login request failed:', error);
            return {
                success: false,
                error: {
                    error: 'invalid_credentials',
                    detail: 'Network error. Please check your connection.',
                },
            };
        }
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshToken(refreshToken: string): Promise<RefreshResult> {
        try {
            const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    refresh_token: refreshToken,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                return {
                    success: true,
                    accessToken: data.access_token,
                };
            } else {
                return {
                    success: false,
                    error: 'Token refresh failed',
                };
            }
        } catch (error) {
            console.error('Token refresh failed:', error);
            return {
                success: false,
                error: 'Network error during token refresh',
            };
        }
    }

    /**
     * Logout - blacklist token and clear local storage
     */
    async logout(): Promise<void> {
        const accessToken = localStorage.getItem('token');

        if (accessToken) {
            try {
                await fetch(`${this.baseUrl}/api/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({ access_token: accessToken }),
                });
            } catch (error) {
                // Continue with local logout even if backend fails
                console.error('Backend logout failed:', error);
            }
        }

        // Clear local storage
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
    }

    /**
     * Get current user from token
     */
    async getCurrentUser(): Promise<AuthUser | null> {
        const accessToken = localStorage.getItem('token');

        if (!accessToken) {
            return null;
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/auth/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                // Note: /me endpoint returns different format, need to get role from stored user
                const storedUser = localStorage.getItem('user');
                if (storedUser) {
                    return JSON.parse(storedUser) as AuthUser;
                }
                return null;
            } else {
                return null;
            }
        } catch (error) {
            console.error('Get current user failed:', error);
            return null;
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        return !!localStorage.getItem('token');
    }

    /**
     * Get stored access token
     */
    getAccessToken(): string | null {
        return localStorage.getItem('token');
    }

    /**
     * Get stored refresh token
     */
    getRefreshToken(): string | null {
        return localStorage.getItem('refreshToken');
    }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;
