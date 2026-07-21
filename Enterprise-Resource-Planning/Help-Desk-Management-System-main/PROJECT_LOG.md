# PROJECT_LOG.md — HDMS Change Log

> Single source of truth for all changes. Update immediately after every change, then commit.

---

## Feature Roadmap

| Feature | Status | Notes |
|---------|--------|-------|
| Auth & JWT flow | Done | JIT sync via RemoteJWTAuthentication |
| Ticket lifecycle (FSM) | Done | draft → closed |
| File upload service | Done | file-service on port 8005 |
| Real-time chat (WebSocket) | Done | communication-service + Daphne |
| Notifications | Done | notificationStore + WebSocket |
| Employee management | Done | Managed via auth-service |
| Admin prefix-aware routing | Done | Full prefix architecture |
| **Unified Ticket List (Sprint 2)** | **Done** | TicketListView + 4 presets; 4 pages → 13-line wrappers; URL filter sync; bulk actions |
| **SLA Tracking** | **Planned** | Priority-based templates, milestone tracking, Moderator-only override — see Business Rules §9 |
| **AI Ticket Intake** | **Planned** | Chat agent (Gemini 2.0 Flash) + simplified form — see Docs/14-AI-Ticket-Intake.md |
| **Approval Workflow** | **Planned** | Finance/CEO approval path — to be designed |
| **Email-to-Ticket (Inbound)** | **Planned** | Email creates ticket automatically |
| **Sub-tickets** | **Planned** | `parent_ticket_id` nullable field to be added now, full feature Phase 2 |
| **Auto-close window** | **Planned** | Extend to 5-7 days (currently 3 days — too aggressive) |
| **Analytics Dashboard** | **Planned** | Department metrics, resolution times, bottlenecks |
| **Knowledge Base** | **Planned** | Self-service FAQ, linked to tickets |

---

## Change History

### 2026-05-21 — Live Bug Fixes (Production)

#### Bugs Fixed

| # | Error | Root Cause | Fix |
|---|-------|-----------|-----|
| 1 | Login: `JSON.parse: unexpected character at line 1 col 1` | `next.config.ts` hardcoded `http://auth_service:8000` for Docker. `auth_service` container doesn't exist in HDMS network — external at `hrms.idaraalkhair.sbs`. Next.js proxy failed → returned HTML error page → `JSON.parse` choked. | Added `AUTH_SERVICE_INTERNAL_URL` env var. `next.config.ts` reads it first: `process.env.AUTH_SERVICE_INTERNAL_URL \|\| (IS_DOCKER ? 'http://auth_service:8000' : ...)`. Set `AUTH_SERVICE_INTERNAL_URL=https://hrms.idaraalkhair.sbs` in `docker-compose.yml`. |
| 2 | WebSocket: `ws://localhost/ws/chat/...` on live site | `.env.local` (`NEXT_PUBLIC_WS_URL=ws://localhost:8003/ws`) was copied into Docker build context — Next.js bakes `NEXT_PUBLIC_*` at build time, so `localhost` got inlined into production bundle. No `.dockerignore` existed. | Created `services/frontend-service/.dockerignore` (excludes `.env.local`, `.env.development`). Added `ARG/ENV NEXT_PUBLIC_WS_URL` + `NEXT_PUBLIC_API_URL` to Dockerfile builder stage. Passed correct build args (`wss://hdms.idaraalkhair.sbs/ws`) in `docker-compose.yml`. |
| 3 | `/api/institutions` 404, `/api/branches` 404 | Frontend called `/api/institutions` but Auth-service mounts employees router at `/api/employees/` — actual endpoints are `/api/employees/institutions` and `/api/employees/branches`. | Fixed paths in `branchService.ts`, `institutionService.ts`, `EmployeeForm.tsx`. |
| 4 | `/api/departments` 404, `/api/designations` 404 | Same root cause as #3 — missing `/employees/` prefix. | Fixed in `EmployeeForm.tsx`. |
| 5 | `/api/v1/notifications/unread-count/` 422 "Field required: user_id" | Backend requires `?user_id=` query param but `notificationService` never passed it. All notification endpoints (`list`, `unread-count`, `mark-all-read`, `delete-all`) require `user_id`. | Updated `notificationService.ts` — added `userId: string` param to all affected methods. Updated `useNotifications.ts` — reads `user.id` from `authStore`, guards calls when user not loaded, passes `userId` to service layer. |

