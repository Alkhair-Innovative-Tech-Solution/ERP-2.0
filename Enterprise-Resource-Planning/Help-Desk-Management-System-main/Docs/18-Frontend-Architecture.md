# 18 — HDMS Frontend Architecture Reference

> **Purpose:** Single reference doc so any future session can understand the full frontend without re-scanning files.
> Read this before touching any frontend code. If something is missing, add it here after exploring.

---

## 1. Stack & Entry Points

| Item | Detail |
|------|--------|
| Framework | Next.js 15, App Router, TypeScript strict |
| Styling | Tailwind CSS + inline `style={{ }}` via `THEME` object |
| State | Zustand (authStore, ticketStore, notificationStore, uiStore) |
| Data fetching | TanStack React Query + Axios via `apiClient` |
| Real-time | Native WebSocket via `src/hooks/useSocket.ts` |
| Root | `services/frontend-service/src/` |

**Color system — single source of truth:**
```ts
// src/lib/theme.ts — THEME.colors.*
background: '#E7ECEF'   // page bg
primary:    '#274C77'   // dark blue — headings, borders, icons
medium:     '#6096BA'   // mid blue — active states
light:      '#A3CEF1'   // light blue — hover, sidebar collapsed
gray:       '#8B8C89'   // muted text
white:      '#FFFFFF'
success:    '#10B981'
warning:    '#F59E0B'
error:      '#EF4444'
info:       '#3B82F6'
```
**Rule:** Never hardcode `#274c77`, `#e7ecef` etc. Always use `THEME.colors.*`.

---

## 2. Route Structure

```
src/app/
├── (auth)/                    # No layout — login, register, forgot-password
│   ├── login/page.tsx
│   ├── register/page.tsx
│   └── forgot-password/page.tsx
│
├── (role)/                    # Layout shell (Navbar + Sidebar)
│   ├── [role]/                # Dynamic — catches requestor + generic routes
│   │   ├── dashboard/         → UnifiedDashboard component
│   │   ├── requests/          → Requestor ticket list
│   │   ├── new-request/       → Create ticket form
│   │   ├── ticket/[id]/       → UNIFIED ticket detail (all roles) — role-based actions
│   │   ├── notifications/     → Notification center
│   │   └── profile/           → Delegates to DynamicProfile component
│   │
│   ├── admin/                 # Admin-specific pages (leave for later)
│   │   ├── dashboard/         → UnifiedDashboard
│   │   ├── analytics/         → Charts dashboard (real API)
│   │   ├── users/             → User management (1,308 LOC — needs split)
│   │   ├── employees/         → Employee list + detail
│   │   ├── departments/       → Dept list + detail + new
│   │   ├── branches/          → Branch list + new
│   │   ├── institutions/      → Institution list + new
│   │   └── designations/      → Designation list + new
│   │
│   ├── moderator/             # Moderator workflow pages
│   │   ├── ticket-pool/       → Unreviewed tickets (submitted status, real API)
│   │   ├── review/            → Completed tickets needing approval
│   │   └── create-subtickets/ → Split ticket into subtickets (MOCK data, Phase 2)
│   │
│   └── assignee/              # Assignee workflow pages
│       ├── dashboard/         → UnifiedDashboard
│       └── tasks/             → Assigned tasks list (real API)
│
└── page.tsx                   # Root redirect
```

---

## 3. Layout Shell

```
Layout (src/components/layout/layout.tsx)
├── Navbar (fixed, z-[65], h-16, full width)
│   ├── Mobile: hamburger + Logo
│   ├── Right: Bell (unreadCount badge) + Profile dropdown
│   └── Left padding syncs with sidebar state: md:pl-[calc(288px+1.5rem)] or md:pl-[calc(80px+1.5rem)]
│
└── Sidebar (fixed, z-[60], starts at top-16, h-[calc(100vh-4rem)])
    ├── Desktop: collapsible (w-72 open, w-20 collapsed)
    │   ├── Open: Logo + X button + nav items with text
    │   └── Collapsed: Menu button + icon-only nav items
    └── Mobile: slide-in drawer (w-80, overlay behind)

Content area: ml-72 (open) or ml-20 (collapsed) on md+, no margin on mobile
```

**Z-index hierarchy:** Navbar 65 > Sidebar 60 > content

**PageContainer** (`src/components/layout/PageContainer.tsx`):
```tsx
// Standard wrapper for all non-fullscreen pages
<PageContainer>                    // min-h-screen, p-4/6/8, max-w-7xl, THEME bg
<PageContainer fluid>              // no max-width cap
<PageContainer className="space-y-6"> // extra classes
```
**Rule:** Every standard page (list, form, dashboard) MUST use PageContainer. Exception: full-height split layouts (ticket detail).

---

## 4. Key Components

