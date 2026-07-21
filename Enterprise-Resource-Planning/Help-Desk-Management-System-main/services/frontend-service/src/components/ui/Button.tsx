import React from 'react';
import { THEME } from '../../lib/theme';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  leftIcon,
  rightIcon,
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = 'font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group';
  
  const variantClasses = {
    primary: {
      bg: '#365486', // primary-medium
      text: 'white',
      hover: 'hover:bg-[#365486]/90 hover:scale-105 active:scale-95',
      border: 'none',
      before: 'before:absolute before:inset-0 before:bg-white before:opacity-0 before:transition-opacity hover:before:opacity-10',
    },
    secondary: {
      bg: THEME.colors.light,
      text: THEME.colors.primary,
      hover: 'hover:bg-opacity-90 hover:shadow-md active:scale-[0.98]',
      border: 'none',
      before: '',
    },
    success: {
      bg: THEME.colors.success,
      text: 'white',
      hover: 'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
      border: 'none',
      before: 'before:absolute before:inset-0 before:bg-white before:opacity-0 before:transition-opacity hover:before:opacity-10',
    },
    danger: {
      bg: THEME.colors.error,
      text: 'white',
      hover: 'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
      border: 'none',
      before: 'before:absolute before:inset-0 before:bg-white before:opacity-0 before:transition-opacity hover:before:opacity-10',
    },
    warning: {
      bg: THEME.colors.warning,
      text: 'white',
      hover: 'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
      border: 'none',
      before: 'before:absolute before:inset-0 before:bg-white before:opacity-0 before:transition-opacity hover:before:opacity-10',
    },
    ghost: {
      bg: 'transparent',
      text: THEME.colors.primary,
      hover: 'hover:bg-gray-100 active:scale-[0.98]',
      border: 'none',
      before: '',
    },
    outline: {
      bg: 'transparent',
      text: THEME.colors.primary,
      border: `2px solid ${THEME.colors.primary}`,
      hover: 'hover:bg-gray-50 hover:shadow-md active:scale-[0.98]',
      before: '',
    },
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm font-medium',
    md: 'px-5 py-2.5 text-base font-semibold',
    lg: 'px-6 py-3.5 text-lg font-semibold',
  };
  
  const currentVariant = variantClasses[variant];
  
  return (
    <button
      className={`
        ${baseClasses}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${loading ? 'cursor-wait' : ''}
        ${currentVariant.hover}
        ${currentVariant.before}
        ${className}
      `}
      style={{
        backgroundColor: variant === 'outline' ? 'transparent' : (props.style?.backgroundColor || currentVariant.bg),
        color: props.style?.color || currentVariant.text,
        border: variant === 'outline' ? currentVariant.border : 'none',
        boxShadow: variant !== 'ghost' && variant !== 'outline' ? '0 2px 4px rgba(0, 0, 0, 0.1)' : 'none',
        ...props.style,
      }}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Loading...</span>
        </span>
      ) : (
        <>
          {leftIcon && <span className="flex-shrink-0 transition-transform group-hover:scale-110">{leftIcon}</span>}
          <span className="relative z-10" style={{ color: 'inherit' }}>{children}</span>
          {rightIcon && <span className="flex-shrink-0 transition-transform group-hover:scale-110">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};