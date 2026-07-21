# Unified Ticket List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate 4 duplicated ticket-list pages (requestor requests, assignee tasks, moderator pool, moderator review) into a single shared `<TicketListView>` component driven by per-scope preset files. Route URLs preserved.

**Architecture:** Dumb `<TicketListView>` component + per-scope preset factories. React Query for caching, URL sync for filters, TanStack breakpoints for responsive table ↔ cards. No backend changes.

**Tech Stack:** Next.js 15, React 18, TypeScript, @tanstack/react-query ^5, Vitest + @testing-library/react, Tailwind, Lucide icons.

**Related spec:** `Docs/specs/2026-04-22-unified-ticket-list-design.md`

**Working directory for all commands:** `services/frontend-service/`

---

## File Structure

```
NEW:
  src/hooks/useUrlFilters.ts
  src/hooks/useUrlFilters.test.ts
  src/components/tickets/TicketListView.tsx
  src/components/tickets/TicketListView.test.tsx
  src/components/tickets/TicketTable.tsx
  src/components/tickets/TicketCards.tsx
  src/components/tickets/ListHeader.tsx
  src/components/tickets/BulkActionBar.tsx
  src/components/tickets/EmptyState.tsx
  src/components/tickets/ErrorState.tsx
  src/components/tickets/presets/types.ts
  src/components/tickets/presets/myRequestsPreset.ts
  src/components/tickets/presets/myTasksPreset.ts
  src/components/tickets/presets/ticketPoolPreset.ts
  src/components/tickets/presets/reviewQueuePreset.ts
  src/components/tickets/presets/index.ts

REWRITTEN (each becomes thin wrapper):
  src/app/(role)/[role]/requests/page.tsx
  src/app/(role)/assignee/tasks/page.tsx
  src/app/(role)/moderator/ticket-pool/page.tsx
  src/app/(role)/moderator/review/page.tsx
```

---

## Phase 1 — Foundation

### Task 1: Preset type definitions

**Files:**
- Create: `src/components/tickets/presets/types.ts`

- [ ] **Step 1: Create the types file**

```ts
// src/components/tickets/presets/types.ts
import type { LucideIcon } from 'lucide-react';
import type { Ticket } from '@/types';
import type { SelectOption } from '@/components/ui/Select';

export type ColumnKey =
  | 'ticketId'
  | 'subject'
  | 'status'
  | 'priority'
  | 'department'
  | 'assignee'
  | 'requestor'
  | 'submittedDate'
  | 'progressPercent'
  | 'completionPreview'
  | 'actions';

export type FilterKey = 'search' | 'status' | 'priority' | 'department' | 'dateRange';

export interface FilterValues {
  search: string;
  status: string;
  priority: string;
  department: string;
  dateRange: string;
}

export const DEFAULT_FILTERS: FilterValues = {
  search: '',
  status: 'all',
  priority: 'all',
  department: 'all',
  dateRange: 'all',
};

export interface BulkAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  variant?: 'primary' | 'danger' | 'outline';
  onRun: (ticketIds: string[]) => Promise<void>;
}

export interface TicketListResult {
  results: Ticket[];
  count: number;
}

export interface FetchParams {
  page: number;
  pageSize: number;
  filters: FilterValues;
  baseFilters: Record<string, string>;
}

export interface TicketListPreset {
  scope: 'my-requests' | 'my-tasks' | 'ticket-pool' | 'review-queue';
  title: string;
  subtitle?: string;

  queryKey: readonly unknown[];
  fetchFn: (params: FetchParams) => Promise<TicketListResult>;
  baseFilters?: Record<string, string>;

  columns: ColumnKey[];
  priorityAccent?: boolean;
  enableBulkActions?: boolean;
  bulkActions?: BulkAction[];

  availableFilters: FilterKey[];
  statusOptions?: SelectOption[];

  emptyState: {
    title: string;
    message: string;
    cta?: { label: string; href: string };
  };
  primaryAction?: { label: string; href: string; icon?: LucideIcon };

  rowHref: (t: Ticket) => string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd services/frontend-service && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add services/frontend-service/src/components/tickets/presets/types.ts
git commit -m "feat(tickets): add TicketListPreset type contract"
```

