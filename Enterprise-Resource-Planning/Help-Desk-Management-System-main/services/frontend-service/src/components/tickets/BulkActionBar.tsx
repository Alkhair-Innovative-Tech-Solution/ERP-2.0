// src/components/tickets/BulkActionBar.tsx
'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { THEME } from '@/lib/theme';
import type { BulkAction } from './presets/types';

interface BulkActionBarProps {
  selectedCount: number;
  selectedIds: string[];
  actions: BulkAction[];
  onClear: () => void;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount, selectedIds, actions, onClear,
}) => {
  const [running, setRunning] = useState<string | null>(null);

  const handleRun = async (action: BulkAction) => {
    setRunning(action.id);
    try {
      await action.onRun(selectedIds);
    } finally {
      setRunning(null);
    }
  };

  return (
    <div
      className="sticky top-2 z-10 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white ring-1 ring-black/[0.04]"
      style={{ boxShadow: '0 8px 24px -8px rgba(39,76,119,0.18)' }}
    >
      <button
        onClick={onClear}
        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100"
        aria-label="Clear selection"
      >
        <X className="w-4 h-4" style={{ color: THEME.colors.gray }} />
      </button>
      <span className="text-sm font-semibold flex-1" style={{ color: THEME.colors.primary }}>
        {selectedCount} selected
      </span>
      <div className="flex items-center gap-2">
        {actions.map(action => {
          const Icon = action.icon;
          return (
            <Button
              key={action.id}
              size="sm"
              variant={action.variant ?? 'outline'}
              leftIcon={Icon ? <Icon className="w-3.5 h-3.5" /> : undefined}
              loading={running === action.id}
              disabled={running !== null && running !== action.id}
              onClick={() => handleRun(action)}
            >
              {action.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
};
