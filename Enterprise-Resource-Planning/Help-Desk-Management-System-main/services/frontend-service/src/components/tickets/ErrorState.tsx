// src/components/tickets/ErrorState.tsx
'use client';

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { THEME } from '@/lib/theme';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => (
  <div
    className="rounded-2xl bg-white ring-1 ring-black/[0.04] p-8 text-center"
    style={{ boxShadow: '0 4px 20px -8px rgba(239,68,68,0.10)' }}
  >
    <div
      className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
      style={{ backgroundColor: THEME.colors.error + '15' }}
    >
      <AlertCircle className="w-6 h-6" style={{ color: THEME.colors.error }} />
    </div>
    <h3 className="text-sm font-bold mb-1" style={{ color: THEME.colors.primary }}>
      Something went wrong
    </h3>
    <p className="text-sm text-gray-500 mb-4">{message}</p>
    {onRetry && (
      <Button variant="outline" size="sm" leftIcon={<RefreshCw className="w-3.5 h-3.5" />} onClick={onRetry}>
        Retry
      </Button>
    )}
  </div>
);