#### CI/CD Improvement
- **Old:** `docker compose build --no-cache` — rebuilds all 5 services from scratch every push. `npm ci` runs every time even when `package.json` unchanged.
- **New:** Selective builds based on `git diff`. Only service whose source dir changed gets rebuilt. Docker layer cache used. `shared/` changes trigger restart only (volume-mounted, no rebuild needed). `collectstatic` only runs for rebuilt backend services.
- Files: `.github/workflows/deploy.yml`

---

### 2026-04-23 (Sprint 2 — Unified Ticket List)

#### Summary
Replaced 4 duplicated ticket-list pages (~1,400 lines total) with a single shared `TicketListView` component driven by per-scope presets. Each page is now a ~13-line wrapper. Mock data fully removed from all 4 pages.

#### New Files
- **`src/components/tickets/TicketListView.tsx`** — Main shared component. React Query data fetching, URL filter sync via `useUrlFilters`, loading/error/empty states, desktop table + mobile cards, bulk selection state.
- **`src/components/tickets/TicketTable.tsx`** — Desktop table: 11 column types, pill-style ticket ID, progress bar, checkbox selection.
- **`src/components/tickets/TicketCards.tsx`** — Mobile card list: priority-color left accent bar, ticket ID pill, meta row, chevron.
- **`src/components/tickets/ListHeader.tsx`** — Title + subtitle + optional primary action button (e.g. "New Request").
- **`src/components/tickets/BulkActionBar.tsx`** — Sticky bulk-action bar; appears when selection.size > 0. Wired to real `ticketService` calls.
- **`src/components/tickets/EmptyState.tsx`** — Centered soft empty state with optional CTA.
- **`src/components/tickets/ErrorState.tsx`** — Centered error state with retry button.
- **`src/components/tickets/presets/types.ts`** — `TicketListPreset` interface, `ColumnKey`, `FilterKey`, `FilterValues`, `BulkAction`.
- **`src/components/tickets/presets/myRequestsPreset.ts`** — `baseFilters: { requestorId }`, primary action "New Request".
- **`src/components/tickets/presets/myTasksPreset.ts`** — `baseFilters: { assigneeId }`, includes `progressPercent` column.
- **`src/components/tickets/presets/ticketPoolPreset.ts`** — `baseFilters: { status: 'submitted' }`, bulk Reject + Postpone wired to real API.
- **`src/components/tickets/presets/reviewQueuePreset.ts`** — `baseFilters: { status: 'completed' }`, `completionPreview` column, custom status filter options.
- **`src/components/tickets/presets/index.ts`** — Barrel re-export.
- **`src/hooks/useUrlFilters.ts`** — Reads filter state from `searchParams` on mount; writes via `router.replace` (no scroll jump) on change. Only manages declared `availableFilters` keys; unknown params preserved.
- **`src/components/tickets/TicketListView.test.tsx`** — 4 tests: loading skeleton, error state, empty state, populated table.
- **`src/hooks/useUrlFilters.test.ts`** — 5 tests: initial state from URL, filter update writes URL, clear resets, unknown params preserved.

#### Rewritten (each now ~13 lines)
- **`src/app/(role)/[role]/requests/page.tsx`** — `myRequestsPreset(user.id, role)`
- **`src/app/(role)/assignee/tasks/page.tsx`** — `myTasksPreset(user.id)`
- **`src/app/(role)/moderator/ticket-pool/page.tsx`** — `ticketPoolPreset()`
- **`src/app/(role)/moderator/review/page.tsx`** — `reviewQueuePreset()`

#### Removed
- All `getMockTickets` / `generateMockTickets` usage from the above 4 pages.

#### Test Results
- `npx tsc --noEmit` → zero errors
- `npx vitest run` → 9 passed / 2 pre-existing integration test failures (ticketService hits live API — unchanged from before Sprint 2)

#### Known Gaps (Sprint 3)
- Bulk assign in ticket-pool dropped (needs assignee picker UI — documented in spec §9).
- Backend `moderator_id` not in Ticket model yet — proper participant tracking pending.
- THEME constants cleanup (hardcoded `#274c77`, `#e7ecef` still in some files — Sprint 3).

---

### 2026-04-22 (Ticket detail page — UI/UX polish + bug fixes)

