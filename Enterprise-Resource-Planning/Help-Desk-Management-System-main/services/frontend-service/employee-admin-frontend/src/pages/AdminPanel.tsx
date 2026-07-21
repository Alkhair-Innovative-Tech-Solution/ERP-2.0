import React from 'react';
import EmployeeForm from '../components/EmployeeForm/EmployeeForm';
import './AdminPanel.module.css';

const AdminPanel: React.FC = () => {
    return (
        <div className="admin-panel">
            <h1>Admin Panel</h1>
            <EmployeeForm />
        </div>
    );
};

export default AdminPanel;