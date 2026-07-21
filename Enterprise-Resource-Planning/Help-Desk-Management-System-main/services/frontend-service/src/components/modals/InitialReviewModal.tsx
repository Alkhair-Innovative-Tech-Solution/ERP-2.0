'use client';

import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Loader, AlertTriangle, UserPlus, Info } from 'lucide-react';
import { Button } from '../ui/Button';
import { Ticket } from '../../types';
import { departmentService, Department } from '../../services/api/departmentService';
import { DEPARTMENTS } from '../../lib/constants';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    department?: string;
    employee_code?: string;
}

interface InitialReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: {
        title: string;
        description: string;
        priority: string;
        category: string;
        assignee_id: string;
        department_id?: string;
    }) => void;
    onReject: (reason: string) => void;
    onPostpone: (reason: string) => void;
    ticket: Ticket;
    assignees: User[];
    loading?: boolean;
}

const InitialReviewModal: React.FC<InitialReviewModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    onReject,
    onPostpone,
    ticket,
    assignees,
    loading = false
}) => {
    const [ticketData, setTicketData] = useState({
        title: ticket.subject,
        description: ticket.description,
        priority: ticket.priority as string,
        category: ticket.category || ''
    });

    const [selectedAssignee, setSelectedAssignee] = useState<string>('');
    const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loadingDepts, setLoadingDepts] = useState(false);
    const [showRejection, setShowRejection] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const fetchDepartments = async () => {
            setLoadingDepts(true);
            try {
                const data = await departmentService.getDepartments();
                setDepartments(data);
            } catch (error) {
                console.warn('Failed to fetch departments');
            } finally {
                setLoadingDepts(false);
            }
        };
        fetchDepartments();
    }, [isOpen]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm({
            ...ticketData,
            assignee_id: selectedAssignee,
            department_id: selectedDeptId !== 'all' ? selectedDeptId : undefined
        });
    };

    const filteredAssignees = assignees.filter(assignee => {
        if (!selectedDeptId || selectedDeptId === 'all') return true;
        const selectedDept = departments.find(d => d.id === selectedDeptId);
        return assignee.department === selectedDept?.dept_name || assignee.department === selectedDeptId;
    });

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full flex flex-col max-h-[90vh] overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-blue-50 to-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                            <CheckCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Initial Ticket Review</h2>
                            <p className="text-sm text-gray-500">Review, update, and assign the ticket to start the SLA</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Left: Ticket Information */}
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 border-l-4 border-blue-500 pl-3">
                            <Info className="w-5 h-5 text-blue-500" />
                            Ticket Information
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                                <input
                                    type="text"
                                    value={ticketData.title}
                                    onChange={(e) => setTicketData({ ...ticketData, title: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    rows={4}
                                    value={ticketData.description}
                                    onChange={(e) => setTicketData({ ...ticketData, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                                    <select
                                        value={ticketData.priority}
                                        onChange={(e) => setTicketData({ ...ticketData, priority: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="urgent">Urgent (8h)</option>
                                        <option value="high">High (24h)</option>
                                        <option value="medium">Medium (48h)</option>
                                        <option value="low">Low (72h)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                    <input
                                        type="text"
                                        value={ticketData.category}
                                        onChange={(e) => setTicketData({ ...ticketData, category: e.target.value })}
                                        placeholder="e.g. Software, Network"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Rejection / Postpone Section */}
                        <div className="pt-6 border-t mt-8">
                            {!showRejection ? (
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowRejection(true)}
                                        className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                                    >
                                        <AlertTriangle className="w-4 h-4" />
                                        Reject Ticket
                                    </button>
                                    <span className="text-gray-300">|</span>
                                    <button
                                        onClick={() => onPostpone('Moderator postponing for review')}
                                        className="text-gray-600 hover:text-gray-700 text-sm font-medium"
                                    >
                                        Postpone
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3 p-4 bg-red-50 rounded-lg animate-in slide-in-from-bottom-2">
                                    <label className="block text-sm font-medium text-red-800">Rejection Reason</label>
                                    <textarea
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        placeholder="Explain why this ticket is being rejected..."
                                        className="w-full p-2 border border-red-200 rounded text-sm outline-none focus:ring-2 focus:ring-red-500"
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setShowRejection(false)} className="text-xs text-gray-500 hover:underline">Cancel</button>
                                        <button
                                            onClick={() => onReject(rejectionReason)}
                                            disabled={!rejectionReason}
                                            className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                                        >
                                            Confirm Rejection
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Assignee Selection */}
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 border-l-4 border-green-500 pl-3">
                            <UserPlus className="w-5 h-5 text-green-500" />
                            Assign Specialist
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Department</label>
                                <select
                                    value={selectedDeptId}
                                    onChange={(e) => setSelectedDeptId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                                    disabled={loadingDepts}
                                >
                                    <option value="all">All Departments</option>
                                    {departments.map(dept => (
                                        <option key={dept.id} value={dept.id}>{dept.dept_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Select Assignee</label>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {filteredAssignees.length === 0 ? (
                                        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 text-gray-400">
                                            No matching assignees found
                                        </div>
                                    ) : (
                                        filteredAssignees.map((item) => {
                                            const isSelected = selectedAssignee === item.id;
                                            return (
                                                <div
                                                    key={item.id}
                                                    onClick={() => setSelectedAssignee(item.id)}
                                                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between group ${isSelected
                                                        ? 'border-green-500 bg-green-50'
                                                        : 'border-gray-100 hover:border-gray-300 bg-white shadow-sm hover:shadow'
                                                        }`}
                                                >
                                                    <div>
                                                        <p className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{item.name}</p>
                                                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{item.employee_code || 'N/A'}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                            <span className="text-[10px] text-green-600 font-semibold uppercase">Available</span>
                                                        </div>
                                                    </div>
                                                    {isSelected && <div className="bg-green-500 text-white p-1 rounded-full"><CheckCircle className="w-5 h-5" /></div>}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-gray-50 border-t flex items-center justify-end gap-3">
                    <Button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                        Review Later
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!selectedAssignee || loading}
                        className={`px-8 py-2.5 flex items-center gap-2 font-bold shadow-lg shadow-blue-200 transition-all ${selectedAssignee && !loading
                            ? 'bg-blue-600 text-white hover:bg-blue-700 transform hover:-translate-y-0.5'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        {loading ? <Loader className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                        Confirm & Start SLA
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default InitialReviewModal;