#### UI Polish — Unified Ticket Detail Page
- **`src/app/(role)/[role]/ticket/[id]/page.tsx`** — Major layout + aesthetic overhaul:
  - Removed 44px breadcrumb header; ticket identity moved into right panel as hero card (gradient accent strip, decorative corner blob, pill-style monospace ticket ID, refined back button).
  - Outer container changed from `flex flex-col` to `flex gap-4 p-4` — chat + sidebar now sit as distinct cards with gap (no more merged look).
  - Ambient backdrop: layered radial gradients (primary-light top-left, medium bottom-right) + dotted grid overlay with radial mask for depth.
  - Overview card: flat 2-col grid → icon-chip stat cards (rounded squares with inset border) over tinted background. Uppercase micro-labels with `tracking-[0.12em]`.
  - Description card: top-line accent → vertical left gradient bar + chip-style "Show More" toggle.
  - Auto-close banner: thin strip → gradient card with icon chip.
  - Cards throughout: layered shadows + `ring-1 ring-black/[0.04]` hairlines for premium feel.
  - Removed stray debug classes (`bg-red-500 shadow-2xl`) on outer container.
- **`src/components/chat/UnifiedChatPanel.tsx`** — Dark gradient header → clean white with dot connection indicator. Noisy SVG messages bg → clean `#f4f6f9`. Own bubbles: green gradient → brand blue `#274C77` with proper shadow. Input area redesigned (rounded bordered container, 32px square send button).
- **`src/components/common/SLACard.tsx`** — Complete rewrite: `useMemo` computation, 4 health levels (healthy/warning/critical/breached), glowing progress bar, health % badge, contextual icons.
- **`src/components/common/ParticipantsCard.tsx`** — Stacked list → horizontal role-colored chips with avatar initials.

#### Bug Fixes — ticketService
- **`src/services/api/ticketService.ts`** L118: `requestorName` was concatenating `name + \n + code` → now just `requestorInfo.name`.
- **`src/services/api/ticketService.ts`** L127: Assignee lookup was hitting `/api/employees/employees/${id}` but `assignee_id` is a user UUID — fixed to `/api/employees/employees/by-user/${assignee_id}` (same pattern as requestor). Fixes "Assignee" placeholder showing instead of actual name in ParticipantsCard.

#### Verification
- `npx tsc --noEmit` → zero errors.
- Pending: user visual QA via browser hard-refresh (`Ctrl+Shift+R`) to clear employee cache.

---

### 2026-04-18 (Claude Code token optimization + WebSocket fix)

#### Claude Code Setup — Token Optimization
- **`.claude/settings.json`** (new) — Permission allowlist added: `Bash(npx tsc --noEmit)`, `Bash(npx tsc --noEmit *)`, `Bash(docker compose logs *)`. Eliminates permission prompts for these frequent commands (~15 round-trips/session saved).
- **`.claude/agents/test-runner.md`** (new) — Haiku-model subagent. Runs Vitest (frontend) and Django tests (backend) in isolated context, returns only failures. Prevents verbose test output from polluting main conversation (~10–50k tokens/run saved).
- **`.claude/agents/docker-inspector.md`** (new) — Haiku-model subagent. Inspects HDMS Docker container state (both `docker-compose.yml` HDMS services and `docker-compose.infra.yml` infra services). Filters logs to errors only. Auth-service correctly noted as external (port 8000, not Docker).
- **`.claude/agents/code-reviewer.md`** (new) — Read-only subagent (no Edit/Write). Reviews diffs/files for bugs, security issues, and HDMS architecture violations. Returns only high-confidence findings.
- **`.claude/skills/api-endpoints-guide/SKILL.md`** (new) — Full HDMS API endpoint map (42 endpoints across ticket-service, communication-service, file-service, auth-service). Auto-invokes before Claude reads Django routers (~8–15k tokens saved per API question).

#### Bug Fix — WebSocket 1006 (chat showing offline)
- **Root cause:** PgBouncer→Postgres connection timeout caused communication-service to fail all DB queries → WebSocket handshake failed.
- **Fix 1:** Restarted infra: `docker compose -f docker-compose.infra.yml restart postgres pgbouncer`, then `docker compose restart communication-service`.
- **Root cause 2:** `chatSocket.ts` was constructing WS URL from `ENV.COMMUNICATION_SERVICE_URL` (empty string) → fell back to `window.location.host` → `localhost:3000` (Next.js, no WS proxy).
- **Fix 2:** `services/frontend-service/.env.local` (new) — `NEXT_PUBLIC_WS_URL=ws://localhost:8003/ws` for dev (direct to Daphne, bypasses Next.js).
- **Fix 3:** `services/frontend-service/src/services/socket/chatSocket.ts` — Replaced manual URL construction (lines 65–72) with `ENV.WS_URL` which respects `NEXT_PUBLIC_WS_URL`. Chat now connects on first load.

