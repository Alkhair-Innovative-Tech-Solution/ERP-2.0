'use client';

import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import { THEME } from '../../lib/theme';

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
}

const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onDismiss, onRetry }) => {
  return (
    <div 
      className="flex items-center justify-between p-4 rounded-lg mb-4"
      style={{ backgroundColor: '#FEE2E2', border: `1px solid ${THEME.colors.error}` }}
    >
      <div className="flex items-center space-x-2">
        <AlertCircle className="w-5 h-5" style={{ color: THEME.colors.error }} />
        <p className="text-sm font-medium" style={{ color: THEME.colors.error }}>
          {message}
        </p>
      </div>
      <div className="flex items-center space-x-2">
        {onRetry && (
          <button 
            onClick={onRetry} 
            className="px-3 py-1 text-sm font-medium rounded"
            style={{ backgroundColor: THEME.colors.error, color: 'white' }}
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button onClick={onDismiss} className="ml-2">
            <X className="w-4 h-4" style={{ color: THEME.colors.error }} />
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorBanner;

