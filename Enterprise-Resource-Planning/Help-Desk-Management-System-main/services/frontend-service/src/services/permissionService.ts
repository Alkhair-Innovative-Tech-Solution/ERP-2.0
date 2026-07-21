/**
 * Permission Service
 * Handles API calls for granting service access and permissions
 */

const API_BASE_URL = '/api'; // Relative URL — proxied by Next.js rewrites to auth_service container

export interface HdmsAccessData {
    employee_id: string;
    password: string;
    role: 'requestor' | 'moderator' | 'assignee';
    change_password?: boolean;
}

export interface HdmsAccessStatus {
    has_access: boolean;
    role: string | null;
    employee_id: string;
    employee_code: string;
    full_name: string;
}

export interface ApiResponse<T> {
    data: T | null;
    error: string | null;
    isOffline: boolean;
}

/**
 * Validate password meets requirements
 * - Alphanumeric only
 * - At least 6 characters
 * - At least 1 uppercase
 * - At least 1 lowercase
 */
export function validatePassword(password: string): { valid: boolean; error: string | null } {
    if (password.length < 6) {
        return { valid: false, error: 'Password must be at least 6 characters' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, error: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, error: 'Password must contain at least one lowercase letter' };
    }
    if (!/^[A-Za-z0-9]+$/.test(password)) {
        return { valid: false, error: 'Password must be alphanumeric only (no special characters)' };
    }
    return { valid: true, error: null };
}

/**
 * Check if employee already has HDMS access
 */
export async function checkHdmsAccess(employeeId: string): Promise<ApiResponse<HdmsAccessStatus>> {
    try {
        const response = await fetch(`${API_BASE_URL}/permissions/hdms-access/${employeeId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            if (response.status === 404) {
                return { data: null, error: 'Employee not found', isOffline: false };
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        return { data, error: null, isOffline: false };
    } catch (error) {
        console.error('Failed to check HDMS access:', error);
        return { data: null, error: 'Failed to check access status', isOffline: true };
    }
}

/**
 * Grant HDMS access to an employee
 */
export async function grantHdmsAccess(data: HdmsAccessData): Promise<ApiResponse<{
    message: string;
    employee_id: string;
    employee_code: string;
    role: string;
    is_new_user: boolean;
}>> {
    try {
        // Validate password on client side first
        const passwordValidation = validatePassword(data.password);
        if (!passwordValidation.valid) {
            return { data: null, error: passwordValidation.error, isOffline: false };
        }

        const response = await fetch(`${API_BASE_URL}/permissions/grant-hdms-access`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!response.ok) {
            return { data: null, error: result.error || 'Failed to grant access', isOffline: false };
        }

        return { data: result, error: null, isOffline: false };
    } catch (error) {
        console.error('Failed to grant HDMS access:', error);
        return { data: null, error: 'Network error. Please check your connection.', isOffline: true };
    }
}