#### Known Issue (not fixed yet)
- **`ticketService.ts:93`** — Requestor name shows as "User DA8B..." instead of real name. Root cause: code calls `/api/employees/{user_uuid}` but auth-service endpoint expects `employee_id` code (e.g. "IAK-0003"), not user UUID. Silent fallback is in place. Fix deferred — requires either auth-service endpoint change or TicketOut schema denormalization.

---

### 2026-04-17 (Sprint 1 close — Navigation unification + legacy cleanup)
- **Nav updates:** All ticket-detail links across the app migrated to unified `/[role]/ticket/[id]`. Files: `useTicketActions`, `NotificationCard` (now role-aware via `useAuth`), `DynamicNotifications`, `UnifiedDashboard` (all task-detail refs → ticket), `[role]/requests`, `[role]/new-request`, `moderator/ticket-pool`, `moderator/review`, `moderator/create-subtickets`, `assignee/tasks`.
- **PageContainer rollout (batch 2):** `[role]/notifications`, `[role]/requests`, `[role]/new-request` (fluid max-w-4xl), `moderator/ticket-pool`, `moderator/assigned`. Outer `<div className="p-4 sm:p-6 lg:p-8" style={bg}>` + inner `max-w-7xl` wrappers replaced with `<PageContainer>`.
- **Deletions (legacy pages):** `[role]/request-detail/[id]`, `moderator/review/[id]`, `assignee/task-detail/[id]` — replaced by unified `[role]/ticket/[id]`.
- **Deletions (redundant pages, user request):** `moderator/reassign`, `moderator/reassign/[id]`, `moderator/assigned` (reassign/view moved inside ticket detail), `admin/reports`, `assignee/reports` (demo data, no real export).
- **Deletions (legacy components):** entire `components/review/` folder (TicketChatPanel, TicketDetailsPanel, ModeratorActionsPanel, ReviewPageHeader) + `components/common/TicketChat.tsx`. Unused after page deletions.
- **Config cleanup:** `src/lib/rbac.ts`, `src/config/routes.ts`, `src/components/layout/Sidebar.tsx` — removed reassign/assigned/reports/settings entries. Admin sidebar gained missing Analytics entry; Settings removed from nav.
- **Build fix:** `moderator/ticket-pool/page.tsx` JSX mismatch (leftover `</div>` after PageContainer conversion).
- **Docs:** `CLAUDE.md` — added durable instruction to read `Docs/18-Frontend-Architecture.md` before any frontend change and keep it updated. `Docs/18` — route tree + tech-debt sections rewritten to reflect deletions (moderator Reassign wiring inside unified ticket detail is the main TODO).
- **TypeScript:** `npx tsc --noEmit` clean — 0 errors after all changes.

### 2026-04-15 (Sprint 1 — Unified Ticket Detail)
- **Docs:** `Docs/18-Frontend-Architecture.md` — Created. Full frontend reference: all 37 pages by role, all components with purpose, API services, Zustand stores, hooks, known issues, sprint plan. Read this before any frontend session.
- **Code:** `src/app/(role)/[role]/ticket/[id]/page.tsx` — Unified ticket detail page created. Single page for all roles. Role-based `RoleActionsPanel` (moderator: assign/reject/postpone/clarify/edit | assignee: acknowledge/start/progress/complete/postpone | requestor: submit/edit/resolve/reopen/delete). Desktop split layout (details left, chat right). Mobile tabbed (Details | Chat). WebSocket real-time updates. No `alert()` calls. Proper `AlertModal`, `ConfirmModal`, `InlineModal`. Auto-close countdown. Description expand/collapse. Proper skeleton loading. All THEME colors. Route: `/[role]/ticket/[id]`.
- **Refactor (partial):** PageContainer applied to ~15 admin/assignee/moderator pages. Imports added, wrapper divs replaced. Remaining: notifications, requests, new-request, employees/page, moderator pages (reassign, ticket-pool, create-subtickets, assigned).

### 2026-04-15 (earlier)
- **Refactor:** `UnifiedDashboard.tsx` — SLA helpers added (hoursElapsed, alpha() color util, P_BORDER priority borders). Remaining mock data imports removed. TicketPriority type wired in.
- **Fix:** `Navbar.tsx` — ghost search URLs replaced with real role-aware routes via `getPagesByRole()`. Removed unused icon imports. Fixed `onFocus2` TS typo.
- **Fix:** 6 chart files — hardcoded mock fallback data removed from all charts (DepartmentLoad, PriorityDistribution, PriorityTrend, ResolutionTimeTrend, StatusDistribution, TicketVolume). Empty state shown when no real data.

