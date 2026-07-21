'use client';

import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { CheckCircle, AlertCircle, AlertTriangle, Info, XCircle } from 'lucide-react';
import { THEME } from '../../lib/theme';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: AlertType;
  title: string;
  message: string;
  details?: string;
  buttonText?: string;
  showCancel?: boolean;
  onConfirm?: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  type,
  title,
  message,
  details,
  buttonText = 'OK',
  showCancel = false,
  onConfirm,
}) => {
  const getIcon = () => {
    const iconClass = 'w-10 h-10';
    switch (type) {
      case 'success':
        return <CheckCircle className={iconClass} style={{ color: THEME.colors.success }} />;
      case 'error':
        return <XCircle className={iconClass} style={{ color: THEME.colors.error }} />;
      case 'warning':
        return <AlertTriangle className={iconClass} style={{ color: THEME.colors.warning }} />;
      case 'info':
      default:
        return <Info className={iconClass} style={{ color: THEME.colors.info }} />;
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return THEME.colors.success;
      case 'error':
        return THEME.colors.error;
      case 'warning':
        return THEME.colors.warning;
      case 'info':
      default:
        return THEME.colors.info;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return '#D1FAE5'; // green-100
      case 'error':
        return '#FEE2E2'; // red-100
      case 'warning':
        return '#FEF3C7'; // yellow-100
      case 'info':
      default:
        return '#DBEAFE'; // blue-100
    }
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      showCloseButton={true}
    >
      <div className="space-y-6">
        {/* Icon and Title Section */}
        <div className="flex items-start gap-4">
          <div 
            className="flex-shrink-0 p-3 rounded-full"
            style={{
              backgroundColor: getBgColor(),
            }}
          >
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 
              className="text-xl md:text-2xl font-bold mb-2"
              style={{ color: THEME.colors.primary }}
            >
              {title}
            </h3>
            <p className="text-base text-gray-700 leading-relaxed">{message}</p>
          </div>
        </div>

        {/* Details Section (if provided) */}
        {details && (
          <div 
            className="p-4 rounded-lg border-2"
            style={{
              backgroundColor: getBgColor(),
              borderColor: getBorderColor() + '40',
            }}
          >
            <p className="text-sm font-semibold text-gray-800 mb-2">Details:</p>
            <div className="bg-white/60 rounded p-3">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{details}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          {showCancel && (
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-base font-semibold rounded-lg border-2 transition-all hover:bg-gray-50"
              style={{
                borderColor: THEME.colors.primary,
                color: THEME.colors.primary,
                backgroundColor: 'transparent',
              }}
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleConfirm}
            className="px-5 py-2.5 text-base font-semibold rounded-lg transition-all hover:opacity-90 min-w-[100px] text-white shadow-md"
            style={{
              backgroundColor: type === 'error' ? THEME.colors.error :
                              type === 'success' ? THEME.colors.success :
                              type === 'warning' ? THEME.colors.warning :
                              THEME.colors.primary,
            }}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default AlertModal;
