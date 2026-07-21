# Unified Ticket List — Design Spec

**Date:** 2026-04-22
**Sprint:** Sprint 2
**Status:** Approved — ready for implementation plan

---

## 1. Goal

Consolidate 4 duplicated ticket-list pages into one shared, preset-driven component. Reduce per-page code from ~300-400 lines to a ~3-line wrapper. No change to public routes.

### Pages in scope

| Route | Role | Scope |
|-------|------|-------|
| `/[role]/requests` (currently requestor) | requestor | my-requests |
| `/assignee/tasks` | assignee | my-tasks |
| `/moderator/ticket-pool` | moderator/admin | ticket-pool |
| `/moderator/review` | moderator/admin | review-queue |

### Non-goals

- No URL/route restructuring. All existing paths preserved.
- No new backend endpoints. Uses existing `ticketService.getTickets(filters)`.
- No change to ticket detail page.
- No backfill/migration of bookmarks or sidebar links.

---

## 2. Architecture

### Component placement

```
src/components/tickets/
  TicketListView.tsx          ← shared dumb component
  TicketTable.tsx             ← desktop table variant
  TicketCards.tsx             ← mobile card variant
  ListHeader.tsx              ← title + subtitle + primaryAction
  BulkActionBar.tsx           ← selection + bulk menu (moderator)
  EmptyState.tsx              ← soft illustration + CTA
  ErrorState.tsx              ← retry button
  presets/
    types.ts                   ← TicketListPreset interface
    myRequestsPreset.ts        ← requestor scope
    myTasksPreset.ts           ← assignee scope
    ticketPoolPreset.ts        ← moderator pool scope
    reviewQueuePreset.ts       ← moderator review scope
    index.ts                   ← re-exports

src/hooks/
  useUrlFilters.ts             ← syncs filter state ↔ URL searchParams
```

### Consumer page (example)

```tsx
// src/app/(role)/[role]/requests/page.tsx
'use client';
import { TicketListView } from '@/components/tickets/TicketListView';
import { myRequestsPreset } from '@/components/tickets/presets';
import { useAuth } from '@/lib/auth';

export default function RequestsPage() {
  const { user } = useAuth();
  if (!user) return null;
  return <TicketListView preset={myRequestsPreset(user.id)} />;
}
```

---

## 3. Preset Contract

```ts
// presets/types.ts
import type { LucideIcon } from 'lucide-react';
import type { Ticket } from '@/types';
import type { SelectOption } from '@/components/ui/Select';

export type ColumnKey =
  | 'ticketId' | 'subject' | 'status' | 'priority'
  | 'department' | 'assignee' | 'requestor'
  | 'submittedDate' | 'progressPercent' | 'completionPreview' | 'actions';

export type FilterKey = 'search' | 'status' | 'priority' | 'department' | 'dateRange';

export interface BulkAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  variant?: 'primary' | 'danger' | 'outline';
  onRun: (ticketIds: string[]) => Promise<void>;
}

export interface TicketListPreset {
  // Identity
  scope: 'my-requests' | 'my-tasks' | 'ticket-pool' | 'review-queue';
  title: string;
  subtitle?: string;

  // Data
  queryKey: readonly unknown[];
  fetchFn: (params: Record<string, unknown>) => Promise<{ results: Ticket[]; count: number }>;
  baseFilters?: Record<string, string>;   // always merged into request

  // UI
  columns: ColumnKey[];
  priorityAccent?: boolean;                // mobile card left-bar
  enableBulkActions?: boolean;
  bulkActions?: BulkAction[];

  // Filters
  availableFilters: FilterKey[];
  statusOptions?: SelectOption[];          // override default (e.g. review-queue)

  // States
  emptyState: {
    title: string;
    message: string;
    cta?: { label: string; href: string };
  };
  primaryAction?: { label: string; href: string; icon?: LucideIcon };

  // Navigation
  rowHref: (t: Ticket) => string;
}
```

### Preset contents (summary)

| Preset | baseFilters | columns (key extras) | enableBulkActions | primaryAction |
|--------|-------------|----------------------|-------------------|---------------|
| `myRequestsPreset(userId)` | `{ requestorId: userId }` | standard | no | `New Request` |
| `myTasksPreset(userId)` | `{ assigneeId: userId }` | + `progressPercent` | no | — |
| `ticketPoolPreset()` | `{ status: 'submitted' }` | standard | **yes** (assign / reject / postpone) | — |
| `reviewQueuePreset()` | `{ status: 'completed' }` | + `completionPreview` | no | — |

---

## 4. Data Flow

```
Page wrapper
  └─ <TicketListView preset>
       ├─ useUrlFilters(preset.availableFilters) → { filters, setFilters }
       ├─ useQuery(
       │    preset.queryKey + filters,
       │    () => preset.fetchFn({ ...preset.baseFilters, ...filters, page, pageSize })
       │  )
       │
       ├─ Render:
       │    <ListHeader title subtitle primaryAction />
       │    <FilterBar available=preset.availableFilters values onChange />
       │    lg:   <TicketTable columns=preset.columns rows rowHref
       │              selection={enableBulkActions ? … : undefined} />
       │    <lg:  <TicketCards rows priorityAccent rowHref />
       │    {enableBulkActions && selection.size > 0 &&
       │       <BulkActionBar actions=preset.bulkActions selection />}
       │    <Pagination page totalPages onChange />
       │
       └─ States:
            loading → <SkeletonRows />
            error   → <ErrorState onRetry={refetch} />
            empty   → <EmptyState {...preset.emptyState} />
```

### Key rules

