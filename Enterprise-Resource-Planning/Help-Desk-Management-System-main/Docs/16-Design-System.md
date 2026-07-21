# Design System & UI Architecture

**Status:** In Progress  
**Last Updated:** 2026-04-13  
**Depends On:** `Docs/15-UI-UX-Audit.md`

---

## Overview

HDMS currently has three color systems running in parallel. This document defines the single source of truth going forward, plus the unified component architecture.

---

## Color Tokens (Single Source of Truth)

`src/lib/theme.ts` already exists and is the canonical color system. **All new code must use THEME — no raw hex strings.**

```ts
// Current THEME (already in src/lib/theme.ts)
THEME.colors.primary    = '#274C77'  // dark navy — primary actions, headers
THEME.colors.medium     = '#6096BA'  // mid-blue — secondary actions, hover
THEME.colors.light      = '#A3CEF1'  // light blue — backgrounds, borders
THEME.colors.background = '#E7ECEF'  // page background
THEME.colors.gray       = '#8B8C89'  // muted text, borders
THEME.colors.success    = '#10B981'
THEME.colors.warning    = '#F59E0B'
THEME.colors.error      = '#EF4444'
THEME.colors.info       = '#3B82F6'
```

### Usage Rule

```tsx
// ✅ Correct
<div style={{ color: THEME.colors.primary }}>...</div>

// ❌ Wrong — inline hex
<div style={{ color: '#274c77' }}>...</div>

// ❌ Wrong — raw Tailwind (not mapped to HDMS brand)
<div className="text-blue-600">...</div>
```

### Migration Priority

Fix inline colors when touching a file, not as a separate task. Don't do a color-only PR — it creates noise with no user-visible value.

---

## UnifiedChatPanel — Unified Chat Architecture

### Decision: One Chat Shell, Context-Based Behavior

All chat use cases (ticket, sub-ticket, AI intake) use `UnifiedChatPanel`. Same UI shell, configurable behavior via props.

**Why:** Fix once, works everywhere. Same bugs don't live in three components.

### Current Props

```tsx
<UnifiedChatPanel
  ticketId="uuid"
  mode="sidebar" | "inline"    // layout mode — IMPLEMENTED
  className?: string
/>
```

### Future Props (Add When Feature Is Built, Not Before)

```tsx
// Add when sub-tickets are implemented
context?: "ticket" | "sub-ticket"   // controls who can see/send
canSend?: boolean                    // false = read-only view

// Add when AI intake is implemented  
aiMode?: boolean                     // enables streaming bubbles, bot badge
canAttach?: boolean                  // false = no attachment during AI intake
```

### Mode Reference

| Mode | When Used | Behavior |
|------|-----------|----------|
| `sidebar` | Request Detail desktop | Sticky side panel + floating button on mobile |
| `inline` | Request Detail mobile (chat tab) | Renders directly in parent container, no floating button |

---

## Page Layout Rules

### Global Layout Constraint

`Layout` component (`src/components/layout/layout.tsx`) wraps all page content in:
```tsx
<div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
  {children}
</div>
```

**All pages live inside this padding.** Don't fight it — design within it.

### Standard Page Structure

```tsx
// Standard page
<div className="space-y-6" style={{ backgroundColor: THEME.colors.background, minHeight: '100vh' }}>
  {/* Page Header */}
  <div>
    <h1 style={{ color: THEME.colors.primary }}>...</h1>
  </div>
  
  {/* Content */}
  ...
</div>
```

### Exception: Request Detail (Split Layout)

Request Detail Page is the only page with a split layout:
- Desktop: 2-column (details + chat)
- Mobile: Tab navigation (Details tab | Chat tab)

---

## Ticket Detail — One Page vs Separate Pages

**Decision: Separate pages per role — but with shared components.**

### Why NOT one page

Merging requestor + moderator + assignee into one page means:
- 200+ lines of `if (role === 'moderator')` conditionals
- Role-specific complexity bleeds across all views
- Harder to test, harder to maintain

### Why separate pages IS correct

| Role | Unique Actions |
|------|---------------|
| Requestor | Submit draft, Edit, Request reopen, Delete draft |
| Moderator | Assign, Reject, Postpone, SLA override, Sub-ticket create, Initial review |
| Assignee | Start task, Mark complete, Request postpone |

Three fundamentally different workflows → three pages. This is correct.

### The REAL problem — shared components not used

Currently each page re-renders the same ticket info independently. The fix is not merging pages — it's extracting shared components:

**Already shared (exists):**
- `AttachmentsCard` ✓
- `TicketTimeline` ✓ 
- `ParticipantsCard` ✓
- `UnifiedChatPanel` ✓
- `StatusBadge` ✓
- `PriorityBadge` ✓

**Needs to be extracted (currently duplicated):**
- `TicketInfoCard` — subject, status, priority, department, category, SLA in one card
- `DescriptionCard` — description with expand/collapse