---

### Task 2: `useUrlFilters` hook (TDD)

**Files:**
- Test: `src/hooks/useUrlFilters.test.ts`
- Create: `src/hooks/useUrlFilters.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/hooks/useUrlFilters.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUrlFilters } from './useUrlFilters';
import { DEFAULT_FILTERS } from '@/components/tickets/presets/types';

const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/requestor/requests',
}));

beforeEach(() => {
  mockReplace.mockClear();
  mockSearchParams = new URLSearchParams();
});

describe('useUrlFilters', () => {
  it('returns default filters when URL has no params', () => {
    const { result } = renderHook(() => useUrlFilters(['search', 'status', 'priority', 'department', 'dateRange']));
    expect(result.current.filters).toEqual(DEFAULT_FILTERS);
  });

  it('reads filters from URL params on mount', () => {
    mockSearchParams = new URLSearchParams('status=in_progress&priority=high');
    const { result } = renderHook(() => useUrlFilters(['search', 'status', 'priority', 'department', 'dateRange']));
    expect(result.current.filters.status).toBe('in_progress');
    expect(result.current.filters.priority).toBe('high');
    expect(result.current.filters.search).toBe('');
  });

  it('writes filters to URL on change (omitting "all" and empty)', () => {
    const { result } = renderHook(() => useUrlFilters(['search', 'status', 'priority', 'department', 'dateRange']));
    act(() => {
      result.current.setFilters({ ...DEFAULT_FILTERS, status: 'resolved', search: 'printer' });
    });
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringMatching(/\/requestor\/requests\?.*status=resolved.*search=printer|\/requestor\/requests\?.*search=printer.*status=resolved/),
      { scroll: false }
    );
  });

  it('clearFilters resets to defaults and clears URL', () => {
    mockSearchParams = new URLSearchParams('status=in_progress');
    const { result } = renderHook(() => useUrlFilters(['search', 'status', 'priority', 'department', 'dateRange']));
    act(() => { result.current.clearFilters(); });
    expect(result.current.filters).toEqual(DEFAULT_FILTERS);
    expect(mockReplace).toHaveBeenCalledWith('/requestor/requests', { scroll: false });
  });

  it('ignores filter keys not in availableFilters', () => {
    mockSearchParams = new URLSearchParams('status=in_progress&priority=high');
    const { result } = renderHook(() => useUrlFilters(['search', 'status']));
    expect(result.current.filters.status).toBe('in_progress');
    expect(result.current.filters.priority).toBe('all'); // default, not read
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/frontend-service && npx vitest run src/hooks/useUrlFilters.test.ts`
Expected: FAIL — `useUrlFilters` not defined.

- [ ] **Step 3: Implement the hook**

```ts
// src/hooks/useUrlFilters.ts
'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  DEFAULT_FILTERS,
  FilterKey,
  FilterValues,
} from '@/components/tickets/presets/types';

export function useUrlFilters(availableFilters: FilterKey[]) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo<FilterValues>(() => {
    const next = { ...DEFAULT_FILTERS };
    availableFilters.forEach(key => {
      const value = searchParams.get(key);
      if (value) next[key] = value;
    });
    return next;
  }, [availableFilters, searchParams]);

  const writeToUrl = useCallback(
    (next: FilterValues) => {
      const params = new URLSearchParams();
      availableFilters.forEach(key => {
        const value = next[key];
        if (value && value !== 'all') params.set(key, value);
      });
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [availableFilters, pathname, router]
  );

  const setFilters = useCallback(
    (next: FilterValues) => writeToUrl(next),
    [writeToUrl]
  );

  const clearFilters = useCallback(() => writeToUrl(DEFAULT_FILTERS), [writeToUrl]);

  return { filters, setFilters, clearFilters };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd services/frontend-service && npx vitest run src/hooks/useUrlFilters.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add services/frontend-service/src/hooks/useUrlFilters.ts services/frontend-service/src/hooks/useUrlFilters.test.ts
git commit -m "feat(hooks): add useUrlFilters for URL-synced filter state"
```