- **URL sync on by default** — all filter changes `router.replace` without scroll jump. On mount, filters read from `searchParams`.
- **baseFilters always win** — merged server-side-bound; user can't override (e.g. requestor cannot see other requestors' tickets).
- **React Query cache key** = `[scope, baseFilters, userFilters, page]` — list returns instantly when navigating back.
- **No mock data anywhere.** Error state shows retry. Empty state shows CTA.
- **Bulk selection** lives inside `TicketListView` (not preset) — `Set<string>` of selected ticketIds, cleared on filter change / page change.

---

## 5. Visual Design

Consistent with the recently polished ticket detail page aesthetic.

### Desktop

- Ambient radial-gradient backdrop + dotted overlay with radial mask (same as detail page).
- **Header card** — rounded-2xl, gradient accent strip (primary → medium → light), title + subtitle + primaryAction button on right.
- **FilterBar** — rounded chip-style selects, active filter highlighted with primary tint.
- **Table** — rounded-2xl container, ring-1 hairline, layered shadow. Row hover = subtle background tint + left-accent bar animates in. Ticket ID rendered as pill (same style as detail page).
- **Pagination** — compact bar at bottom, uses THEME colors.

### Mobile (< 768px)

- Card per ticket: rounded-2xl, left priority-color accent bar (if `priorityAccent`), subject + meta row, chevron-right affordance.
- Filter bar collapses to sheet / drawer (search + filter icon).
- Full-width primary action button.

### States

- **Loading** — skeleton rows matching table structure (5 rows, shimmer).
- **Error** — centered card with error icon, message, "Retry" button.
- **Empty** — centered soft illustration placeholder, title + message + CTA button from preset.

---

## 6. Migration Plan

4 incremental phases. Each independently shippable, trivial rollback.

### Phase 1 — Foundation (no user-visible change)
- Create `TicketListView.tsx`, subcomponents, preset types, `useUrlFilters` hook.
- Unit tests for `TicketListView` (render header, filters, loading, error, empty, pagination).
- Unit tests for `useUrlFilters` (round-trip, base filter merging).

### Phase 2 — Migrate `my-requests`
- Create `myRequestsPreset.ts`.
- Rewrite `/[role]/requests/page.tsx` as 3-line wrapper.
- Remove `getMockTickets` fallback from this page.
- Manual QA: filters, URL sync, pagination, row click, new-request CTA.

### Phase 3 — Migrate `my-tasks`
- Create `myTasksPreset.ts` including `progressPercent` column.
- Rewrite `/assignee/tasks/page.tsx`.
- Drop custom all/active/resolved tab logic (shared status filter covers it).

### Phase 4 — Migrate `ticket-pool` + `review-queue`
- Create `ticketPoolPreset.ts` with bulk actions wired to existing assign / reject / postpone modals.
- Create `reviewQueuePreset.ts` with completion-preview column.
- Rewrite both pages.
- Remove `generateMockTickets` from ticket-pool.
- Manual QA: bulk select, bulk assign, bulk reject, review flow.

### Files touched

```
NEW:
  src/components/tickets/{TicketListView,TicketTable,TicketCards,ListHeader,BulkActionBar,EmptyState,ErrorState}.tsx
  src/components/tickets/presets/{types,myRequestsPreset,myTasksPreset,ticketPoolPreset,reviewQueuePreset,index}.ts
  src/hooks/useUrlFilters.ts

REWRITTEN (each becomes a 3-line wrapper):
  src/app/(role)/[role]/requests/page.tsx
  src/app/(role)/assignee/tasks/page.tsx
  src/app/(role)/moderator/ticket-pool/page.tsx
  src/app/(role)/moderator/review/page.tsx

DELETED (from app code — no test impact expected):
  getMockTickets usage (imports removed)
  generateMockTickets (inline in ticket-pool — removed)
```

---

## 7. Testing Strategy

### Unit
- `TicketListView.test.tsx` — loading / error / empty / populated states; filter change triggers refetch; URL round-trip.
- `useUrlFilters.test.ts` — reads initial state from URL, writes on change, respects baseFilters.
- Preset unit tests — each preset returns valid shape; baseFilters correct per role.

### Integration / manual
- Requestor flow: filter → URL updates → refresh → filter persists.
- Assignee flow: progress column renders; status filter hides resolved.
- Moderator flow: select 3 rows → BulkActionBar appears → bulk assign → selection clears.
- Review flow: only completed tickets shown; completion preview renders.

### Not tested
- Backend pagination edge cases (owned by service).
- WebSocket real-time updates on list (out of scope — tickets only refresh on filter change or manual refetch for now).

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Bulk-action modals (assign/reject/postpone) are currently coupled to ticket-pool page state | Phase 4 only — extract modals to accept `ticketIds: string[]`, wire via `BulkAction.onRun` |
| URL sync conflict with existing `/requests?search=…` links | `useUrlFilters` preserves unknown params; only manages keys in `availableFilters` |
| React Query not yet used consistently across these pages | Wrap existing `ticketService.getTickets` directly — no upstream change needed |
| Backend pagination shape mismatch (`{ results, count }` vs array) | Normalize in `fetchFn` wrapper inside each preset |

---

## 9. Out of Scope / Future

- Saved filter presets (user-named filters).
- Column show/hide customization.
- CSV export of filtered list.
- Real-time push updates via WebSocket on list views.
- Virtualization (not needed < 1000 rows).

---

## 10. Acceptance Criteria

- [ ] All 4 routes render correctly with no regression vs current behavior.
- [ ] No `getMockTickets` / `generateMockTickets` import remains in these pages.
- [ ] Filter state round-trips through URL for all 4 scopes.
- [ ] Bulk assign/reject/postpone still works in ticket-pool.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npx vitest run` passes including new tests.
- [ ] Visual parity with ticket detail page aesthetic (same shadow/ring/gradient language).