**Already role-specific (correct to keep separate):**
- `ModeratorActionsPanel` ✓ (exists in components/review/)
- `AssigneeActionsPanel` ✓ (exists in components/tickets/)
- `RequestorActionsPanel` — to be created (currently inline in request-detail page)

---

## Mobile Strategy

### Rule: Mobile-First Breakpoints

All new components must work on 375px screens first, then scale up.

```tsx
// ✅ Mobile-first
<div className="p-4 md:p-6 lg:p-8">

// ❌ Desktop-first
<div className="p-8">
```

### Mobile Patterns

| Pattern | When to Use |
|---------|-------------|
| Tab navigation (Details/Chat) | Request Detail Page |
| Card list instead of table | Any list < 4 columns on mobile |
| Collapsible filter panel | Pages with filter bars |
| Bottom sticky actions | Pages with primary action buttons |

---

## Illogical Fields & Validations — Issues Found

These are fields/validations that contradict the intended workflow.

### New Request Form (`/new-request`)

**Current (Wrong):**
- Requestor must select: Department, Category, Priority — 6 fields total

**Problem:** Per Business Rules and AI Ticket Intake design, requestors should NOT set these:
- Department → Moderator assigns during review
- Category → Moderator assigns during review
- Priority → Moderator assigns (or AI suggests)

**Correct approach:**
- Requestor fills: Subject, Description, Attachments (3 fields only)
- AI Intake: AI auto-suggests department/category/priority (Moderator can override)
- Classic form: Subject, Description, Attachments — department/category/priority stays with Moderator

**Status:** Will be fixed when AI Intake is implemented.

---

### Request Detail — Wrong FSM Status

**Current (Bug in code):**
```tsx
const canResolve = ticket?.status === 'completed';  // ❌ 'completed' state doesn't exist
```

**Correct FSM states:** `draft → submitted → pending → under_review → assigned → in_progress → resolved → closed`

```tsx
const canResolve = ticket?.status === 'in_progress';  // ✅ requestor marks as resolved
```

**Fix:** Already planned in implementation.

---

### Auto-Close Countdown Mismatch

**Current (Bug):**
```tsx
const autoCloseDate = new Date(resolvedDate.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days
```

**Business Rules §3.4:** Auto-close after **7 days**, warning on Day 5.

**Fix:** Change multiplier from `2` to `7`.

---

### Hardcoded Open Ticket Limit

**Current:**
```tsx
if (openTicketsCount >= 10) { setFormError('...') }
```

This is business logic in UI. Should come from server config. For now acceptable, but should be an env config or API response in production.

---

### Reopen Logic in Component

**Current:**
```tsx
const canReopen = (ticket?.status === 'closed') && reopenCount < 2;
const handleReopen = async (reason: string) => {
  if (!ticket || reopenCount >= 2) return;
```

`reopenCount` comes from `(ticket as any).reopenCount` — unsafe cast. If the field doesn't exist, reopenCount defaults to 0, making the limit appear as never-reached.

**Fix:** Ticket model must expose `reopen_count` as a proper field, and the type definition should include it.

---

### Navbar Search — Ghost URLs

The Navbar search bar suggests pages that don't exist (see full list in Audit doc §5). Every click causes a 404.

**Fix:** Align `getPagesByRole()` in Navbar with actual routes in the sidebar.

---

### Assignee Task Actions — UI-Only (No API)

**Current:**
```tsx
const handleStartTask = (taskId: string) => {
  alert(`Task ${taskId} has been started...`);  // no API call
};
```

**Problem:** Clicking "Start" or "Complete" in Assignee Dashboard does nothing on the server. Task status never changes.

**Fix:** Replace with actual `ticketService.changeStatus()` calls + Toast notification.

---

## Implementation Priority

### Phase 1 — Now (No Backend Changes)
1. **Request Detail Page** — mobile tab nav + bug fixes (auto-close days, canResolve, chat on draft)
2. **UnifiedChatPanel** — `mode` prop (done), prep for future `context` prop

### Phase 2 — After AI Intake Design
3. **New Request form** — replace with AI Chat + 3-field classic form
4. **UnifiedChatPanel** — add `aiMode`, `canSend` props

### Phase 3 — Backend Features
5. **Assignee task actions** — wire actual API
6. **Sub-ticket chat** — add `context="sub-ticket"` to UnifiedChatPanel
7. **Reopen count** — expose from ticket model properly

---

## What NOT to Do

- Don't create separate `TicketChat`, `SubTicketChat`, `AIChatBox` components — use UnifiedChatPanel with props
- Don't hardcode business rules (SLA hours, reopen limits) in components — they belong in config or API
- Don't fight the Layout padding — design within it
- Don't run a "color refactor" PR — fix colors when touching files
