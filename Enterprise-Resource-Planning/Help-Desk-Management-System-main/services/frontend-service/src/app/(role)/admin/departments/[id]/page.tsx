'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/Button';
import { THEME } from '../../../../../lib/theme';
import { fetchDepartmentByCode, fetchDepartments, Department } from '../../../../../services/departmentService';
import { fetchDesignations, createDesignation, Designation } from '../../../../../services/designationService';
import {
    ArrowLeft,
    Building2,
    Briefcase,
    Plus,
    Layers,
    FileText,
    ChevronDown,
    ChevronUp,
    WifiOff,
    Users,
    AlertCircle
} from 'lucide-react';
import { PageContainer } from '../../../../../components/layout/PageContainer';

const DepartmentDetailPage: React.FC = () => {
    const params = useParams();
    const router = useRouter();
    const deptCode = params.id as string;

    const [department, setDepartment] = useState<Department | null>(null);
    const [designations, setDesignations] = useState<Designation[]>([]);
    const [allDepartments, setAllDepartments] = useState<Department[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Modal State
    const [showAddDesignationModal, setShowAddDesignationModal] = useState(false);
    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [newDesignation, setNewDesignation] = useState({
        department_code: '',
        position_code: '',
        position_name: '',
        description: '',
    });

    useEffect(() => {
        if (deptCode) {
            loadDepartmentData();
        }
    }, [deptCode]);

    const loadDepartmentData = async () => {
        setIsLoading(true);
        setError(null);

        // Fetch department details
        const deptResult = await fetchDepartmentByCode(deptCode);
        if (deptResult.error) {
            setError(deptResult.error);
            setIsLoading(false);
            return;
        }

        setDepartment(deptResult.data);
        setIsOffline(deptResult.isOffline);

        // Fetch designations for this department
        const desigResult = await fetchDesignations(deptCode);
        if (desigResult.data) {
            setDesignations(desigResult.data);
        }

        // Fetch all departments for the dropdown
        const allDeptsResult = await fetchDepartments();
        if (allDeptsResult.data) {
            setAllDepartments(allDeptsResult.data);
        }

        setIsLoading(false);
    };

    const validateDesignation = (): string | null => {
        if (!newDesignation.department_code) return 'Please select a department';
        if (!newDesignation.position_code.trim()) return 'Position code is required';
        if (!/^[A-Za-z0-9]+$/.test(newDesignation.position_code)) return 'Position code must be alphanumeric only';
        if (newDesignation.position_code.length > 4) return 'Position code must be 4 characters or less';
        if (!newDesignation.position_name.trim()) return 'Position name is required';
        return null;
    };

    const handleAddDesignation = async () => {
        const validationError = validateDesignation();
        if (validationError) {
            setFormError(validationError);
            return;
        }

        setIsSubmitting(true);
        setFormError(null);

        const result = await createDesignation({
            department_code: newDesignation.department_code,
            position_code: newDesignation.position_code.toUpperCase(),
            position_name: newDesignation.position_name,
            description: newDesignation.description || undefined,
        });

        if (result.error) {
            setFormError(result.error);
            setIsSubmitting(false);
            return;
        }

        setSuccessMessage('Designation created successfully!');

        // Refresh designations list
        const desigResult = await fetchDesignations(deptCode);
        if (desigResult.data) {
            setDesignations(desigResult.data);
        }

        // Reset form and close modal after delay
        setTimeout(() => {
            setNewDesignation({
                department_code: '',
                position_code: '',
                position_name: '',
                description: '',
            });
            setShowAddDesignationModal(false);
            setShowAdvancedOptions(false);
            setSuccessMessage(null);
        }, 1000);

        setIsSubmitting(false);
    };

    const openAddDesignationModal = () => {
        // Pre-select current department
        setNewDesignation({
            ...newDesignation,
            department_code: deptCode
        });
        setFormError(null);
        setSuccessMessage(null);
        setShowAddDesignationModal(true);
    };

    if (isLoading) {
        return (
            <div className="p-8 flex justify-center items-center min-h-screen" style={{ backgroundColor: THEME.colors.background }}>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: THEME.colors.primary }}></div>
            </div>
        );
    }

    if (error || !department) {
        return (
            <div className="p-8 flex justify-center items-center min-h-screen" style={{ backgroundColor: THEME.colors.background }}>
                <div className="text-center">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold mb-2">{error || 'Department Not Found'}</h2>
                    <Button variant="primary" onClick={() => router.push('/admin/departments')}>Back to List</Button>
                </div>
            </div>
        );
    }

    return (
        <PageContainer>
            {/* Offline Banner */}
            {isOffline && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 mb-6">
                    <WifiOff className="w-5 h-5 text-amber-600" />
                    <span className="text-amber-700 text-sm font-medium">
                        Using offline data. Some features may be limited.
                    </span>
                </div>
            )}

            <Button
                variant="outline"
                onClick={() => router.back()}
                className="mb-6"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
                Back to List
            </Button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Department Info */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="bg-white rounded-2xl shadow-xl border-0">
                        <CardHeader className="p-6 border-b">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white" style={{ backgroundColor: THEME.colors.primary }}>
                                    {department.dept_name.charAt(0)}
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-bold" style={{ color: THEME.colors.primary }}>
                                        {department.dept_name}
                                    </CardTitle>
                                    <p className="text-sm font-medium mt-1" style={{ color: THEME.colors.gray }}>
                                        {department.dept_code}
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-500 flex items-center gap-2 mb-1">
                                    <Layers className="w-4 h-4" /> Sector
                                </label>
                                <p className="text-gray-900 font-medium capitalize">{department.dept_sector}</p>
                            </div>
                            {department.description && (
                                <div>
                                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2 mb-1">
                                        <FileText className="w-4 h-4" /> Description
                                    </label>
                                    <p className="text-gray-900 text-sm leading-relaxed">{department.description}</p>
                                </div>
                            )}
                            {department.employee_count !== undefined && (
                                <div>
                                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2 mb-1">
                                        <Users className="w-4 h-4" /> Employees
                                    </label>
                                    <p className="text-gray-900 font-medium">{department.employee_count} active employees</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Designations List */}
                <div className="lg:col-span-2">
                    <Card className="bg-white rounded-2xl shadow-xl border-0 h-full">
                        <CardHeader className="p-6 border-b flex flex-row items-center justify-between">
                            <CardTitle className="text-xl font-bold flex items-center gap-2" style={{ color: THEME.colors.primary }}>
                                <Briefcase className="w-5 h-5" /> Designations ({designations.length})
                            </CardTitle>
                            <Button
                                variant="primary"
                                size="sm"
                                leftIcon={<Plus className="w-4 h-4" />}
                                onClick={openAddDesignationModal}
                            >
                                Add Designation
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            {designations.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <Briefcase className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                    <p>No designations found for this department.</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-4"
                                        onClick={openAddDesignationModal}
                                    >
                                        Create First Designation
                                    </Button>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="text-left py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Code</th>
                                                <th className="text-left py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Position Name</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {designations.map((desig, index) => (
                                                <tr key={desig.id || index} className="hover:bg-gray-50 transition-colors">
                                                    <td className="py-4 px-6 text-sm font-medium text-blue-600">{desig.position_code}</td>
                                                    <td className="py-4 px-6 text-sm text-gray-900">{desig.position_name}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Add Designation Modal */}
            {showAddDesignationModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full my-8">
                        <div className="p-6 border-b">
                            <h3 className="text-2xl font-bold text-gray-900">Add Designation</h3>
                            <p className="text-sm text-gray-500 mt-1">Create a new position for your organization</p>
                        </div>

                        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                            {/* SECTION 1: DEPARTMENT */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Building2 className="w-4 h-4" /> Section 1: Department
                                </h4>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Select Department <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={newDesignation.department_code}
                                        onChange={e => setNewDesignation({ ...newDesignation, department_code: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    >
                                        <option value="">Select Department</option>
                                        {allDepartments.map(dept => (
                                            <option key={dept.dept_code} value={dept.dept_code}>
                                                {dept.dept_code} - {dept.dept_name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">Choose which department this designation belongs to</p>
                                </div>
                            </div>

                            {/* SECTION 2: DESIGNATION DETAILS */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Briefcase className="w-4 h-4" /> Section 2: Designation Details
                                </h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Position Code <span className="text-red-500">*</span> <span className="text-gray-500 font-normal">(max 4 chars)</span>
                                        </label>
                                        <input
                                            type="text"
                                            maxLength={4}
                                            placeholder="e.g., T, P, DEV, ACC"
                                            value={newDesignation.position_code}
                                            onChange={e => setNewDesignation({ ...newDesignation, position_code: e.target.value.toUpperCase() })}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Short alphanumeric code (max 4 chars, unique within department)</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Position Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            maxLength={100}
                                            placeholder="e.g., Teacher, Principal, Software Developer"
                                            value={newDesignation.position_name}
                                            onChange={e => setNewDesignation({ ...newDesignation, position_name: e.target.value })}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 3: DESCRIPTION */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> Section 3: Description (Optional)
                                </h4>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Role Description
                                    </label>
                                    <textarea
                                        rows={3}
                                        placeholder="Describe key responsibilities..."
                                        value={newDesignation.description}
                                        onChange={e => setNewDesignation({ ...newDesignation, description: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                                    />
                                </div>
                            </div>

                            {/* Error Message */}
                            {formError && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <p className="text-sm text-red-700">{formError}</p>
                                </div>
                            )}

                            {/* Success Message */}
                            {successMessage && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                    <p className="text-sm text-green-700">{successMessage}</p>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowAddDesignationModal(false);
                                    setShowAdvancedOptions(false);
                                    setFormError(null);
                                    setNewDesignation({
                                        department_code: '',
                                        position_code: '',
                                        position_name: '',
                                        description: '',
                                    });
                                }}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleAddDesignation}
                                disabled={isSubmitting || !newDesignation.department_code || !newDesignation.position_code || !newDesignation.position_name}
                            >
                                {isSubmitting ? 'Saving...' : 'Save Designation'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    );
};

export default DepartmentDetailPage;