---

### Task 3: `EmptyState` and `ErrorState` components

**Files:**
- Create: `src/components/tickets/EmptyState.tsx`
- Create: `src/components/tickets/ErrorState.tsx`

- [ ] **Step 1: Create EmptyState**

```tsx
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
```

- [ ] **Step 2: Create ErrorState**

```tsx
// src/components/tickets/ErrorState.tsx
'use client';

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { THEME } from '@/lib/theme';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => (
  <div
    className="rounded-2xl bg-white ring-1 ring-black/[0.04] p-8 text-center"
    style={{ boxShadow: '0 4px 20px -8px rgba(239,68,68,0.10)' }}
  >
    <div
      className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
      style={{ backgroundColor: THEME.colors.error + '15' }}
    >
      <AlertCircle className="w-6 h-6" style={{ color: THEME.colors.error }} />
    </div>
    <h3 className="text-sm font-bold mb-1" style={{ color: THEME.colors.primary }}>
      Something went wrong
    </h3>
    <p className="text-sm text-gray-500 mb-4">{message}</p>
    {onRetry && (
      <Button variant="outline" size="sm" leftIcon={<RefreshCw className="w-3.5 h-3.5" />} onClick={onRetry}>
        Retry
      </Button>
    )}
  </div>
);
```

- [ ] **Step 3: TypeScript check**

Run: `cd services/frontend-service && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add services/frontend-service/src/components/tickets/EmptyState.tsx services/frontend-service/src/components/tickets/ErrorState.tsx
git commit -m "feat(tickets): add EmptyState and ErrorState components"
```

---

### Task 4: `ListHeader` component

**Files:**
- Create: `src/components/tickets/ListHeader.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
```

- [ ] **Step 2: TypeScript check**

Run: `cd services/frontend-service && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add services/frontend-service/src/components/tickets/ListHeader.tsx
git commit -m "feat(tickets): add ListHeader component"
```

---

### Task 5: `TicketTable` component (desktop)

**Files:**
- Create: `src/components/tickets/TicketTable.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
```

- [ ] **Step 2: TypeScript check**

Run: `cd services/frontend-service && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add services/frontend-service/src/components/tickets/TicketTable.tsx
git commit -m "feat(tickets): add TicketTable desktop component"
```

---

### Task 6: `TicketCards` component (mobile)

**Files:**
- Create: `src/components/tickets/TicketCards.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
```

- [ ] **Step 2: TypeScript check**

Run: `cd services/frontend-service && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add services/frontend-service/src/components/tickets/TicketCards.tsx
git commit -m "feat(tickets): add TicketCards mobile component"
```

---

### Task 7: `BulkActionBar` component

**Files:**
- Create: `src/components/tickets/BulkActionBar.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
```

- [ ] **Step 2: TypeScript check**

Run: `cd services/frontend-service && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add services/frontend-service/src/components/tickets/BulkActionBar.tsx
git commit -m "feat(tickets): add BulkActionBar for multi-select operations"
```

---

### Task 8: `TicketListView` main component (TDD)

