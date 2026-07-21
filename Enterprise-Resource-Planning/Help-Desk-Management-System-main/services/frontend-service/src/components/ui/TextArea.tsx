'use client';

import React from 'react';
import { THEME } from '../../lib/theme';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export const TextArea: React.FC<TextAreaProps> = ({
  label,
  error,
  helperText,
  fullWidth = true,
  className = '',
  ...props
}) => {
  return (
    <div className={`${fullWidth ? 'w-full' : ''} animate-fade-in`}>
      {label && (
        <label className="block text-sm font-semibold mb-2.5" style={{ color: THEME.colors.primary }}>
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <textarea
        className={`
          w-full px-4 py-3.5 border rounded-lg shadow-sm
          focus:outline-none focus:ring-2 transition-all duration-200
          resize-y hover:border-gray-400
          ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}
          ${className}
        `}
        style={{
          backgroundColor: 'white',
          color: '#111827',
          minHeight: '100px',
          fontSize: '15px',
          fontFamily: 'inherit',
        }}
        {...props}
      />

      {error && (
        <p className="mt-2 text-sm font-medium animate-fade-in" style={{ color: THEME.colors.error }}>
          {error}
        </p>
      )}

      {helperText && !error && (
        <p className="mt-2 text-sm" style={{ color: THEME.colors.gray }}>
          {helperText}
        </p>
      )}
    </div>
  );
};

