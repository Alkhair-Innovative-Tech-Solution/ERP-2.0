'use client';

import React from 'react';
import { getStatusColor, getStatusLabel } from '../../lib/helpers';
import { THEME } from '../../lib/theme';

interface StatusBadgeProps {
  status: string;
  withIcon?: boolean;
  withBorder?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  withIcon = false, 
  withBorder = false 
}) => {
  const color = getStatusColor(status);
  const label = getStatusLabel(status);

  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor: `${color}20`,
        color: color,
        border: withBorder ? `1px solid ${color}` : 'none',
      }}
    >
      {label}
    </span>
  );
};

