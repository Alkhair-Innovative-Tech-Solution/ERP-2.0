'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/Button';
import { TextArea } from '../ui/TextArea';
import { XCircle, AlertTriangle } from 'lucide-react';
import { THEME } from '../../lib/theme';

interface RejectTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  ticketId: string;
  ticketSubject: string;
}

export const RejectTicketModal: React.FC<RejectTicketModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  ticketId,
  ticketSubject,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!reason.trim()) {
      setError('Rejection reason is required');
      return;
    }
    if (reason.trim().length < 10) {
      setError('Please provide a detailed reason (at least 10 characters)');
      return;
    }
    onConfirm(reason);
    setReason('');
    setError('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-red-600 flex items-center gap-2">
              <XCircle className="w-6 h-6" />
              Reject Ticket
            </CardTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-red-50 border-2 border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800 mb-1">
                  Warning: This action cannot be undone
                </p>
                <p className="text-xs text-red-700">
                  Ticket will be permanently closed and cannot be reopened.
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-2">
              <strong>Ticket:</strong> {ticketSubject}
            </p>
            <p className="text-xs text-gray-500 mb-4">
              <strong>ID:</strong> {ticketId}
            </p>
          </div>

          <div>
            <TextArea
              label="Rejection Reason *"
              placeholder="Please provide a detailed reason for rejection..."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError('');
              }}
              rows={4}
              required
              error={error}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              fullWidth
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={handleSubmit}
              leftIcon={<XCircle className="w-4 h-4" />}
            >
              Reject Ticket
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RejectTicketModal;
