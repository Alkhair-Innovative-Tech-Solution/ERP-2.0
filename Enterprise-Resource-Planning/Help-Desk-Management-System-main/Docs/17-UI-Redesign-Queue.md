# UI Redesign — Implementation Queue

**Status:** In Progress  
**Last Updated:** 2026-04-13  
**Approach:** Industry standard (Zendesk/Linear/Jira pattern) — shared components, role-aware rendering, layout freedom per page type

---

## Core Principle

```
Layout = Shell only (Navbar + Sidebar + Auth)
Pages = Control their own layout (padded or full-height)
Components = Shared wherever possible, role-aware via props
```

---

## Queue — Execution Order

### ✅ Phase 0 — Already Done
- [x] Comprehensive UI/UX audit (`Docs/15-UI-UX-Audit.md`)
- [x] Design system defined (`Docs/16-Design-System.md`)
- [x] UnifiedChatPanel `mode` prop added
- [x] Auto-close bug (2→7 days) fixed in request-detail

---

### 🔴 Phase 1 — Foundation (Do First, Everything Depends On This)

#### 1.1 — Layout Restructure
**Files:** `src/components/layout/layout.tsx`

Remove inner `<div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">` from Layout.  
Pages control their own padding from now on.

```tsx
// Before (Layout controls padding)
<main>
  <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
    {children}
  </div>
</main>

// After (Layout = shell only)
<main>
  {children}
</main>
```

---

#### 1.2 — PageContainer Component (new file)
**File:** `src/components/layout/PageContainer.tsx`

Standard wrapper for dashboards, lists, forms — replaces the removed Layout padding.

```tsx
// Usage:
<PageContainer>
  <h1>Dashboard</h1>
  ...
</PageContainer>

// Renders:
<div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto min-h-screen" 
     style={{ backgroundColor: THEME.colors.background }}>
  {children}
</div>
```

---

#### 1.3 — Update All Standard Pages to Use PageContainer
Every page that was relying on Layout's padding now wraps in `<PageContainer>`:
- All dashboards (requestor, moderator, assignee, admin)
- All list pages (requests, ticket-pool, tasks, notifications)
- All form pages (new-request, admin forms)
- Profile, reports, settings

Replace pattern:
```tsx
// Old (every page)
<div className="p-4 sm:p-6 lg:p-8" style={{ backgroundColor: '#e7ecef', minHeight: '100vh' }}>

// New
<PageContainer>
```

---

### 🔴 Phase 2 — Unified Ticket Detail Page

#### 2.1 — Unified Page Route
**File:** `src/app/(role)/[role]/ticket/[id]/page.tsx` *(new)*

Single page for all roles. Role-based rendering of action panel only.

**Layout — Desktop:**
```
┌─────────────────────────────────────────────────────┐
│ Ticket Header (fixed) — subject, status, priority   │
├─────────────────────────────┬───────────────────────┤
│                             │                       │
│  Left: Ticket Content       │  Right: Chat          │
│  (scrollable)               │  (fixed height)       │
│                             │                       │
│  • TicketInfoCard           │  UnifiedChatPanel     │
│  • DescriptionCard          │  mode="inline"        │
│  • AttachmentsCard          │                       │
│  • ParticipantsCard         │                       │
│  • TicketTimeline           │                       │
│  • RoleActionsPanel ←role   │                       │
└─────────────────────────────┴───────────────────────┘
```

**Layout — Mobile:**
```
┌─────────────────────┐
│ ← #HD-001 [High]   │ ← Compact fixed header
├──────────┬──────────┤
│  Details │   Chat  │ ← Tab bar
├──────────┴──────────┤
│  Tab content here  │ ← Scrollable
└─────────────────────┘
```

---

#### 2.2 — Shared Ticket Components (extract/create)

**Already exists — keep using:**
- `TicketDetailsPanel` (used by moderator + assignee) ✓
- `AttachmentsCard` ✓
- `ParticipantsCard` ✓
- `TicketTimeline` ✓
- `SLACard` ✓
- `StatusBadge` ✓
- `PriorityBadge` ✓