### 2026-04-14
- **Refactor:** `UnifiedDashboard.tsx` created — replaces 4 separate dashboard components (AdminDashboard, AssigneeDashboard, ModeratorDashboard, requestorDashboard). Single component with role-based content sections. Real API data, no alert() calls, no hardcoded stats.
- **Fix:** `next.config.ts` — proxy URLs now environment-based. `DOCKER_ENV=true` → Docker container hostnames. Default (local dev) → `localhost:PORT`. Fixes `EAI_AGAIN auth_service` error when frontend runs outside Docker.
- **Code:** `PageContainer.tsx` — new shared wrapper for all standard pages (dashboards, lists, forms). Replaces per-page inline padding div. Phase 1.2 complete.
- **Code:** `TicketHeader.tsx` — new shared fixed header for all ticket detail views. Shows: back button, ticket ID, StatusBadge, PriorityBadge, subject, relative time, department. `actions` slot for role-specific buttons. Phase 2.2 (partial) complete.

### 2026-04-13
- **Docs:** `Docs/15-UI-UX-Audit.md` — Complete system-wide UI/UX audit. Every page read directly from code. Issues documented: 3 critical system-wide (color chaos, mock data in production, alert() dialogs), 10+ page-specific bugs, feature gaps (Assignee actions are UI-only with no API, Admin dashboard has hardcoded fake stats).
- **Docs:** `Docs/16-Design-System.md` — Created. Defines: THEME as single color source, UnifiedChatPanel unified architecture decision (one shell, context-based props), illogical fields/validations inventory, page layout rules, mobile strategy, implementation priority phases.
- **Decision:** UnifiedChatPanel → single chat component for all contexts (ticket, sub-ticket, AI intake). Context-based behavior via props added incrementally. Prevents 3 separate components with duplicate bugs.
- **Code:** `UnifiedChatPanel.tsx` — Added `mode?: 'sidebar' | 'inline'` prop (partial — full implementation in progress for Request Detail tab view).
- **Planning:** Full UI redesign queue documented — `Docs/17-UI-Redesign-Queue.md`. 5 phases: (1) Layout restructure, (2) Unified ticket detail page, (3) Dashboard standardization, (4) List pages standardization, (5) Polish & bug fixes.
- **Decision:** Single unified ticket detail page `/[role]/ticket/[id]` replaces 3 separate pages. Role-based action panel dispatches correct component per role.
- **In Progress:** Phase 1.1 — Layout restructure (removing inner padding wrapper from Layout component).

### 2026-04-12
- **Setup:** CLAUDE.md updated with assistant role, logging rules, and communication style.
- **Setup:** `.claude/` added to `.gitignore`.
- **Setup:** `PROJECT_LOG.md` created as master change log.
- **Planning:** Full market research conducted — HDMS architecture cross-checked against Zendesk, Freshdesk, Jira SM, osTicket. Key gaps identified: SLA, Approval Workflow, Email-to-ticket.
- **Planning:** SLA design finalized and locked — priority-based templates (High/Medium/Low), milestone tracking (75% warning + breach), Moderator-only override with mandatory reason + audit log. See `Docs/07-Business-Rules.md §9`.
- **Docs:** `Docs/07-Business-Rules.md` — SLA section (§9) fully rewritten with finalized design.
- **Planning:** Auto-close window updated 3→7 days, warning on Day 5. Rationale: NGO field staff. See Business Rules §3.4.
- **Planning:** Sub-ticket rules fully defined — parent SLA dynamic (max of children), requestor limited view (dept+status+progress only), chat separation (parent: requestor+moderator, sub: moderator+assignee), rejection blocks parent until Moderator resolves. See Business Rules §1.
- **Pending Planning:** Email-to-ticket.
- **Planning:** AI Ticket Intake fully designed — Gemini 2.0 Flash, key rotation via Redis, Roman Urdu + Karachi jargon support, Option A attachments (end of chat), simplified form (3 fields), Moderator override with audit log. See Docs/14-AI-Ticket-Intake.md.

---

## Bug Fix Log

| Date | Bug | Fix | Service |
|------|-----|-----|---------|
| Pre-log | JIT email conflict on user sync | Fixed conflict resolution in RemoteJWTAuthentication | shared/auth |
| Pre-log | File upload returning 400 | Fixed request format in file-service | file-service |
| Pre-log | WebSocket crash on missing employee_code | Added null check | communication-service |

---

## Test Results

| Date | Test | Result | Notes |
|------|------|--------|-------|
| — | — | — | Log tests here as they run |

---
