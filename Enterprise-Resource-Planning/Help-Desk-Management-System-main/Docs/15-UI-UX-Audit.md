# UI/UX Audit — Complete System Review

**Status:** Completed  
**Last Updated:** 2026-04-13  
**Scope:** All frontend pages + shared components. Code read directly, not assumed.  
**Next Step:** See `Docs/16-Design-System.md` for the fix plan.

---

## Executive Summary

The frontend has solid foundations (routing, auth, real-time socket, responsive layout shell) but suffers from three critical system-wide problems:

1. **Color chaos** — three color systems running in parallel (THEME object, inline hex strings, raw Tailwind classes). Cannot update colors without hunting across 30+ files.
2. **Mock data in production code** — fake data generators, hardcoded stats, and `alert()` dialogs throughout.
3. **Mobile is an afterthought** — no consistent strategy; some pages are mobile-aware, others are completely broken on small screens.

Fix priority: Design System first → then page-by-page.

---

## System-Wide Issues

### 1. Color System (Critical)

Three parallel systems in production code:

| System | Example | Where Used |
|--------|---------|------------|
| THEME object | `style={{ color: THEME.colors.primary }}` | Moderator Dashboard, Assignee Dashboard |
| Inline hex | `style={{ color: '#274c77' }}` | Login, Sidebar, Requestor Dashboard |
| Raw Tailwind | `className="text-blue-600"` | Admin Dashboard, Notifications |

**Impact:** Cannot change brand color without touching 30+ files. Brand is currently split between `#274c77` (dark navy) and `text-blue-600` (Tailwind blue) — these are visually different.

---

### 2. Mock Data / Fake Stats in Production (Critical)

| File | Issue |
|------|-------|
| `AdminDashboard.tsx` | `totalUsers: 156`, `activeUsers: 142`, `avgResolutionTime: '2.3 days'`, `systemUptime: '99.8%'` — all hardcoded fake numbers |
| `AdminDashboard.tsx` | `recentActivities` is a static array, not from API |
| `ModeratorDashboard.tsx` | Falls back to `generateMockTickets()` — shows "Demo Mode" badge in production if API returns empty |
| `ticket-pool/page.tsx` | Full 30-ticket mock generator inside production page file |
| `requestorDashboard.tsx` | Imports `getMockTickets` from mockData lib |

**Fix:** Remove mock generators from page files. Empty states should show proper "No data" UI, not fake data.

---

### 3. Alert() / Confirm() Dialogs (Critical)

Browser native dialogs are terrible UX and block the thread.

| File | Issue |
|------|-------|
| `AssigneeDashboard.tsx:71` | `alert('Task ${taskId} has been started...')` — no actual API call! |
| `AssigneeDashboard.tsx:76` | `alert('Task ${taskId} has been completed...')` — no actual API call! |
| `request-detail/page.tsx:172` | `alert('Ticket submitted successfully!')` |
| `request-detail/page.tsx:163` | `confirm('Are you sure you want to delete this draft?')` |
| `ticket-pool/page.tsx:362` | `alert('Change priority for N tickets')` — bulk action placeholder |
| `ticket-pool/page.tsx:366` | `alert('Postpone N tickets')` — bulk action placeholder |

**Fix:** Replace all with Toast notifications + ConfirmModal components (both already exist in codebase).

---

### 4. Hardcoded Business Logic in Components (High)

| File | Issue |
|------|-------|
| `request-detail/page.tsx:114` | Auto-close countdown: `resolvedDate + 2 days` — Business Rules say 7 days |
| `ModeratorDashboard.tsx:114` | `slaHours = 72` — hardcoded 3-day SLA; Business Rules say priority-based |
| `ticket-pool/page.tsx:88` | `slaHours = 72` — same hardcoded value |
| `request-detail/page.tsx:183` | `reopenCount >= 2` — should come from ticket API, not component |

---

### 5. Dead / Ghost Routes in Navbar Search (Medium)

`Navbar.tsx` search suggests pages that don't exist:

| Ghost URL | Shown for Role |
|-----------|----------------|
| `/requestor/total-requests` | requestor |
| `/requestor/pending-requests` | requestor |
| `/requestor/resolved-requests` | requestor |
| `/requestor/rejected-requests` | requestor |
| `/moderator/new-requests` | moderator |
| `/moderator/total-requests` | moderator |
| `/moderator/in-progress` | moderator |
| `/moderator/high-priority` | moderator |
| `/moderator/urgent` | moderator |

Clicking these causes 404. Fix: Align search results with actual routes.