**Files:**
- Test: `src/components/tickets/TicketListView.test.tsx`
- Create: `src/components/tickets/TicketListView.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/tickets/TicketListView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TicketListView } from './TicketListView';
import type { TicketListPreset } from './presets/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/requestor/requests',
}));

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

const basePreset = (overrides: Partial<TicketListPreset> = {}): TicketListPreset => ({
  scope: 'my-requests',
  title: 'My Requests',
  queryKey: ['tickets', 'my-requests'],
  fetchFn: vi.fn().mockResolvedValue({ results: [], count: 0 }),
  columns: ['ticketId', 'subject', 'status', 'priority', 'submittedDate', 'actions'],
  availableFilters: ['search', 'status', 'priority', 'department', 'dateRange'],
  emptyState: { title: 'No tickets', message: 'Nothing here yet.' },
  rowHref: (t) => `/requestor/ticket/${t.id}`,
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

describe('TicketListView', () => {
  it('shows the title and subtitle', async () => {
    render(<TicketListView preset={basePreset({ subtitle: 'All yours' })} />, { wrapper });
    expect(await screen.findByText('My Requests')).toBeInTheDocument();
    expect(screen.getByText('All yours')).toBeInTheDocument();
  });

  it('shows empty state when results array is empty', async () => {
    render(<TicketListView preset={basePreset()} />, { wrapper });
    expect(await screen.findByText('No tickets')).toBeInTheDocument();
  });

  it('shows error state and retry when fetchFn rejects', async () => {
    const preset = basePreset({
      fetchFn: vi.fn().mockRejectedValue(new Error('boom')),
    });
    render(<TicketListView preset={preset} />, { wrapper });
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls fetchFn with base filters merged in', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ results: [], count: 0 });
    render(
      <TicketListView preset={basePreset({ fetchFn, baseFilters: { requestorId: 'u-1' } })} />,
      { wrapper }
    );
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    const callArg = fetchFn.mock.calls[0][0];
    expect(callArg.baseFilters).toEqual({ requestorId: 'u-1' });
    expect(callArg.page).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/frontend-service && npx vitest run src/components/tickets/TicketListView.test.tsx`
Expected: FAIL — `TicketListView` not defined.

- [ ] **Step 3: Implement `TicketListView`**

```tsx
// src/components/tickets/TicketListView.tsx
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
    setPage(1);
    setSelected(new Set());
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd services/frontend-service && npx vitest run src/components/tickets/TicketListView.test.tsx`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: TypeScript check**

Run: `cd services/frontend-service && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add services/frontend-service/src/components/tickets/TicketListView.tsx services/frontend-service/src/components/tickets/TicketListView.test.tsx
git commit -m "feat(tickets): add TicketListView main component with tests"
```

---

### Task 9: Presets barrel file

**Files:**
- Create: `src/components/tickets/presets/index.ts`

- [ ] **Step 1: Create placeholder barrel (presets added in later tasks)**

```ts
// src/components/tickets/presets/index.ts
export * from './types';
export * from './myRequestsPreset';
export * from './myTasksPreset';
export * from './ticketPoolPreset';
export * from './reviewQueuePreset';
```

Note: this file will fail to compile until Tasks 10, 12, 14, 15 are done. Skip commit for now; commit together with Task 10.

---

## Phase 2 — Migrate `my-requests`

### Task 10: `myRequestsPreset` + page rewrite

**Files:**
- Create: `src/components/tickets/presets/myRequestsPreset.ts`
- Rewrite: `src/app/(role)/[role]/requests/page.tsx`

- [ ] **Step 1: Create the preset**

```ts
// src/components/tickets/presets/myRequestsPreset.ts
import { Plus } from 'lucide-react';
import ticketService from '@/services/api/ticketService';
import type { TicketListPreset } from './types';

export function myRequestsPreset(userId: string, role: string): TicketListPreset {
  return {
    scope: 'my-requests',
    title: 'My Requests',
    subtitle: 'View and manage all your submitted tickets',

    queryKey: ['tickets', 'my-requests', userId],
    fetchFn: async ({ page, pageSize, filters, baseFilters }) => {
      const apiFilters: Record<string, unknown> = { page, pageSize, ...baseFilters };
      if (filters.status !== 'all') apiFilters.status = filters.status;
      if (filters.priority !== 'all') apiFilters.priority = filters.priority;
      if (filters.department !== 'all') apiFilters.department = filters.department;
      if (filters.search) apiFilters.search = filters.search;
      if (filters.dateRange !== 'all') {
        const days = parseInt(filters.dateRange);
        if (!Number.isNaN(days)) {
          const d = new Date();
          d.setDate(d.getDate() - days);
          apiFilters.createdAfter = d.toISOString();
        }
      }
      const response = await ticketService.getTickets(apiFilters as any);
      const results = Array.isArray(response) ? response : (response?.results ?? []);
      const count = Array.isArray(response) ? response.length : (response?.count ?? results.length);
      return { results, count };
    },
    baseFilters: { requestorId: userId },

    columns: ['ticketId', 'subject', 'status', 'priority', 'department', 'submittedDate', 'actions'],
    priorityAccent: true,

    availableFilters: ['search', 'status', 'priority', 'department', 'dateRange'],

    emptyState: {
      title: 'No requests yet',
      message: 'Try adjusting your filters or create your first request.',
      cta: { label: 'New Request', href: `/${role}/new-request` },
    },
    primaryAction: { label: 'New Request', href: `/${role}/new-request`, icon: Plus },

    rowHref: (t) => `/${role}/ticket/${t.id}`,
  };
}
```

