/**
 * Department Service
 * Handles API calls for department management with mock data fallback
 */

import { getMockDepartments, getMockDepartmentById, MockDepartment, mockDepartments } from '../lib/mockData';

const API_BASE_URL = '/api'; // Relative URL — proxied by Next.js rewrites to auth_service container

export interface Department {
    id?: string;
    department_id?: string;
    dept_code: string;
    dept_name: string;
    dept_sector: string;
    institution_code?: string;
    description?: string;
    employee_count?: number;
    designations?: { position_code: string; position_name: string }[];
}

export interface DepartmentCreateData {
    dept_code: string;
    dept_name: string;
    dept_sector: string;
    institution_code?: string;
    description?: string;
}

export interface ApiResponse<T> {
    data: T | null;
    error: string | null;
    isOffline: boolean;
}

/**
 * Fetch all departments from API with mock fallback
 */
export async function fetchDepartments(): Promise<ApiResponse<Department[]>> {
    try {
        const response = await fetch(`${API_BASE_URL}/employees/departments`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Transform API response to match our interface
        const departments: Department[] = data.map((dept: any) => ({
            id: dept.id,
            department_id: dept.department_id || dept.id,
            dept_code: dept.dept_code,
            dept_name: dept.dept_name,
            dept_sector: dept.dept_sector || 'other',
            institution_code: dept.institution_code,
            description: dept.description,
        }));

        return { data: departments, error: null, isOffline: false };
    } catch (error) {
        console.warn('API unavailable, using mock data:', error);

        // Use mock data as fallback
        const mockData: Department[] = getMockDepartments().map(dept => ({
            dept_code: dept.dept_code,
            dept_name: dept.dept_name,
            dept_sector: dept.sector,
            description: dept.description,
        }));

        return { data: mockData, error: null, isOffline: true };
    }
}

/**
 * Fetch single department by code with employee count and designations
 */
export async function fetchDepartmentByCode(deptCode: string): Promise<ApiResponse<Department>> {
    try {
        const response = await fetch(`${API_BASE_URL}/departments/${deptCode}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            if (response.status === 404) {
                return { data: null, error: 'Department not found', isOffline: false };
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        return {
            data: {
                department_id: data.department_id,
                dept_code: data.dept_code,
                dept_name: data.dept_name,
                dept_sector: data.dept_sector,
                description: data.description,
                employee_count: data.employee_count,
                designations: data.designations,
            },
            error: null,
            isOffline: false
        };
    } catch (error) {
        console.warn('API unavailable, using mock data:', error);

        const mockDept = getMockDepartmentById(deptCode);
        if (!mockDept) {
            return { data: null, error: 'Department not found', isOffline: true };
        }

        return {
            data: {
                dept_code: mockDept.dept_code,
                dept_name: mockDept.dept_name,
                dept_sector: mockDept.sector,
                description: mockDept.description,
                employee_count: 0,
                designations: [],
            },
            error: null,
            isOffline: true
        };
    }
}

/**
 * Create a new department
 */
export async function createDepartment(data: DepartmentCreateData): Promise<ApiResponse<{ dept_code: string; department_id: string }>> {
    try {
        const response = await fetch(`${API_BASE_URL}/employees/departments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!response.ok) {
            return { data: null, error: result.error || 'Failed to create department', isOffline: false };
        }

        return {
            data: {
                dept_code: result.dept_code,
                department_id: result.department_id
            },
            error: null,
            isOffline: false
        };
    } catch (error) {
        console.error('Failed to create department:', error);
        return { data: null, error: 'Network error. Please check your connection.', isOffline: true };
    }
}

/**
 * Update an existing department
 */
export async function updateDepartment(deptCode: string, data: Partial<DepartmentCreateData>): Promise<ApiResponse<{ dept_code: string }>> {
    try {
        const response = await fetch(`${API_BASE_URL}/departments/${deptCode}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!response.ok) {
            return { data: null, error: result.error || 'Failed to update department', isOffline: false };
        }

        return { data: { dept_code: result.dept_code }, error: null, isOffline: false };
    } catch (error) {
        console.error('Failed to update department:', error);
        return { data: null, error: 'Network error. Please check your connection.', isOffline: true };
    }
}

/**
 * Delete a department (soft delete)
 */
export async function deleteDepartment(deptCode: string): Promise<ApiResponse<boolean>> {
    try {
        const response = await fetch(`${API_BASE_URL}/departments/${deptCode}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const result = await response.json();

        if (!response.ok) {
            return { data: false, error: result.error || 'Failed to delete department', isOffline: false };
        }

        return { data: true, error: null, isOffline: false };
    } catch (error) {
        console.error('Failed to delete department:', error);
        return { data: false, error: 'Network error. Please check your connection.', isOffline: true };
    }
}
