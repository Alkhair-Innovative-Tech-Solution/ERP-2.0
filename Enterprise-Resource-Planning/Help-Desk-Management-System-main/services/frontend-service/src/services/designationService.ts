/**
 * Designation Service
 * Handles API calls for designation management with mock data fallback
 */

import { getMockDesignations, getMockDesignationsByDept, MockDesignation } from '../lib/mockData';

const API_BASE_URL = '/api'; // Relative URL — proxied by Next.js rewrites to auth_service container

export interface Designation {
    id?: string;
    position_code: string;
    position_name: string;
    description?: string;
    department?: {
        dept_code: string;
        dept_name: string;
    };
    dept_code?: string;
}

export interface DesignationCreateData {
    department_code: string;
    position_code: string;
    position_name: string;
    description?: string;
}

export interface ApiResponse<T> {
    data: T | null;
    error: string | null;
    isOffline: boolean;
}

/**
 * Fetch all designations from API with mock fallback
 */
export async function fetchDesignations(departmentCode?: string): Promise<ApiResponse<Designation[]>> {
    try {
        const url = departmentCode
            ? `${API_BASE_URL}/designations?department_code=${departmentCode}`
            : `${API_BASE_URL}/designations`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Transform API response
        const designations: Designation[] = data.map((item: any) => ({
            id: item.id,
            position_code: item.position_code,
            position_name: item.position_name,
            description: item.description,
            dept_code: item.department__dept_code || item.dept_code,
        }));

        return { data: designations, error: null, isOffline: false };
    } catch (error) {
        console.warn('API unavailable, using mock data:', error);

        // Use mock data as fallback
        const mockData = departmentCode
            ? getMockDesignationsByDept(departmentCode)
            : getMockDesignations();

        const designations: Designation[] = mockData.map(item => ({
            position_code: item.position_code,
            position_name: item.position_name,
            dept_code: item.dept_code,
        }));

        return { data: designations, error: null, isOffline: true };
    }
}

/**
 * Fetch single designation by ID
 */
export async function fetchDesignationById(id: string): Promise<ApiResponse<Designation>> {
    try {
        const response = await fetch(`${API_BASE_URL}/designations/${id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            if (response.status === 404) {
                return { data: null, error: 'Designation not found', isOffline: false };
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        return {
            data: {
                id: data.id,
                position_code: data.position_code,
                position_name: data.position_name,
                description: data.description,
                department: data.department,
            },
            error: null,
            isOffline: false
        };
    } catch (error) {
        console.warn('API unavailable:', error);
        return { data: null, error: 'Failed to load designation', isOffline: true };
    }
}

/**
 * Create a new designation
 */
export async function createDesignation(data: DesignationCreateData): Promise<ApiResponse<{ id: string; position_code: string }>> {
    try {
        const response = await fetch(`${API_BASE_URL}/designations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!response.ok) {
            return { data: null, error: result.error || 'Failed to create designation', isOffline: false };
        }

        return {
            data: {
                id: result.id,
                position_code: result.position_code
            },
            error: null,
            isOffline: false
        };
    } catch (error) {
        console.error('Failed to create designation:', error);
        return { data: null, error: 'Network error. Please check your connection.', isOffline: true };
    }
}

/**
 * Update an existing designation
 */
export async function updateDesignation(id: string, data: Partial<DesignationCreateData>): Promise<ApiResponse<{ position_code: string }>> {
    try {
        const response = await fetch(`${API_BASE_URL}/designations/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!response.ok) {
            return { data: null, error: result.error || 'Failed to update designation', isOffline: false };
        }

        return { data: { position_code: result.position_code }, error: null, isOffline: false };
    } catch (error) {
        console.error('Failed to update designation:', error);
        return { data: null, error: 'Network error. Please check your connection.', isOffline: true };
    }
}

/**
 * Delete a designation (soft delete)
 */
export async function deleteDesignation(id: string): Promise<ApiResponse<boolean>> {
    try {
        const response = await fetch(`${API_BASE_URL}/designations/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const result = await response.json();

        if (!response.ok) {
            return { data: false, error: result.error || 'Failed to delete designation', isOffline: false };
        }

        return { data: true, error: null, isOffline: false };
    } catch (error) {
        console.error('Failed to delete designation:', error);
        return { data: false, error: 'Network error. Please check your connection.', isOffline: true };
    }
}
