'use client';

import React, { useState } from 'react';
import { X, Clock } from 'lucide-react';
import { Button } from '../ui/Button';
import { TextArea } from '../ui/TextArea';
import { THEME } from '../../lib/theme';

interface PostponeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    ticketId: string;
}

export const PostponeModal: React.FC<PostponeModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    ticketId,
}) => {
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!reason.trim()) {
            setError('Please provide a reason for postponement');
            return;
        }
        onConfirm(reason);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-2">
                        <Clock className="w-6 h-6" style={{ color: THEME.colors.warning }} />
                        <h2 className="text-xl font-bold" style={{ color: THEME.colors.primary }}>
                            Postpone Ticket
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-600">
                        Ticket <span className="font-semibold">{ticketId}</span> will be postponed.
                        Please provide a reason:
                    </p>

                    <TextArea
                        label="Postponement Reason"
                        placeholder="Enter reason for postponing this ticket..."
                        value={reason}
                        onChange={(e) => {
                            setReason(e.target.value);
                            setError('');
                        }}
                        error={error}
                        rows={4}
                        required
                    />
                </div>

                {/* Actions */}
                <div className="flex gap-3 p-6 border-t">
                    <Button variant="outline" onClick={onClose} fullWidth>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        fullWidth
                        style={{ backgroundColor: THEME.colors.warning }}
                    >
                        Postpone
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default PostponeModal;
