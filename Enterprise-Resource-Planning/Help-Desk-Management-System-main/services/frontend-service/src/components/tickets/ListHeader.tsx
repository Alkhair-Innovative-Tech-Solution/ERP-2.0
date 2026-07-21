// src/components/tickets/ListHeader.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { THEME } from '@/lib/theme';

interface ListHeaderProps {
  title: string;
  subtitle?: string;
  primaryAction?: { label: string; href: string; icon?: LucideIcon };
}

export const ListHeader: React.FC<ListHeaderProps> = ({ title, subtitle, primaryAction }) => (
  <div
    className="relative bg-white rounded-2xl overflow-hidden ring-1 ring-black/[0.04]"
    style={{ boxShadow: '0 4px 20px -8px rgba(39,76,119,0.12)' }}
  >
    <div
      className="h-1 w-full"
      style={{
        background: `linear-gradient(90deg, ${THEME.colors.primary} 0%, ${THEME.colors.medium} 55%, ${THEME.colors.light} 100%)`,
      }}
    />
    <div className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold leading-tight" style={{ color: THEME.colors.primary }}>
          {title}
        </h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {primaryAction && (
        <Link href={primaryAction.href} className="flex-none">
          <Button
            variant="primary"
            size="md"
            leftIcon={primaryAction.icon ? <primaryAction.icon className="w-4 h-4" /> : undefined}
            className="w-full sm:w-auto"
          >
            {primaryAction.label}
          </Button>
        </Link>
      )}
    </div>
  </div>
);
