'use client';

import React, { useState } from 'react';
import { X, MessageSquare } from 'lucide-react';
import { Button } from '../ui/Button';
import { TextArea } from '../ui/TextArea';
import { THEME } from '../../lib/theme';

interface ClarificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (message: string) => void;
    ticketId: string;
}

export const ClarificationModal: React.FC<ClarificationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    ticketId,
}) => {
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!message.trim()) {
            setError('Please enter your clarification request');
            return;
        }
        onConfirm(message);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-6 h-6" style={{ color: THEME.colors.info }} />
                        <h2 className="text-xl font-bold" style={{ color: THEME.colors.primary }}>
                            Request Clarification
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-600">
                        Send a clarification request to the requestor for ticket{' '}
                        <span className="font-semibold">{ticketId}</span>:
                    </p>

                    <TextArea
                        label="Your Message"
                        placeholder="What information do you need from the requestor?"
                        value={message}
                        onChange={(e) => {
                            setMessage(e.target.value);
                            setError('');
                        }}
                        error={error}
                        rows={5}
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
                    >
                        Send Request
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ClarificationModal;
