'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { FilterBar } from '@/components/common/FilterBar';
import { SelectOption } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { THEME } from '@/lib/theme';
import { ListHeader } from './ListHeader';
import { TicketTable } from './TicketTable';
import { TicketCards } from './TicketCards';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { BulkActionBar } from './BulkActionBar';
import type { TicketListPreset } from './presets/types';

const PAGE_SIZE = 10;

const DEFAULT_STATUS_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'pending', label: 'Pending' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'rejected', label: 'Rejected' },
];

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All Priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const DATE_RANGE_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All Time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

interface TicketListViewProps {
  preset: TicketListPreset;
}

export const TicketListView: React.FC<TicketListViewProps> = ({ preset }) => {
  const { filters, setFilters, clearFilters } = useUrlFilters(preset.availableFilters);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Reset page + selection when filters change
  useEffect(() => {
    setPage(p => (p === 1 ? p : 1));
    setSelected(s => (s.size === 0 ? s : new Set()));
  }, [filters]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...preset.queryKey, preset.baseFilters, filters, page],
    queryFn: () =>
      preset.fetchFn({
        page,
        pageSize: PAGE_SIZE,
        filters,
        baseFilters: preset.baseFilters ?? {},
      }),
  });

  const rows = data?.results ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const departmentOptions = useMemo<SelectOption[]>(() => {
    const departments = Array.from(new Set(rows.map(t => t.department))).sort();
    return [{ value: 'all', label: 'All Departments' }, ...departments.map(d => ({ value: d, label: d }))];
  }, [rows]);

  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id));
  const toggleSelection = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected(prev => {
      if (allSelected) return new Set();
      const next = new Set(prev);
      rows.forEach(r => next.add(r.id));
      return next;
    });
  };

  const selectionConfig = preset.enableBulkActions
    ? { selected, onToggle: toggleSelection, onToggleAll: toggleAll, allSelected }
    : undefined;

  return (
    <div
      className="relative flex flex-col gap-3 p-4 min-h-full"
      style={{
        background: `
          radial-gradient(1200px 600px at 0% 0%, ${THEME.colors.light}22 0%, transparent 55%),
          radial-gradient(900px 500px at 100% 100%, ${THEME.colors.medium}18 0%, transparent 60%),
          linear-gradient(180deg, ${THEME.colors.background} 0%, #EEF3F7 100%)
        `,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `radial-gradient(${THEME.colors.medium}22 1px, transparent 1px)`,
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
        }}
      />
      <div className="relative space-y-3">
        <ListHeader title={preset.title} subtitle={preset.subtitle} primaryAction={preset.primaryAction} />

        <FilterBar
          filters={filters}
          onFilterChange={setFilters}
          statusOptions={preset.statusOptions ?? DEFAULT_STATUS_OPTIONS}
          priorityOptions={PRIORITY_OPTIONS}
          departmentOptions={departmentOptions}
          dateRangeOptions={DATE_RANGE_OPTIONS}
          onClearFilters={clearFilters}
        />

        {preset.enableBulkActions && selected.size > 0 && preset.bulkActions && (
          <BulkActionBar
            selectedCount={selected.size}
            selectedIds={Array.from(selected)}
            actions={preset.bulkActions}
            onClear={() => setSelected(new Set())}
          />
        )}

        {isError ? (
          <ErrorState message="Failed to load tickets." onRetry={() => refetch()} />
        ) : isLoading ? (
          <SkeletonRows />
        ) : rows.length === 0 ? (
          <EmptyState {...preset.emptyState} />
        ) : (
          <>
            <div className="hidden md:block">
              <TicketTable rows={rows} columns={preset.columns} rowHref={preset.rowHref} selection={selectionConfig} />
            </div>
            <div className="block md:hidden">
              <TicketCards rows={rows} rowHref={preset.rowHref} priorityAccent={preset.priorityAccent} />
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
};

const SkeletonRows: React.FC = () => (
  <div className="space-y-2">
    {[0, 1, 2, 3, 4].map(i => (
      <div
        key={i}
        className="h-14 rounded-2xl bg-white ring-1 ring-black/[0.04] animate-pulse"
        style={{ boxShadow: '0 2px 10px -4px rgba(39,76,119,0.06)' }}
      />
    ))}
  </div>
);

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ page, totalPages, total, pageSize, onChange }) => {
  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div
      className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white rounded-2xl ring-1 ring-black/[0.04] p-3"
      style={{ boxShadow: '0 2px 10px -4px rgba(39,76,119,0.06)' }}
    >
      <div className="text-xs text-gray-500">
        Showing <b style={{ color: THEME.colors.primary }}>{start}–{end}</b> of <b style={{ color: THEME.colors.primary }}>{total}</b>
      </div>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={() => onChange(1)} disabled={page === 1}>««</Button>
        <Button variant="outline" size="sm" onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}>‹</Button>
        <span className="text-xs font-semibold px-2" style={{ color: THEME.colors.primary }}>
          {page} / {totalPages}
        </span>
        <Button variant="outline" size="sm" onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>›</Button>
        <Button variant="outline" size="sm" onClick={() => onChange(totalPages)} disabled={page >= totalPages}>»»</Button>
      </div>
    </div>
  );
};
