import axios from 'axios';
import { Employee } from '../types/employee';

const API_URL = 'https://your-backend-api.com/api/employees';

export const createEmployee = async (employeeData: Employee): Promise<Employee> => {
    const response = await axios.post(API_URL, employeeData);
    return response.data;
};

export const getEmployees = async (): Promise<Employee[]> => {
    const response = await axios.get(API_URL);
    return response.data;
};

export const updateEmployee = async (employeeId: string, employeeData: Employee): Promise<Employee> => {
    const response = await axios.put(`${API_URL}/${employeeId}`, employeeData);
    return response.data;
};

export const deleteEmployee = async (employeeId: string): Promise<void> => {
    await axios.delete(`${API_URL}/${employeeId}`);
};