### Layout Components (`src/components/layout/`)
| File | Purpose |
|------|---------|
| `layout.tsx` | Main shell — Navbar + Sidebar + content area |
| `Navbar.tsx` | Top bar with bell, profile dropdown, ROLE_LABELS |
| `Sidebar.tsx` | Role-based nav items, collapsible desktop + mobile drawer |
| `PageContainer.tsx` | Standard page wrapper |

### Common Components (`src/components/common/`)
| File | Purpose | Used In |
|------|---------|---------|
| `StatusBadge.tsx` | Colored status pill (submitted/assigned/in_progress/etc.) | 25+ pages |
| `PriorityBadge.tsx` | Priority level (low/medium/high/urgent) | 20+ pages |
| `TicketCard.tsx` | Ticket in card format (mobile/grid view) | requests, ticket-pool |
| `FilterBar.tsx` | Search + filter controls (status/priority/dept/date) | list pages |
| `ActionButtons.tsx` | ViewButton, ReassignButton etc. | moderator pages |
| `TicketTimeline.tsx` | Status change history as timeline | unified ticket detail |
| `ParticipantsCard.tsx` | Requestor/assignee/moderator avatars | unified ticket detail |
| `AttachmentsCard.tsx` | File attachments list + download | unified ticket detail |
| `SLACard.tsx` | SLA status, time remaining, breach indicator | unified ticket detail |
| `AnalyticsCard.tsx` | Metric stat card (icon + number + label) | dashboards |
| `FileUpload.tsx` | Drag-drop file upload with progress | new-request, unified ticket detail |

### Ticket Components (`src/components/tickets/`)
| File | Purpose |
|------|---------|
| `TicketHeader.tsx` | Fixed header: back btn, ticketId, StatusBadge, PriorityBadge, subject, time, dept + actions slot |
| `TicketHistory.tsx` | Status change log |
| `AssigneeActionsPanel.tsx` | Assignee-specific actions (Acknowledge/Start/Progress/Complete/Postpone) |
| `TicketListView.tsx` | **Shared list component** — React Query, URL filter sync, desktop table + mobile cards, bulk select |
| `TicketTable.tsx` | Desktop table — 11 column types, pill ticket ID, progress bar, checkbox selection |
| `TicketCards.tsx` | Mobile card list — priority accent bar, ticket ID pill, meta row |
| `ListHeader.tsx` | Title + subtitle + optional primary action button |
| `BulkActionBar.tsx` | Sticky bulk-action bar (appears on selection), wired to real ticketService calls |
| `EmptyState.tsx` | Centered empty state with optional CTA |
| `ErrorState.tsx` | Centered error state with retry button |
| `presets/types.ts` | `TicketListPreset` interface, `ColumnKey`, `FilterKey`, `BulkAction` |
| `presets/myRequestsPreset.ts` | Requestor scope: `baseFilters={requestorId}`, "New Request" action |
| `presets/myTasksPreset.ts` | Assignee scope: `baseFilters={assigneeId}`, `progressPercent` column |
| `presets/ticketPoolPreset.ts` | Moderator pool: `baseFilters={status:'submitted'}`, bulk Reject/Postpone |
| `presets/reviewQueuePreset.ts` | Moderator review: `baseFilters={status:'completed'}`, `completionPreview` column |

### Chat (`src/components/chat/`)
| File | Purpose |
|------|---------|
| `UnifiedChatPanel.tsx` | Primary WebSocket chat, supports sidebar/inline mode |

### UI Components (`src/components/ui/`)
| File | Purpose |
|------|---------|
| `DataTable.tsx` | Sortable/paginated table |
| `Button.tsx` | Primary/secondary/danger variants |
| `Input.tsx` | Text input with label/error |
| `TextArea.tsx` | Multi-line input |
| `Select.tsx` | Dropdown select |
| `EmptyState.tsx` | Empty list placeholder |
| `PageSkeleton.tsx` | Full-page loading skeleton |
| `SkeletonLoader.tsx` | Inline skeleton for tables/text |
| `ErrorBanner.tsx` | Error message display |
| `card.tsx` | Card, CardContent, CardHeader, CardTitle |
| `logo.tsx` | HDMS logo component |

### Dashboards (`src/components/dashboards/`)
| File | Purpose |
|------|---------|
| `UnifiedDashboard.tsx` | Single dashboard for all 4 roles (role-based content sections, real API) |

### Modals (`src/components/modals/`)
Common: ConfirmModal, AlertModal, AssignTicketModal, RejectTicketModal, PostponeModal, ClarificationModal, InitialReviewModal, EditTicketModal, TicketActionModals (Resolve/Reopen)

### Admin Components (`src/components/admin/`)
BranchForm, DepartmentForm, DesignationForm, EmployeeForm, InstitutionForm — form components for admin CRUD pages.

---

## 5. State Management

### Zustand Stores (`src/store/`)
```
authStore       — user session, JWT tokens (persisted to localStorage)
ticketStore     — ticket list + detail state
notificationStore — unreadCount, notifications array, WebSocket subscription
uiStore         — modal open/close state
```

