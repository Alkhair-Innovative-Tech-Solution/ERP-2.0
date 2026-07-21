import React from 'react';
import { THEME } from '../../lib/theme';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
  variant?: 'default' | 'elevated' | 'outlined';
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  onClick,
  style,
  variant = 'default'
}) => {
  return (
    <div
      className={`
        bg-white rounded-xl border transition-shadow duration-300
        ${variant === 'default' ? 'shadow-md hover:shadow-lg' : ''}
        ${variant === 'elevated' ? 'shadow-lg hover:shadow-xl' : ''}
        ${variant === 'outlined' ? 'shadow-sm border-2' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      style={{
        borderColor: variant === 'outlined' ? '#8b8c89' : 'transparent',
        ...style
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ children, className = '' }) => {
  return (
    <div className={`px-6 py-5 border-b ${className}`} style={{ borderColor: THEME.colors.medium + '20' }}>
      {children}
    </div>
  );
};

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const CardTitle: React.FC<CardTitleProps> = ({ children, className = '', style }) => {
  return (
    <h3 className={`text-xl font-semibold ${className}`} style={style}>
      {children}
    </h3>
  );
};

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export const CardContent: React.FC<CardContentProps> = ({ children, className = '' }) => {
  return (
    <div className={`px-6 py-6 ${className}`}>
      {children}
    </div>
  );
};

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const CardFooter: React.FC<CardFooterProps> = ({ children, className = '' }) => {
  return (
    <div className={`px-6 py-4 border-t ${className}`} style={{ borderColor: THEME.colors.medium + '20' }}>
      {children}
    </div>
  );
};

