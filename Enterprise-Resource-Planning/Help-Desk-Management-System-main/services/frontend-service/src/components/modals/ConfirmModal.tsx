'use client';

import React from 'react';
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { THEME } from '../../lib/theme';

export type ConfirmModalType = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmModalType;
  loading?: boolean;
  showCancel?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger',
  loading = false,
  showCancel = true,
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <AlertTriangle className="w-6 h-6" style={{ color: THEME.colors.error }} />;
      case 'warning':
        return <AlertCircle className="w-6 h-6" style={{ color: THEME.colors.warning }} />;
      case 'success':
        return <CheckCircle className="w-6 h-6" style={{ color: THEME.colors.success }} />;
      case 'info':
      default:
        return <Info className="w-6 h-6" style={{ color: THEME.colors.info }} />;
    }
  };

  const getConfirmButtonColor = () => {
    switch (type) {
      case 'danger':
        return THEME.colors.error;
      case 'warning':
        return THEME.colors.warning;
      case 'success':
        return THEME.colors.success;
      case 'info':
      default:
        return THEME.colors.primary;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            {getIcon()}
            <h2 className="text-xl font-bold" style={{ color: THEME.colors.primary }}>
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5" style={{ color: THEME.colors.gray }} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {description && (
            <p className="text-base text-gray-700 mb-4">{description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50 rounded-b-xl">
          {showCancel && (
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              {cancelText}
            </Button>
          )}
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={loading}
            loading={loading}
            style={{
              backgroundColor: getConfirmButtonColor(),
              color: 'white',
            }}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;

