/**
 * Toast Component
 * Notification toast for user feedback
 */

'use client';

import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { THEME } from '../../lib/theme';

export const Toast: React.FC = () => {
  const { toast, hideToast } = useUIStore();

  useEffect(() => {
    if (toast?.visible) {
      const timer = setTimeout(() => {
        hideToast();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [toast, hideToast]);

  if (!toast || !toast.visible) return null;

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const colors = {
    success: THEME.colors.success,
    error: THEME.colors.error,
    warning: THEME.colors.warning,
    info: THEME.colors.info,
  };

  const Icon = icons[toast.type];
  const color = colors[toast.type];

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5">
      <div 
        className="flex items-center gap-3 p-4 rounded-lg shadow-lg border min-w-[300px] max-w-md"
        style={{ 
          backgroundColor: 'white',
          borderColor: color,
          borderLeftWidth: '4px',
        }}
      >
        <Icon className="w-5 h-5 flex-shrink-0" style={{ color }} />
        <p className="flex-1 text-sm font-medium text-gray-900">
          {toast.message}
        </p>
        <button
          onClick={hideToast}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>
    </div>
  );
};

