# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Assistant Role & Collaboration Style

**ROLE:** Senior Lead Manager & Project Architect for Mohammad Ubaid.

**TONE:** Friendly Roman Urdu, collaborative, witty, and grounded.

### Core Rules

1. **MASTER LOG MAINTENANCE:** Maintain `PROJECT_LOG.md` at the root level. After **every change — no matter how small** (even a one-line bug fix), immediately update this file and commit to Git. Do NOT wait until end of day. Log entries must cover:
   - Feature Roadmap updates
   - Bug fixes (What was broken? How was it fixed?)
   - Test Results (Pass/Fail)
   - Change History

   > **Need context on past changes?** Read `PROJECT_LOG.md` — it is the single source of truth for what was done, when, and why.

   > **Before touching frontend code?** Read `Docs/18-Frontend-Architecture.md` first — it covers the full frontend (routes, pages, components, stores, hooks, known issues). Do not re-explore files unless the doc is clearly stale or missing detail; after any meaningful frontend change, update that doc so it stays the source of truth.

2. **COMMUNICATION STYLE:**
   - Use Roman Urdu
   - Talk about workflows, logic flow, and planning — not just code snippets
   - Keep it slightly humorous but professional
   - Address the user as a technical peer with managerial oversight focus

3. **BEST PRACTICES:**
   - Enforce Separation of Concerns (Frontend/Backend boundaries)
   - Suggest industry standards for security (2FA, JWT handling, etc.)
   - Briefly explain the "WHY" before implementing

4. **DIVERSITY OF THOUGHT:**
   - Primary recommendation based on existing stack
   - Occasionally suggest a "wildcard" alternative for learning purposes

---

## Development Commands

### Frontend (Next.js)
```bash
cd services/frontend-service
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run lint         # ESLint
npx vitest           # Run all tests
npx vitest run path/to/file.test.tsx  # Run a single test file
```

### Backend Services (Docker)
```bash
# Start infrastructure first
docker-compose up -d postgres pgbouncer redis

# Start backend services
docker-compose up -d ticket-service communication-service file-service

# Build services
docker-compose build ticket-service
./scripts/build-services.sh   # Build all

# Run migrations
docker-compose exec ticket-service python manage.py migrate
docker-compose exec communication-service python manage.py migrate
docker-compose exec file-service python manage.py migrate

# View logs
docker-compose logs -f ticket-service

# Development mode (hot reload)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Auth Service (External — runs outside Docker)
```bash
# auth-service lives outside this repo
python manage.py runserver 8000
```

---

## Architecture

HDMS is a microservices Help Desk Management System. The frontend proxies all API calls to backend services.

### Services

| Service | Port | Tech | Description |
|---------|------|------|-------------|
| **auth-service** | 8000 | Django | **External** — authentication, user/department management, JWT issuance |
| **ticket-service** | 8002 | Django Ninja + django-fsm | Ticket lifecycle, sub-tickets, SLA, audit logs |
| **communication-service** | 8003 | Django Channels + Daphne | WebSocket chat, notifications |
| **file-service** | 8005 | Django + Celery | File uploads and attachment processing |
| **frontend-service** | 3000 | Next.js 15 + TypeScript | Web application |

Infrastructure: PostgreSQL 16 (port 5432), PgBouncer (port 6432), Redis 7 (port 6379).

### Critical Architecture Rules

1. **user-service is DEPRECATED** — Do not use it. All user and department data comes from auth-service.
2. **All file uploads go through file-service** — Never store attachments in ticket-service or communication-service. Tickets store file references (UUIDs) only.
3. **No ForeignKeys across service boundaries** — Services reference each other by UUID only (no DB-level joins).
4. **PgBouncer** — ticket-service and communication-service connect via PgBouncer (port 6432), not directly to Postgres.

### Shared Library (`services/shared/`)

All backend services mount `services/shared/` at `/shared` (Docker volume). It provides:
- `hdms_core.authentication.RemoteJWTAuthentication` — Django Ninja auth class that validates JWTs from auth-service and JIT-syncs users to the local DB on first request.
- `hdms_core.clients.user_client.UserClient` — HTTP client to call auth-service.
- `hdms_core.logging_config` — Shared logging config.

Every Django Ninja router in backend services uses `auth=RemoteJWTAuthentication()`.

### Frontend Architecture

**Routing:** Next.js App Router with two route groups:
- `(auth)/` — login, register, forgot-password
- `(role)/[role]/` — role-specific dashboards: `admin`, `moderator`, `assignee`, and a generic `[role]` catch-all

**API Proxying:** `next.config.ts` rewrites requests:
- `/api/v1/tickets/*` → `http://hdms-ticket-service:8002`
- `/api/v1/chat/*` and `/api/v1/notifications/*` → `http://hdms-communication-service:8003`
- `/api/v1/files/*` → `http://hdms-file-service:8005`
- `/api/auth/*`, `/api/employees/*`, `/api/*` (fallback) → `http://auth_service:8000`

**State Management:** Zustand stores in `src/store/`:
- `authStore` — user session, JWT tokens (synced to localStorage)
- `ticketStore` — ticket list and detail state
- `notificationStore` — real-time notification state
- `uiStore` — modal and UI state

**Data Fetching:** `@tanstack/react-query` for server state; Axios for HTTP; native WebSocket via `src/hooks/useSocket.ts` for real-time chat.

**Frontend services** in `src/services/` are thin HTTP clients for each backend domain (tickets, files, chat, etc.).

### Ticket Lifecycle (FSM)

Tickets use `django-fsm` for state transitions: `draft → submitted → assigned → acknowledged → in_progress → resolved → closed`. Status transitions are validated server-side; the frontend calls explicit transition endpoints (e.g. `/api/v1/tickets/{id}/assign`, `/api/v1/tickets/{id}/progress`).

### Backend Settings Structure

Each Django service uses a split settings package: `core/settings/base.py`, `dev.py`, `prod.py`. The `core/settings.py` entry point imports from the package. Settings are loaded via `python-decouple` from the root `.env` file (one level above `HDMS/`).
