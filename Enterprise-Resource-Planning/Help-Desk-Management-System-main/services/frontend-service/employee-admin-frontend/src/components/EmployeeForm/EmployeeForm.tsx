import React, { useState } from 'react';
import styles from './EmployeeForm.module.css';
import { createEmployee } from '../../services/employeeService';
import { useForm } from '../../hooks/useForm';
import { Employee } from '../../types/employee';
import { validateEmployee } from '../../utils/validation';

const EmployeeForm: React.FC = () => {
    const [formData, setFormData] = useState<Employee>({
        name: '',
        email: '',
        phone: '',
        position: '',
        department: '',
        bankAccount: '',
        education: ''
    });
    const [error, setError] = useState<string>('');
    const [successMessage, setSuccessMessage] = useState<string>('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validationError = validateEmployee(formData);
        if (validationError) {
            setError(validationError);
            return;
        }
        try {
            await createEmployee(formData);
            setSuccessMessage('Employee record created successfully!');
            setFormData({
                name: '',
                email: '',
                phone: '',
                position: '',
                department: '',
                bankAccount: '',
                education: ''
            });
            setError('');
        } catch (err) {
            setError('Failed to create employee record. Please try again.');
        }
    };

    return (
        <form className={styles.employeeForm} onSubmit={handleSubmit}>
            <h2>Create Employee Record</h2>
            {error && <p className={styles.error}>{error}</p>}
            {successMessage && <p className={styles.success}>{successMessage}</p>}
            <div>
                <label>Name:</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} required />
            </div>
            <div>
                <label>Email:</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} required />
            </div>
            <div>
                <label>Phone:</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required />
            </div>
            <div>
                <label>Position:</label>
                <input type="text" name="position" value={formData.position} onChange={handleChange} required />
            </div>
            <div>
                <label>Department:</label>
                <input type="text" name="department" value={formData.department} onChange={handleChange} required />
            </div>
            <div>
                <label>Bank Account:</label>
                <input type="text" name="bankAccount" value={formData.bankAccount} onChange={handleChange} required />
            </div>
            <div>
                <label>Education:</label>
                <textarea name="education" value={formData.education} onChange={handleChange} required />
            </div>
            <button type="submit">Submit</button>
        </form>
    );
};

export default EmployeeForm;