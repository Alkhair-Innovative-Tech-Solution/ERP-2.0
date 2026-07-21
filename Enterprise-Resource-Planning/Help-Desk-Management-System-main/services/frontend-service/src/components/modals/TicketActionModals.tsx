'use client';

import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { Card, CardContent, CardHeader } from '../ui/card';
import { THEME } from '../../lib/theme';
import { X, AlertCircle } from 'lucide-react';

interface ResolveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResolve: () => void;
  onRequestRework: (reason: string) => void;
}

export const ResolveModal: React.FC<ResolveModalProps> = ({
  isOpen,
  onClose,
  onResolve,
  onRequestRework,
}) => {
  const [showRework, setShowRework] = useState(false);
  const [reworkReason, setReworkReason] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex items-center justify-between">
          <h3 className="text-lg font-semibold" style={{ color: THEME.colors.primary }}>
            Resolve Ticket
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showRework ? (
            <>
              <p className="text-sm text-gray-600">
                How would you like to proceed with this ticket?
              </p>
              <div className="flex gap-3">
                <Button
                  variant="primary"
                  onClick={onResolve}
                  className="flex-1"
                >
                  Mark as Resolved
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowRework(true)}
                  className="flex-1"
                >
                  Request Rework
                </Button>
              </div>
            </>
          ) : (
            <>
              <TextArea
                label="Rework Reason"
                placeholder="Explain why rework is needed..."
                value={reworkReason}
                onChange={(e) => setReworkReason(e.target.value)}
                rows={4}
                required
              />
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRework(false);
                    setReworkReason('');
                  }}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    onRequestRework(reworkReason);
                    setReworkReason('');
                    setShowRework(false);
                  }}
                  disabled={!reworkReason.trim()}
                  className="flex-1"
                >
                  Submit
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

interface ReopenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  reopenCount: number;
  maxReopens: number;
}

export const ReopenModal: React.FC<ReopenModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  reopenCount,
  maxReopens,
}) => {
  const [reason, setReason] = useState('');
  const canReopen = reopenCount < maxReopens;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex items-center justify-between">
          <h3 className="text-lg font-semibold" style={{ color: THEME.colors.primary }}>
            Request Reopen
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canReopen ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  Reopen Limit Reached
                </p>
                <p className="text-xs text-red-700 mt-1">
                  You have already reopened this ticket {reopenCount} times. Maximum {maxReopens} reopens allowed.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  Reopens used: {reopenCount} / {maxReopens}
                </p>
              </div>
              <TextArea
                label="Reason for Reopen"
                placeholder="Explain why you need to reopen this ticket..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                required
              />
              <p className="text-xs text-gray-500">
                This request requires moderator approval.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    onSubmit(reason);
                    setReason('');
                  }}
                  disabled={!reason.trim()}
                  className="flex-1"
                >
                  Submit Request
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};