**New — extract from request-detail/page.tsx:**
- `TicketHeader` — fixed top bar (back button, ticket ID, subject, status, priority badges)
- `DescriptionCard` — description with expand/collapse (currently inline in page)

**New — role dispatcher:**
```tsx
// src/components/tickets/RoleActionsPanel.tsx
function RoleActionsPanel({ ticket, role, onAction }) {
  if (role === 'moderator') return <ModeratorActionsPanel ticket={ticket} onAction={onAction} />
  if (role === 'assignee')  return <AssigneeActionsPanel  ticket={ticket} onAction={onAction} />
  return <RequestorActionsPanel ticket={ticket} onAction={onAction} />
}
```

**New — requestor-specific:**
- `RequestorActionsPanel` — submit draft, edit, reopen, delete (currently inline in request-detail)

---

#### 2.3 — Migrate & Retire Old Pages
After unified page is working:

| Old Route | Action |
|-----------|--------|
| `/[role]/request-detail/[id]` | Redirect → `/[role]/ticket/[id]` |
| `/moderator/review/[id]` | Redirect → `/moderator/ticket/[id]` |
| `/assignee/task-detail/[id]` | Redirect → `/assignee/ticket/[id]` |

Moderator's `TicketChatPanel` (custom) → replace with `UnifiedChatPanel mode="inline"` in unified page.

---

### 🟡 Phase 3 — Dashboard Standardization

**Problem:** 4 dashboards, 4 completely different layouts, 0 shared components.

**Solution:** Shared dashboard shell, role-specific content.

#### 3.1 — Shared Dashboard Components

```tsx
// src/components/dashboards/DashboardShell.tsx
<DashboardShell
  title="Welcome back, Ahmed"
  subtitle="Here's what's happening today"
  actionButton={{ label: 'New Request', onClick: ... }}
>
  {/* role-specific content */}
</DashboardShell>
```

Already exists: `DashboardHeader` — standardize usage across all 4 dashboards.

**KPI Cards standardization:**
- All dashboards use `KpiCard` (already exists) ✓
- Grid layout: always `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` — no custom cols per dashboard

**Remove from dashboards:**
- Mock data generators (`generateMockTickets`, hardcoded stats)
- `alert()` calls — replace with Toast
- Fake admin stats (156 users, 99.8% uptime)

---

#### 3.2 — Dashboard Layout Rule

```tsx
// Every dashboard follows this structure:
<PageContainer>
  <DashboardHeader ... />
  <KpiGrid>  {/* grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 */}
    <KpiCard ... />
    <KpiCard ... />
  </KpiGrid>
  <ChartRow>  {/* charts section */}
  </ChartRow>
  <RecentActivity>  {/* table or activity feed */}
  </RecentActivity>
</PageContainer>
```

---

### 🟡 Phase 4 — List Pages Standardization

**Problem:** Requests, ticket-pool, tasks, notifications — all different patterns, all repeat the same filter+list structure.

**Solution:** Standard list page pattern.

#### 4.1 — List Page Pattern

```tsx
// Every list page:
<PageContainer>
  <ListPageHeader
    title="My Requests"
    actionButton={{ label: 'New Request', onClick: ... }}
  />
  
  <CollapsibleFilters>  {/* hidden on mobile, toggle button shows it */}
    <FilterBar ... />
  </CollapsibleFilters>
  
  {/* Mobile: Cards, Desktop: Table */}
  <ResponsiveList
    data={tickets}
    mobileCard={<TicketCard />}
    desktopColumns={columns}
    onRowClick={(id) => router.push(`/ticket/${id}`)}
  />
  
  <Pagination ... />
</PageContainer>
```

#### 4.2 — Collapsible Filters (all list pages)
Filter bar currently always visible — hides on mobile with a "Filters" button toggle.
- Already implemented in `ticket-pool/page.tsx` (toggle button exists ✓)
- Apply same pattern to: requests list, tasks list, notifications