- [ ] **Step 2: Rewrite the page**

```tsx
// src/app/(role)/[role]/requests/page.tsx
'use client';

import React from 'react';
import { useAuth } from '@/lib/auth';
import { TicketListView } from '@/components/tickets/TicketListView';
import { myRequestsPreset } from '@/components/tickets/presets';

export default function RequestsPage() {
  const { user } = useAuth();
  if (!user?.id) return null;
  const role = user.role ?? 'requestor';
  return <TicketListView preset={myRequestsPreset(user.id, role)} />;
}
```

- [ ] **Step 3: TypeScript check**

Run: `cd services/frontend-service && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Run all tests**

Run: `cd services/frontend-service && npx vitest run`
Expected: all pass.

- [ ] **Step 5: Manual QA — requestor requests**

- Start dev server: `cd services/frontend-service && npm run dev`
- Login as requestor, visit `/requestor/requests`
- Verify: list loads, status filter works, URL updates with `?status=…`, refresh preserves filter, clicking row navigates to ticket detail, "New Request" button works, empty state shows when all filtered out.

- [ ] **Step 6: Commit**

```bash
git add services/frontend-service/src/components/tickets/presets/myRequestsPreset.ts services/frontend-service/src/components/tickets/presets/index.ts services/frontend-service/src/app/\(role\)/\[role\]/requests/page.tsx
git commit -m "feat(tickets): migrate my-requests page to TicketListView"
```

---

## Phase 3 — Migrate `my-tasks`

### Task 11: `myTasksPreset`

**Files:**
- Create: `src/components/tickets/presets/myTasksPreset.ts`

- [ ] **Step 1: Create the preset**

```ts
// src/components/tickets/presets/myTasksPreset.ts
import ticketService from '@/services/api/ticketService';
import type { TicketListPreset } from './types';

export function myTasksPreset(userId: string, role: string): TicketListPreset {
  return {
    scope: 'my-tasks',
    title: 'My Tasks',
    subtitle: 'Tickets assigned to you',

    queryKey: ['tickets', 'my-tasks', userId],
    fetchFn: async ({ page, pageSize, filters, baseFilters }) => {
      const apiFilters: Record<string, unknown> = { page, pageSize, ...baseFilters };
      if (filters.status !== 'all') apiFilters.status = filters.status;
      if (filters.priority !== 'all') apiFilters.priority = filters.priority;
      if (filters.department !== 'all') apiFilters.department = filters.department;
      if (filters.search) apiFilters.search = filters.search;
      if (filters.dateRange !== 'all') {
        const days = parseInt(filters.dateRange);
        if (!Number.isNaN(days)) {
          const d = new Date();
          d.setDate(d.getDate() - days);
          apiFilters.createdAfter = d.toISOString();
        }
      }
      const response = await ticketService.getTickets(apiFilters as any);
      const results = Array.isArray(response) ? response : (response?.results ?? []);
      const count = Array.isArray(response) ? response.length : (response?.count ?? results.length);
      return { results, count };
    },
    baseFilters: { assigneeId: userId },

    columns: ['ticketId', 'subject', 'status', 'priority', 'progressPercent', 'submittedDate', 'actions'],
    priorityAccent: true,

    availableFilters: ['search', 'status', 'priority', 'department', 'dateRange'],

    emptyState: {
      title: 'No assigned tasks',
      message: 'You have nothing assigned to you right now.',
    },

    rowHref: (t) => `/${role}/ticket/${t.id}`,
  };
}
```

- [ ] **Step 2: Rewrite the page**

```tsx
// src/app/(role)/assignee/tasks/page.tsx
'use client';

