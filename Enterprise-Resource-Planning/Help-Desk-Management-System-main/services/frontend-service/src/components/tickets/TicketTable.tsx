// src/components/tickets/TicketTable.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Eye } from 'lucide-react';
import type { Ticket } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { Button } from '@/components/ui/Button';
import { THEME } from '@/lib/theme';
import { formatRelativeTime, truncateText } from '@/lib/helpers';
import type { ColumnKey } from './presets/types';

interface TicketTableProps {
  rows: Ticket[];
  columns: ColumnKey[];
  rowHref: (t: Ticket) => string;
  selection?: {
    selected: Set<string>;
    onToggle: (id: string) => void;
    onToggleAll: () => void;
    allSelected: boolean;
  };
}

const columnLabels: Record<ColumnKey, string> = {
  ticketId: 'Ticket ID',
  subject: 'Title',
  status: 'Status',
  priority: 'Priority',
  department: 'Department',
  assignee: 'Assignee',
  requestor: 'Requestor',
  submittedDate: 'Created',
  progressPercent: 'Progress',
  completionPreview: 'Completion',
  actions: '',
};

export const TicketTable: React.FC<TicketTableProps> = ({ rows, columns, rowHref, selection }) => {
  const router = useRouter();

  const renderCell = (col: ColumnKey, t: Ticket) => {
    switch (col) {
      case 'ticketId':
        return (
          <span
            className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md"
            style={{
              color: THEME.colors.primary,
              backgroundColor: THEME.colors.light + '40',
              border: `1px solid ${THEME.colors.light}80`,
            }}
          >
            {t.ticketId}
          </span>
        );
      case 'subject':
        return (
          <p className="text-sm font-medium text-gray-900 truncate max-w-xs" title={t.subject}>
            {truncateText(t.subject, 60)}
          </p>
        );
      case 'status': return <StatusBadge status={t.status} />;
      case 'priority': return <PriorityBadge priority={t.priority} />;
      case 'department':
        return <span className="text-sm text-gray-600">{t.department}</span>;
      case 'assignee':
        return <span className="text-sm text-gray-600">{t.assigneeName || 'Unassigned'}</span>;
      case 'requestor':
        return <span className="text-sm text-gray-600">{t.requestorName}</span>;
      case 'submittedDate':
        return <span className="text-sm text-gray-500">{formatRelativeTime(t.submittedDate)}</span>;
      case 'progressPercent': {
        const pct = (t as any).progress_percent ?? 0;
        return (
          <div className="flex items-center gap-2 w-24">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: THEME.colors.light + '60' }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: THEME.colors.medium }} />
            </div>
            <span className="text-xs font-semibold" style={{ color: THEME.colors.primary }}>{pct}%</span>
          </div>
        );
      }
      case 'completionPreview': {
        const note = (t as any).completionNote || '';
        return <span className="text-xs text-gray-500 truncate block max-w-[200px]">{truncateText(note, 50) || '—'}</span>;
      }
      case 'actions':
        return (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Eye className="w-3.5 h-3.5" />}
            onClick={(e) => { e.stopPropagation(); router.push(rowHref(t)); }}
          >
            View
          </Button>
        );
    }
  };

  return (
    <div
      className="bg-white rounded-2xl ring-1 ring-black/[0.04] overflow-hidden"
      style={{ boxShadow: '0 4px 20px -8px rgba(39,76,119,0.10)' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: THEME.colors.background + 'CC', borderBottom: `1px solid ${THEME.colors.light}60` }}>
              {selection && (
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selection.allSelected}
                    onChange={selection.onToggleAll}
                    aria-label="Select all"
                  />
                </th>
              )}
              {columns.map(col => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em]"
                  style={{ color: THEME.colors.medium }}
                >
                  {columnLabels[col]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(t => (
              <tr
                key={t.id}
                onClick={() => router.push(rowHref(t))}
                className="cursor-pointer transition-colors hover:bg-gray-50 border-b last:border-0"
                style={{ borderColor: THEME.colors.light + '40' }}
              >
                {selection && (
                  <td className="px-3 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selection.selected.has(t.id)}
                      onChange={() => selection.onToggle(t.id)}
                      aria-label={`Select ticket ${t.ticketId}`}
                    />
                  </td>
                )}
                {columns.map(col => (
                  <td key={col} className="px-4 py-3 align-middle">
                    {renderCell(col, t)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