### Auth (`src/lib/auth.ts`)
`useAuth()` hook → returns `{ user, loading, logout }`. User object has: `id, name, role, email, department, avatar`.

### Roles
`admin` | `moderator` | `assignee` | `requestor`

---

## 6. API Services (`src/services/api/`)

| Service | Backend | Key Methods |
|---------|---------|-------------|
| `ticketService.ts` | ticket-service :8002 | getTickets, getTicketById, createTicket, assignTicket, acknowledgeTicket, startTicket, updateProgress, completeTicket, resolveTicket, reopenTicket, rejectTicket, postponeTicket |
| `fileService.ts` | file-service :8005 | uploadFile, getFile, deleteFile |
| `axiosClient.ts` | (base) | Axios instance with JWT auth header auto-inject |
| `userService.ts` | auth-service :8000 | getUsers (for assignee listings) |
| `departmentService.ts` | auth-service :8000 | fetchDepartments, fetchDepartmentByCode |
| `designationService.ts` | auth-service :8000 | fetchDesignations |
| `institutionService.ts` | auth-service :8000 | fetchInstitutions |
| `branchService.ts` | auth-service :8000 | fetchBranches |
| `permissionService.ts` | auth-service :8000 | checkHdmsAccess, grantHdmsAccess |

**Proxy rules (next.config.ts):**
- `/api/v1/tickets/*` → ticket-service
- `/api/v1/chat/*`, `/api/v1/notifications/*` → communication-service
- `/api/v1/files/*` → file-service
- `/api/auth/*`, `/api/employees/*`, `/api/*` (fallback) → auth-service

---

## 7. Hooks (`src/hooks/`)

| Hook | Purpose |
|------|---------|
| `useAuth.ts` | Auth state (re-exported from authStore) |
| `useSocket.ts` | WebSocket connection + message handling |
| `useNotifications.ts` | Notification fetch + mark-read + WebSocket sub |
| `useTicketActions.ts` | Common ticket action handlers (assign, reject, etc.) |
| `useUrlFilters.ts` | Syncs filter state ↔ URL searchParams; reads on mount, writes via `router.replace` (no scroll jump); preserves unknown params |

---

## 8. Known Issues & Tech Debt

### Deleted (2026-04-17 cleanup) — do not recreate:
- `[role]/request-detail/[id]`, `moderator/review/[id]`, `assignee/task-detail/[id]` → replaced by `[role]/ticket/[id]`
- `moderator/reassign`, `moderator/reassign/[id]` → reassign action moved inside unified ticket detail (moderator panel)
- `moderator/assigned` → same info is available via ticket-pool + dashboard
- `admin/reports`, `assignee/reports` → demo data, removed
- `admin/settings` page — removed from nav (page still exists as placeholder; hide fully when removed backend-side)
- `components/review/*` (4 files), `components/common/TicketChat.tsx` → all legacy, deleted

### Pages with mock data fallbacks (real API first, mock on error):
- `moderator/ticket-pool`, `[role]/requests`

### Open TODOs:
- Moderator **Reassign** action needs to be wired inside `[role]/ticket/[id]` action panel (currently has Assign/Reject/Postpone/Clarify/Edit — add Reassign)
- Remove hardcoded colors (`#e7ecef`, `#274c77`) from legacy chart/common files — use `THEME.colors.*`

---

## 9. Sprint Status

| Sprint | Focus | Status |
|--------|-------|--------|
| Sprint 1 | Unified Ticket Detail Page (`/[role]/ticket/[id]`) | **Done** |
| Sprint 2 | Unified Ticket List (`TicketListView` + 4 presets) | **Done** |
| Sprint 3 | Design system cleanup (THEME constants everywhere) | Planned |
| Admin refactor | Users/employees page split, settings backend | Later |

---

## 10. Unified Ticket Detail — Design (Sprint 1)

**Route:** `/[role]/ticket/[id]` (replaces review/[id], task-detail/[id], request-detail/[id])

**Layout (desktop):**
```
┌─────────────────────────────────────────────────────┐
│  TicketHeader (sticky): [← Back] [ID] [Status] [Priority] [Subject]  [Actions] │
├─────────────────────────┬───────────────────────────┤
│  LEFT PANEL (60%)       │  RIGHT PANEL (40%)        │
│  - Ticket metadata      │  - UnifiedChatPanel       │
│  - Description          │    (full height, scroll)  │
│  - Attachments          │                           │
│  - Timeline             │                           │
│  - SLA card             │                           │
│  - RoleActionsPanel     │                           │
│    (bottom of left)     │                           │
└─────────────────────────┴───────────────────────────┘
```

**Mobile:** Single column, chat collapsed behind a tab/button.

**RoleActionsPanel — switches by role:**
- `requestor`: Resolve (if resolved → Reopen)
- `moderator`: Assign / Reject / Postpone / Request Clarification / Edit
- `assignee`: Acknowledge → Start → Progress → Complete (FSM-aware, shows correct next action)