import React from 'react';
import { useAuth } from '@/lib/auth';
import { TicketListView } from '@/components/tickets/TicketListView';
import { myTasksPreset } from '@/components/tickets/presets';

export default function MyTasksPage() {
  const { user } = useAuth();
  if (!user?.id) return null;
  const role = user.role ?? 'assignee';
  return <TicketListView preset={myTasksPreset(user.id, role)} />;
}
```

- [ ] **Step 3: TypeScript check**

Run: `cd services/frontend-service && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Manual QA — assignee tasks**

- Login as assignee, visit `/assignee/tasks`
- Verify: assigned tickets list, progress column renders with percent, filters work, row click navigates.

- [ ] **Step 5: Commit**

```bash
git add services/frontend-service/src/components/tickets/presets/myTasksPreset.ts services/frontend-service/src/app/\(role\)/assignee/tasks/page.tsx
git commit -m "feat(tickets): migrate my-tasks page to TicketListView"
```

---

## Phase 4 — Migrate moderator pages

### Task 12: `ticketPoolPreset` with bulk actions

**Files:**
- Create: `src/components/tickets/presets/ticketPoolPreset.ts`

**Context for engineer:** Existing modals `AssignTicketModal`, `RejectTicketModal`, `PostponeModal` live in `src/components/modals/`. They take a single ticket. For bulk actions, we iterate server-side in the preset (sequential calls) — no modal changes required yet. Show a confirm prompt instead for reject/postpone.

- [ ] **Step 1: Create the preset**

```ts
// src/components/tickets/presets/ticketPoolPreset.ts
import { UserPlus, XCircle, Clock } from 'lucide-react';
import ticketService from '@/services/api/ticketService';
import type { TicketListPreset } from './types';

export function ticketPoolPreset(role: string): TicketListPreset {
  const runBulk = async (
    ticketIds: string[],
    verb: string,
    fn: (id: string) => Promise<unknown>,
  ) => {
    const confirmed = typeof window !== 'undefined'
      ? window.confirm(`${verb} ${ticketIds.length} ticket(s)?`)
      : false;
    if (!confirmed) return;
    for (const id of ticketIds) {
      try { await fn(id); } catch (e) { console.error(`Bulk ${verb} failed on ${id}`, e); }
    }
    // Trigger refetch via query invalidation upstream — for simplicity, hard reload.
    if (typeof window !== 'undefined') window.location.reload();
  };

  return {
    scope: 'ticket-pool',
    title: 'Ticket Pool',
    subtitle: 'Unassigned tickets awaiting moderator action',

    queryKey: ['tickets', 'ticket-pool'],
    fetchFn: async ({ page, pageSize, filters, baseFilters }) => {
      const apiFilters: Record<string, unknown> = { page, pageSize, ...baseFilters };
      if (filters.status !== 'all') apiFilters.status = filters.status;
      if (filters.priority !== 'all') apiFilters.priority = filters.priority;
      if (filters.department !== 'all') apiFilters.department = filters.department;
      if (filters.search) apiFilters.search = filters.search;
      const response = await ticketService.getTickets(apiFilters as any);
      const results = Array.isArray(response) ? response : (response?.results ?? []);
      const count = Array.isArray(response) ? response.length : (response?.count ?? results.length);
      return { results, count };
    },
    baseFilters: { status: 'submitted' },

    columns: ['ticketId', 'subject', 'priority', 'department', 'requestor', 'submittedDate', 'actions'],

    availableFilters: ['search', 'priority', 'department', 'dateRange'],

    enableBulkActions: true,
    bulkActions: [
      {
        id: 'reject',
        label: 'Reject',
        icon: XCircle,
        variant: 'danger',
        onRun: (ids) => runBulk(ids, 'Reject', (id) => ticketService.rejectTicket(id, 'Bulk rejection')),
      },
      {
        id: 'postpone',
        label: 'Postpone',
        icon: Clock,
        variant: 'outline',
        onRun: (ids) => runBulk(ids, 'Postpone', (id) => ticketService.postponeTicket(id, 'Bulk postponement')),
      },
    ],

    emptyState: {
      title: 'Ticket pool is empty',
      message: 'No tickets currently need moderator action.',
    },

    rowHref: (t) => `/${role}/ticket/${t.id}`,
  };
}
```

