'use client';

import React from 'react';
import { FileX, Inbox } from 'lucide-react';
import { THEME } from '../../lib/theme';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({
  title = 'No data found',
  description = 'There are no items to display at this time.',
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon || (
        <div className="mb-4 p-4 rounded-full" style={{ backgroundColor: THEME.colors.light }}>
          <Inbox className="w-12 h-12" style={{ color: THEME.colors.gray }} />
        </div>
      )}
      <h3 className="text-lg font-semibold mb-2" style={{ color: THEME.colors.primary }}>
        {title}
      </h3>
      <p className="text-sm text-gray-600 max-w-sm mb-4">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default EmptyState;

