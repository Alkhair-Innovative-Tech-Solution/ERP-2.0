import React from 'react';
import { THEME } from '../../lib/theme';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  helperText,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full animate-fade-in">
      {label && (
        <label className="block text-sm font-semibold mb-2.5" style={{ color: THEME.colors.primary }}>
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
            <span style={{ color: error ? THEME.colors.error : THEME.colors.gray }}>{icon}</span>
          </div>
        )}
        <input
          className={`
            block w-full px-4 py-3.5 border rounded-lg shadow-sm placeholder-gray-400 
            focus:outline-none focus:ring-2 transition-all duration-200
            ${icon ? 'pl-12' : ''}
            ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}
            hover:border-gray-400
            ${className}
          `}
          style={{
            backgroundColor: 'white',
            color: '#111827',
            fontSize: '15px',
          }}
          {...props}
        />
      </div>
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