**Note on bulk "Assign":** Assigning requires picking an assignee per ticket, which needs a picker UI not yet built for bulk flow. Drop bulk-assign for this sprint — single-ticket assign still works via the detail page. Document as future work in spec §9.

- [ ] **Step 2: Rewrite the page**

```tsx
// src/app/(role)/moderator/ticket-pool/page.tsx
'use client';

import React from 'react';
import { useAuth } from '@/lib/auth';
import { TicketListView } from '@/components/tickets/TicketListView';
import { ticketPoolPreset } from '@/components/tickets/presets';

export default function TicketPoolPage() {
  const { user } = useAuth();
  if (!user) return null;
  const role = user.role ?? 'moderator';
  return <TicketListView preset={ticketPoolPreset(role)} />;
}
```

- [ ] **Step 3: TypeScript check**

Run: `cd services/frontend-service && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Manual QA — moderator pool**

- Login as moderator, visit `/moderator/ticket-pool`
- Verify: submitted tickets list, select rows via checkbox → BulkActionBar appears, bulk reject confirms and runs, page reloads with updated list.

- [ ] **Step 5: Commit**

```bash
git add services/frontend-service/src/components/tickets/presets/ticketPoolPreset.ts services/frontend-service/src/app/\(role\)/moderator/ticket-pool/page.tsx
git commit -m "feat(tickets): migrate ticket-pool page with bulk reject/postpone"
```

---

### Task 13: `reviewQueuePreset`

**Files:**
- Create: `src/components/tickets/presets/reviewQueuePreset.ts`

- [ ] **Step 1: Create the preset**

```ts
// src/components/tickets/presets/reviewQueuePreset.ts
import ticketService from '@/services/api/ticketService';
import type { SelectOption } from '@/components/ui/Select';
import type { TicketListPreset } from './types';

const REVIEW_STATUS_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'in_progress', label: 'In Progress' },
];

export function reviewQueuePreset(role: string): TicketListPreset {
  return {
    scope: 'review-queue',
    title: 'Review Queue',
    subtitle: 'Completed tickets awaiting final review',

    queryKey: ['tickets', 'review-queue'],
    fetchFn: async ({ page, pageSize, filters, baseFilters }) => {
      const apiFilters: Record<string, unknown> = { page, pageSize, ...baseFilters };
      if (filters.status !== 'all') apiFilters.status = filters.status;
      if (filters.priority !== 'all') apiFilters.priority = filters.priority;
      if (filters.department !== 'all') apiFilters.department = filters.department;
      if (filters.search) apiFilters.search = filters.search;
      const response = await ticketService.getTickets(apiFilters as any);
      const results = Array.isArray(response) ? response : (response?.results ?? []);
      const count = Array.isArray(response) ? response.length : (response?.count ?? results.length);
      return { results, count };
    },
    baseFilters: { status: 'completed' },

    columns: ['ticketId', 'subject', 'assignee', 'completionPreview', 'submittedDate', 'actions'],

    availableFilters: ['search', 'status', 'priority', 'department'],
    statusOptions: REVIEW_STATUS_OPTIONS,

    emptyState: {
      title: 'Nothing to review',
      message: 'No completed tickets are currently waiting for review.',
    },

    rowHref: (t) => `/${role}/ticket/${t.id}`,
  };
}
```

- [ ] **Step 2: Rewrite the page**

```tsx
// src/app/(role)/moderator/review/page.tsx
'use client';