#### 4.3 — ResponsiveList Component (new)
Handles mobile cards + desktop table switch:
```tsx
// Usage:
<ResponsiveList
  data={items}
  mobileCard={(item) => <TicketCard ticket={item} />}
  desktopColumns={tableColumns}
  emptyState={<EmptyState ... />}
  loading={loading}
/>
```

Currently `requests/page.tsx` has this logic inline — extract to component.

---

### 🟢 Phase 5 — Polish & Bug Fixes

After structure is clean, fix remaining issues:

#### 5.1 — Navbar
- Fix ghost URLs in search (align with actual routes)
- Fix profile popup content (add actual menu items)
- Fix notification dot (don't ping when 0 unread)

#### 5.2 — Assignee Dashboard
- Wire `handleStartTask` / `handleCompleteTask` to actual API
- Remove `alert()` calls → Toast
- Fix "View Achievements" dead button

#### 5.3 — Admin Dashboard
- Replace hardcoded fake stats with actual API data
- Replace static activity feed with real data

#### 5.4 — Business Logic Fixes
- `canResolve`: fix FSM status (`completed` → `in_progress`)
- Reopen count: expose from ticket model properly
- SLA hours: remove hardcoded 72h — should come from ticket model's `sla_hours`

---

## Component Inventory — Final State

```
src/components/
├── layout/
│   ├── layout.tsx          ← shell only (modified)
│   ├── PageContainer.tsx   ← new — standard padded pages
│   ├── Sidebar.tsx
│   ├── Navbar.tsx
│   └── RoleGuard.tsx
│
├── tickets/                ← shared ticket components
│   ├── TicketHeader.tsx    ← new — fixed header for ticket detail
│   ├── DescriptionCard.tsx ← new — extracted from request-detail
│   ├── RoleActionsPanel.tsx← new — role dispatcher
│   ├── RequestorActionsPanel.tsx ← new — from request-detail
│   ├── AssigneeActionsPanel.tsx  ← exists ✓
│   └── TicketHistory.tsx   ← exists ✓
│
├── review/                 ← moderator-specific
│   ├── ModeratorActionsPanel.tsx ← exists ✓
│   ├── TicketDetailsPanel.tsx    ← exists ✓ (shared with assignee)
│   └── ReviewPageHeader.tsx      ← will be replaced by TicketHeader
│
├── dashboards/             ← shared dashboard components
│   ├── DashboardHeader.tsx ← exists ✓ — standardize usage
│   └── DashboardContainer.tsx ← exists ✓
│
├── common/                 ← already shared ✓
│   ├── AttachmentsCard.tsx
│   ├── ParticipantsCard.tsx
│   ├── SLACard.tsx
│   ├── TicketTimeline.tsx
│   ├── FilterBar.tsx
│   ├── KpiCard.tsx
│   ├── StatusBadge.tsx
│   └── PriorityBadge.tsx
│
└── chat/
    └── UnifiedChatPanel.tsx  ← mode prop added ✓
```

---

## Pages — Final Route Structure

```
(auth)/
  login/
  forgot-password/

(role)/[role]/
  dashboard/        ← all roles
  ticket/[id]/      ← NEW unified (replaces request-detail + review + task-detail)
  requests/         ← requestor + admin
  new-request/      ← requestor (will become AI intake)
  notifications/    ← all roles
  profile/          ← all roles

moderator/
  ticket-pool/
  assigned/
  reassign/
  create-subtickets/

assignee/
  tasks/
  reports/

admin/
  employees/
  departments/
  branches/
  institutions/
  settings/
  analytics/
```

---

## Summary — What Gets Deleted

| File | Reason |
|------|--------|
| `/[role]/request-detail/[id]/page.tsx` | Replaced by `/[role]/ticket/[id]` |
| `/moderator/review/[id]/page.tsx` | Replaced by unified page |
| `/assignee/task-detail/[id]/page.tsx` | Replaced by unified page |
| `components/review/ReviewPageHeader.tsx` | Replaced by `TicketHeader` |
| `components/review/TicketChatPanel.tsx` | Replaced by `UnifiedChatPanel` |
