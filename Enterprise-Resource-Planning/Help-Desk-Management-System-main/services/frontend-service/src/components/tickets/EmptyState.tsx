// src/components/tickets/EmptyState.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { THEME } from '@/lib/theme';

interface EmptyStateProps {
  title: string;
  message: string;
  cta?: { label: string; href: string };
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, message, cta }) => (
  <div
    className="rounded-2xl bg-white ring-1 ring-black/[0.04] p-10 text-center"
    style={{ boxShadow: '0 4px 20px -8px rgba(39,76,119,0.10)' }}
  >
    <div
      className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
      style={{ backgroundColor: THEME.colors.light + '40' }}
    >
      <Inbox className="w-7 h-7" style={{ color: THEME.colors.medium }} />
    </div>
    <h3 className="text-base font-bold mb-1.5" style={{ color: THEME.colors.primary }}>
      {title}
    </h3>
    <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">{message}</p>
    {cta && (
      <Link href={cta.href}>
        <Button variant="primary" size="sm">{cta.label}</Button>
      </Link>
    )}
  </div>
);