---

### 6. Page Background / Spacing Set Per-Page (Medium)

Every page sets its own background:
```tsx
<div style={{ backgroundColor: '#e7ecef', minHeight: '100vh' }}>
```
This should be in the layout wrapper — not repeated 20+ times. If background needs to change, 20+ files need editing.

---

### 7. Loading State Inconsistency (Medium)

| Page | Loading State |
|------|---------------|
| Requestor Dashboard | Proper animated skeleton ✓ |
| Moderator Dashboard | Animated pulse skeleton ✓ |
| Assignee Dashboard | `<div className="p-8">Loading...</div>` — plain text |
| Admin Dashboard | `<div className="p-8">Loading...</div>` — plain text |
| Ticket Pool | SkeletonTable (via component) ✓ |
| Request Detail | Animated skeleton ✓ |

---

## Page-by-Page Issues

### Login Page

**Severity: Low** — mostly fine

| Issue | Notes |
|-------|-------|
| Right panel hides on mobile | Stacks below form — acceptable |
| "Login" button text color | `text-black` on `bg-[#a3cef1]` — low contrast |
| `window.location.href` for redirect | Should use `router.push()` — causes full page reload |

---

### Sidebar

**Severity: Medium**

| Issue | Notes |
|-------|-------|
| All colors are inline hex | `#e7ecef`, `#a3cef1`, `#274c77`, `#1c3f67`, `#6096ba`, `#8b8c89` — 6 hardcoded values |
| Moderator: Notifications icon duplicate | Both "Assigned" and "Notifications" use `Inbox` icon — visually identical |
| No active indicator text for collapsed state | Icon-only collapsed mode — no tooltip on hover |

---

### Navbar

**Severity: Medium**

| Issue | Notes |
|-------|-------|
| Ghost URLs in search | See System-Wide §5 |
| Profile popup: empty body | `<div className="text-sm text-gray-600">Profile Settings</div>` — no actual menu items |
| `group-hover` popup breaks on touch | Touch devices don't have hover — popup inaccessible on mobile |
| Notification dot always pulses | `animate-ping` runs even when 0 notifications |
| `animate-shake-interval` undefined | Custom class not in Tailwind config — likely no effect |
| `backgroundColor: '#e7ecef'` inline | Should use CSS variable or Tailwind |

---

### Requestor Dashboard

**Severity: Medium**

| Issue | Notes |
|-------|-------|
| `ResolutionTimeTrendChart data={[]}` | Chart always gets empty data — renders empty placeholder always |
| Mixed color approach | Some `style={{ color: '#274c77' }}`, some `style={{ color: '#111827' }}` |
| KPI cards have different `backgroundColor` props | 4 different background colors passed — no system |
| Emoji hardcoded `👋` | Not a major issue but inconsistent with other dashboards |

---

### Moderator Dashboard

**Severity: Medium**

| Issue | Notes |
|-------|-------|
| SLA hardcoded 72h | Should be priority-based per Business Rules |
| "Demo Mode" badge in production | Shows if API empty — no way to disable |
| `handleTicketClick` uses old route | `router.push('/moderator/review?id=...')` — old query param style, new route is `/moderator/review/[id]` |
| 5 KPI cards `lg:grid-cols-5` | On tablet (md), this becomes `sm:grid-cols-2` then 2+3 wrap — awkward |

---

### Assignee Dashboard

**Severity: Critical**

| Issue | Notes |
|-------|-------|
| `handleStartTask` calls `alert()`, no API | Task status never actually changes on server |
| `handleCompleteTask` calls `alert()`, no API | Same — purely cosmetic |
| `handleViewTask` only calls `console.log` | No navigation, no modal — broken feature |
| "View Achievements" button goes nowhere | No `href` or `onClick` handler with destination |
| No responsive padding | `p-8 space-y-8` — fixed, no `sm:` or `md:` variants |
| KPI cards: `grid-cols-1 md:grid-cols-4` | Jumps 1→4 on md, no 2-col intermediate step |

---

### Admin Dashboard

**Severity: Critical**

| Issue | Notes |
|-------|-------|
| Hardcoded fake stats | `totalUsers: 156`, `systemUptime: '99.8%'`, `satisfactionRating: 4.7` — none from API |
| Static activity feed | `recentActivities` hardcoded array — not real data |
| `bg-gradient-to-br from-slate-50 to-blue-50` | Different background from rest of system |
| Colors: raw Tailwind only | `text-blue-600`, `text-green-600` — no THEME |

