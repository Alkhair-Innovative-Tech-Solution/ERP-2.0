'use client';

import React from 'react';
import { THEME } from '../../lib/theme';

interface SkeletonLoaderProps {
  type?: 'text' | 'card' | 'circle' | 'rect';
  width?: string | number;
  height?: string | number;
  className?: string;
  count?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  type = 'text',
  width,
  height,
  className = '',
  count = 1,
}) => {
  const baseClasses = 'animate-pulse rounded';
  
  const typeClasses = {
    text: 'h-4',
    card: 'h-32',
    circle: 'rounded-full',
    rect: 'h-20',
  };

  const style: React.CSSProperties = {
    backgroundColor: THEME.colors.light,
    width: width || (type === 'circle' ? '40px' : '100%'),
    height: height || (type === 'circle' ? '40px' : undefined),
  };

  if (count > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className={`${baseClasses} ${typeClasses[type]}`}
            style={style}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${typeClasses[type]} ${className}`}
      style={style}
    />
  );
};

// Pre-built skeleton components
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
    <SkeletonLoader type="text" width="60%" className="mb-4" />
    <SkeletonLoader type="text" width="100%" className="mb-2" />
    <SkeletonLoader type="text" width="80%" />
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({ 
  rows = 5, 
  cols = 4 
}) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="flex gap-4">
        {Array.from({ length: cols }).map((_, colIndex) => (
          <SkeletonLoader 
            key={colIndex} 
            type="text" 
            width={`${100 / cols}%`}
            height="40px"
          />
        ))}
      </div>
    ))}
  </div>
);

