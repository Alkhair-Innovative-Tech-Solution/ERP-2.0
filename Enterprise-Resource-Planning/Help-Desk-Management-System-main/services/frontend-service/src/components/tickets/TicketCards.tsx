// src/components/tickets/TicketCards.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import type { Ticket } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { THEME } from '@/lib/theme';
import { formatRelativeTime, truncateText } from '@/lib/helpers';

interface TicketCardsProps {
  rows: Ticket[];
  rowHref: (t: Ticket) => string;
  priorityAccent?: boolean;
}

const priorityColor = (p: string): string => {
  switch (p) {
    case 'urgent': return '#DC2626';
    case 'high': return '#EF4444';
    case 'medium': return '#F59E0B';
    case 'low': return '#10B981';
    default: return THEME.colors.medium;
  }
};

export const TicketCards: React.FC<TicketCardsProps> = ({ rows, rowHref, priorityAccent }) => {
  const router = useRouter();
  return (
    <div className="space-y-2.5">
      {rows.map(t => (
        <button
          key={t.id}
          onClick={() => router.push(rowHref(t))}
          className="relative w-full text-left bg-white rounded-2xl ring-1 ring-black/[0.04] overflow-hidden transition-all active:scale-[0.99]"
          style={{ boxShadow: '0 2px 10px -4px rgba(39,76,119,0.08)' }}
        >
          {priorityAccent && (
            <div
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{ backgroundColor: priorityColor(t.priority) }}
            />
          )}
          <div className="flex items-start gap-3 p-3.5 pl-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                <span
                  className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md"
                  style={{
                    color: THEME.colors.primary,
                    backgroundColor: THEME.colors.light + '40',
                    border: `1px solid ${THEME.colors.light}80`,
                  }}
                >
                  {t.ticketId}
                </span>
                <PriorityBadge priority={t.priority} />
              </div>
              <p className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1.5">
                {truncateText(t.subject, 80)}
              </p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500">
                <StatusBadge status={t.status} />
                <span>·</span>
                <span>{t.department}</span>
                <span>·</span>
                <span>{formatRelativeTime(t.submittedDate)}</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 flex-none mt-1" style={{ color: THEME.colors.gray }} />
          </div>
        </button>
      ))}
    </div>
  );
};