---

### New Request Page

**Severity: Medium** (will be replaced by AI intake)

| Issue | Notes |
|-------|-------|
| Form has Department, Category, Priority | Per AI Ticket Intake design, these should move to Moderator |
| Edit mode URL param unhandled | `?edit=${ticket.id}` in URL but page doesn't read it |
| File scanning polling `setInterval` never cleared on unmount | Memory leak if user navigates away during scan |

---

### Requests List Page (Requestor)

**Severity: Low** — this is one of the better pages

| Issue | Notes |
|-------|-------|
| Filter bar always visible on desktop | No collapse on desktop — takes ~80px vertical space permanently |
| `isMobile` via `window.innerWidth` | Should use CSS/Tailwind breakpoints for SSR compatibility |
| Client-side filter runs AFTER API filter | Duplicate filtering — API filters and then client filters again |

---

### Request Detail Page

**Severity: High**

| Issue | Notes |
|-------|-------|
| Auto-close hardcoded 2 days | Should be 7 days per Business Rules |
| Chat hidden on draft | `status !== 'draft' && <UnifiedChatPanel>` — requestor cannot use chat on draft |
| No mobile tab navigation | On mobile, left+right columns stack; chat panel is at the very bottom |
| `canResolve = status === 'completed'` | FSM has no `completed` state — button never shows |
| `(ticket as any).reopenCount` | Unsafe cast — field may not exist |
| `(ticket as any).category` | Unsafe cast — should be in Ticket type |
| `confirm()` for delete draft | Native browser dialog |

---

### Moderator Ticket Pool

**Severity: High**

| Issue | Notes |
|-------|-------|
| 10-column table on mobile | No card view fallback — horizontal scroll with no indicator |
| SLA hardcoded 72h | Same issue as dashboard |
| Pagination stuck at "Page 1 of 1" | `disabled={true}` hardcoded — pagination not implemented |
| Bulk actions use `alert()` | "Change Priority" and "Postpone" are placeholders |
| `overflow-x-auto` with no hint | Users don't know to scroll horizontally |

---

### Notifications Page

**Severity: Low** — mostly fine

| Issue | Notes |
|-------|-------|
| Filter tabs use `bg-blue-600` | Not THEME colors |
| Delete notification — no confirm | Notification deleted immediately on click |

---

### Profile Page

Delegates to `DynamicProfile` component — not audited here (separate component read needed).

---

## Feature Gaps (Not UI Bugs, But Affects UX)

| Feature | Current State | Impact |
|---------|---------------|--------|
| Assignee task actions | `alert()` only — no API | Assignee cannot actually start or complete tasks |
| Bulk moderator actions | Placeholders | Moderator cannot bulk-assign or bulk-postpone |
| Edit ticket | URL param passed but not handled | requestor cannot edit draft |
| New request form | Full form with 6 fields | Will be replaced by AI Chat + 3-field form |
| Chat | Need to verify `UnifiedChatPanel` implementation | Previous audit found WebSocket may not be connected |

---

## Fix Priority Order

### Phase 1 — Design System (Before anything else)
- Establish CSS variables or Tailwind config for HDMS brand colors
- Create `src/lib/tokens.ts` with all color, spacing, radius constants
- Kill all inline hex color strings

### Phase 2 — Critical Bugs (Break functionality)
1. Assignee Dashboard — wire actual API for task actions
2. Remove mock data / fake stats from production pages
3. Replace all `alert()` / `confirm()` with Toast + ConfirmModal

### Phase 3 — High Impact UX
4. Request Detail — fix auto-close days, chat on draft, canResolve state
5. Moderator Ticket Pool — mobile card view, real pagination
6. Navbar — fix ghost URLs, profile popup content, touch-safe profile menu

### Phase 4 — Polish
7. Requestor Dashboard — fix chart empty state, color consistency
8. Admin Dashboard — real API data
9. Loading state standardization
10. Filter bar collapse on mobile (all list pages)

---

## What's Actually Good

| Area | Why It's Good |
|------|---------------|
| Auth flow | JIT sync, token refresh, role guard — solid |
| Sidebar mobile | Slide-out with overlay — proper implementation |
| Requests list | Mobile cards + desktop table + URL state — good pattern |
| File upload | Upload → scan → ready flow is well implemented |
| Socket integration | `useSocket` hook exists and is used in request-detail |
| Form validation | Client-side validation in new-request is thorough |
| Skeleton loading | Where used, looks professional |
| StatusBadge / PriorityBadge | Consistent components used across pages |
