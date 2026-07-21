import apiClient from './axiosClient';
import { ENV } from '../../config/env';

export interface Department {
    id: string;
    department_id: string;
    dept_code: string;
    dept_name: string;
    dept_sector: string;
}

class DepartmentService {
    async getDepartments(): Promise<Department[]> {
        try {
            // Auth service is on port 8000 (usually default API_URL or AUTH_SERVICE_URL)
            const response = await apiClient.get<Department[]>(`${ENV.AUTH_SERVICE_URL}/api/employees/departments`);
            return response;
        } catch (error) {
            console.error('Failed to fetch departments:', error);
            return [];
        }
    }
}

export const departmentService = new DepartmentService();
export default departmentService;
