'use client';

import React, { useState } from 'react';
import { X, Save, Loader, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Ticket } from '../../types';

interface EditTicketModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: {
        title?: string;
        description?: string;
        priority?: string;
        category?: string;
        assignee_id?: string;
        department_id?: string;
    }) => void;
    ticket: Ticket;
    loading?: boolean;
}

const EditTicketModal: React.FC<EditTicketModalProps> = ({
    isOpen,
    onClose,
    onSave,
    ticket,
    loading = false
}) => {
    const [ticketData, setTicketData] = useState({
        title: ticket.subject,
        description: ticket.description,
        priority: ticket.priority as string,
        category: ticket.category || ''
    });

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(ticketData);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-2">
                        <Save className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-bold text-gray-900">Edit Ticket Details</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                        <input
                            type="text"
                            value={ticketData.title}
                            onChange={(e) => setTicketData({ ...ticketData, title: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                            rows={4}
                            value={ticketData.description}
                            onChange={(e) => setTicketData({ ...ticketData, description: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
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
                                <option value="urgent">Urgent</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                            <input
                                type="text"
                                value={ticketData.category}
                                onChange={(e) => setTicketData({ ...ticketData, category: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg text-yellow-800 text-xs">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <p>Updating priority will NOT recalculate the SLA due date. Use "Update SLA" if a new deadline is needed.</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
                    <Button
                        onClick={onClose}
                        variant="outline"
                        className="px-4 py-2"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
                    >
                        {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default EditTicketModal;