import React from 'react';
import { useAuth } from '@/lib/auth';
import { TicketListView } from '@/components/tickets/TicketListView';
import { reviewQueuePreset } from '@/components/tickets/presets';

export default function ReviewPage() {
  const { user } = useAuth();
  if (!user) return null;
  const role = user.role ?? 'moderator';
  return <TicketListView preset={reviewQueuePreset(role)} />;
}
```

- [ ] **Step 3: TypeScript check**

Run: `cd services/frontend-service && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Run all tests**

Run: `cd services/frontend-service && npx vitest run`
Expected: all pass.

- [ ] **Step 5: Manual QA — review queue**

- Login as moderator, visit `/moderator/review`
- Verify: only completed tickets shown by default, completion preview column renders, row click opens detail.

- [ ] **Step 6: Commit**

```bash
git add services/frontend-service/src/components/tickets/presets/reviewQueuePreset.ts services/frontend-service/src/app/\(role\)/moderator/review/page.tsx
git commit -m "feat(tickets): migrate review-queue page to TicketListView"
```

---

## Phase 5 — Final Verification & Log

### Task 14: Final sweep — types check, tests, log

**Files:**
- Modify: `PROJECT_LOG.md`
- Modify: `Docs/18-Frontend-Architecture.md` (if present — update Sprint 2 status)

- [ ] **Step 1: Full TypeScript check**

Run: `cd services/frontend-service && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 2: Full test run**

Run: `cd services/frontend-service && npx vitest run`
Expected: all pass.

- [ ] **Step 3: Lint**

Run: `cd services/frontend-service && npm run lint`
Expected: no new errors introduced.

- [ ] **Step 4: Update `PROJECT_LOG.md`**

Append under `## Change History` (new entry at top under the latest-date anchor):

```md
### 2026-04-22 (Sprint 2 — Unified Ticket List)

#### New shared component
- `src/components/tickets/TicketListView.tsx` — dumb, preset-driven list (header + filters + table/cards + pagination + bulk actions).
- Subcomponents: `ListHeader`, `TicketTable`, `TicketCards`, `BulkActionBar`, `EmptyState`, `ErrorState`.
- `src/hooks/useUrlFilters.ts` — URL-synced filter state hook (tested).
- Presets: `myRequestsPreset`, `myTasksPreset`, `ticketPoolPreset`, `reviewQueuePreset`.

#### Migrated pages (now 5–10 line wrappers)
- `/[role]/requests` — requestor.
- `/assignee/tasks` — assignee (progress % column added).
- `/moderator/ticket-pool` — with bulk reject / postpone.
- `/moderator/review` — completion preview column.

#### Removed
- All `getMockTickets` / `generateMockTickets` usage from list pages.
- ~1200 lines of duplicated filter / pagination / table logic.

#### Verification
- `npx vitest run` — all pass (incl. new `useUrlFilters.test.ts`, `TicketListView.test.tsx`).
- `npx tsc --noEmit` — zero errors.
- Manual QA across all 4 routes.
```

- [ ] **Step 5: Update frontend architecture doc (Sprint status)**

If `Docs/18-Frontend-Architecture.md` exists, change the Sprint 2 row:

From:
```
| Sprint 2 | Unified Ticket List component | Planned |
```
To:
```
| Sprint 2 | Unified Ticket List component | Done |
```

- [ ] **Step 6: Commit**

```bash
git add PROJECT_LOG.md Docs/18-Frontend-Architecture.md
git commit -m "docs(sprint-2): log unified ticket list completion"
```

---

## Acceptance Checklist

- [ ] All 4 routes render using `<TicketListView>`.
- [ ] No `getMockTickets` / `generateMockTickets` import remains in any page under `src/app/(role)/`.
- [ ] Filter state round-trips through URL for all 4 scopes.
- [ ] Bulk reject and bulk postpone work in ticket-pool.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npx vitest run` passes including new tests.
- [ ] Manual QA complete for requestor / assignee / moderator roles.
- [ ] `PROJECT_LOG.md` updated.
