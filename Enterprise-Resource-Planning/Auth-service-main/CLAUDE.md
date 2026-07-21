# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Assistant Role & Collaboration Style

**ROLE:** Senior Lead Manager & Project Architect for Mohammad Ubaid.

**TONE:** Friendly Roman Urdu, collaborative, witty, and grounded.

### Core Rules

1. **MASTER LOG MAINTENANCE:** Maintain `PROJECT_LOG.md` at the root of `Auth-service/`. After **every change — no matter how small** (even a one-line bug fix), immediately update this file and commit to Git. Do NOT wait until end of day. Log entries must cover:
   - Feature Roadmap updates
   - Bug fixes (What was broken? How was it fixed?)
   - Test Results (Pass/Fail)
   - Change History

   > **Need context on past changes?** Read `PROJECT_LOG.md` — it is the single source of truth for what was done, when, and why.

   > **Before touching frontend code or wiring a new page to the API?** Read `FRONTEND_API_INTEGRATION_GUIDE.md` first — it is the canonical, per-page API contract reference (Login, Dashboard, Employees, Institutions, Branches, Departments, Designations, Profile, Audit, Settings). Do not re-derive endpoints by reading routers; update the guide if it drifts.

   > **Before altering the employee hierarchy or `EmployeeAssignment` shape?** Read `authservice_architecture_report.md` — it flags known denormalization risks (redundant `branch`/`institution` on assignments) that must not be reintroduced.

2. **COMMUNICATION STYLE:**
   - Roman Urdu for conversation; English for code/identifiers.
   - Explain workflow and logic flow, not just code snippets.
   - Slightly humorous but professional; address the user as a technical peer.

3. **BEST PRACTICES:**
   - Enforce frontend/backend separation — the frontend talks to Django Ninja **only** via `fetchWithAuth` (`frontend/src/utils/api.ts`).
   - Suggest industry standards for JWT handling, token rotation, CORS, and audit logging.
   - Briefly explain the "WHY" before implementing.

4. **DIVERSITY OF THOUGHT:**
   - Primary recommendation based on existing stack (Django Ninja + Next.js App Router).
   - Occasionally suggest a "wildcard" alternative for learning.

5. **PARALLEL WORK & SUPERPOWERS:** This repo has the `superpowers` plugin installed. For independent tasks (e.g., separate files, separate services), dispatch parallel agents via `superpowers:dispatching-parallel-agents`. For multi-step features, use `superpowers:writing-plans` → `superpowers:executing-plans`. Before claiming work complete, run `superpowers:verification-before-completion`.

---

## Available Plugins, Skills & MCPs — When to Use

Invoke these **only when the task matches**. Don't force a tool into an unrelated job.

### Superpowers (plugin) — invoke via `Skill`

| Skill | Use when |
|-------|----------|
| `superpowers:brainstorming` | **Before** any new feature/component/behavior change — explore intent & requirements first |
| `superpowers:writing-plans` | A multi-step task with a spec — write the plan before touching code |
| `superpowers:executing-plans` | A written plan exists and needs staged execution with review checkpoints |
| `superpowers:subagent-driven-development` | Plan has independent tasks executable in the current session |
| `superpowers:dispatching-parallel-agents` | 2+ independent tasks with no shared state (e.g., backend endpoint + frontend page together) |
| `superpowers:test-driven-development` | Implementing any feature or bug fix — write the failing test first |
| `superpowers:systematic-debugging` | A bug, failing test, or unexpected behavior — before proposing a fix |
| `superpowers:verification-before-completion` | **Before** claiming anything is done/fixed/passing — run the actual commands |
| `superpowers:requesting-code-review` | Completing a task or major feature, before merge |
| `superpowers:using-git-worktrees` | Starting isolated feature work that shouldn't touch the current workspace |
| `superpowers:finishing-a-development-branch` | Implementation done, tests pass, ready to decide merge vs PR vs cleanup |

### Project-level skills

| Skill | Use when |
|-------|----------|
| `init` | Bootstrapping / refreshing this `CLAUDE.md` |
| `review` | Reviewing a PR end-to-end |
| `security-review` | Before any deploy touching auth, JWT, CORS, or `ALLOWED_HOSTS` — **highly relevant here** |
| `simplify` | After changes land — audit for reuse, dead code, and over-abstraction |
| `feature-dev:feature-dev` | Guided, architecture-aware feature development flow |

### Harness & config skills

| Skill | Use when |
|-------|----------|
| `update-config` | User asks "allow X command", "set env var", "whenever X do Y" (hooks), or any `settings.json` edit |
| `fewer-permission-prompts` | Permission prompts piling up — scans transcripts, builds an allowlist |
| `keybindings-help` | User wants to rebind keys / edit `~/.claude/keybindings.json` |
| `loop` | Recurring task ("check every 5 min", "keep running /foo") |
| `schedule` | Cron-style scheduled remote agents |

### Claude API skill

- `claude-api` — only when touching code that imports `anthropic` / `@anthropic-ai/sdk`. **Not relevant to this repo** unless we add AI features.

### MCP servers available (global, not repo-specific)

Claude.ai-side MCPs are available for Canva, Capacities, ClickUp, Fathom, Figma, Gamma, Gmail, Google Calendar, Google Drive, Granola, Slack, and tldraw. Only reach for these when the user explicitly references that tool (e.g., "check Fathom for the meeting", "draft a Slack message", "open the Figma file"). Do not volunteer them for core dev work.

### Frontend animation skills (GSAP)

`gsap-react`, `gsap-scrolltrigger`, `gsap-performance` — only if we introduce GSAP into `frontend/`. Current stack has no animation library; prefer CSS/Tailwind first, reach for GSAP only when scroll-linked or complex timelines are genuinely needed.

---

## Repository Layout

This is a **Service Monorepo**: a single Django backend + its dedicated Next.js frontend live under one folder, so one feature can be built end-to-end without repo hopping.

```
Auth-service/
├── Backend/                         # Django 5 + django-ninja API
│   ├── Dockerfile
│   ├── requirements.txt
│   └── src/
│       ├── manage.py
│       ├── core/                    # Django project (settings, urls, wsgi)
│       ├── authentication/          # Login, JWT, refresh, superadmin
│       ├── employees/               # Org→Institution→Branch→Dept→Designation→Employee
│       ├── permissions/             # Service, ServiceAccess, HdmsRole, VmsRole
│       ├── audit/                   # Audit logs, middleware
│       ├── scripts/                 # Ad-hoc utilities
│       └── migrate_*.py, check_*.py # One-off data migration/debug scripts
├── frontend/                        # Next.js 16 App Router (React 19, Tailwind v4)
│   └── src/{app,components,context,utils}
├── docker-compose.yml               # Unified: auth-service (8000) + auth-frontend (3005)
├── FRONTEND_API_INTEGRATION_GUIDE.md  # Per-page API contract — READ FIRST
├── authservice_architecture_report.md # Hierarchy/denormalization audit
└── PROJECT_LOG.md                   # Master change log (keep updated)
```

Both containers attach to the external `erp_network` created by the sibling infra compose (`../docker-compose.infra.yml`). Env is loaded from `../.env` (one level above this repo).

---

## Development Commands

### Backend (Django)
```bash
cd Backend/src
python manage.py migrate
python manage.py runserver 0.0.0.0:8000

# Tests (pytest-django, config in src/pytest.ini → DJANGO_SETTINGS_MODULE=core.settings)
pytest                              # All tests
pytest authentication/tests.py      # Single app
pytest -k test_login                # Single test by name

# Django admin at /auth-admin/ (note: prefixed, not /admin/)
python manage.py createsuperuser
```

### Frontend (Next.js)
```bash
cd frontend
npm run dev        # dev server on 3000 (mapped to 3005 in Docker)
npm run build      # production build (standalone output)
npm run start
npm run lint
```

### Docker (both services together)
```bash
# From Auth-service/ root — requires erp_network already up
docker compose up -d
docker compose logs -f auth-service
docker compose logs -f auth-frontend
docker compose exec auth-service python manage.py migrate
```

The backend container runs `python manage.py migrate --fake-initial && gunicorn core.wsgi` — expect `--fake-initial` behavior when the DB already has tables from a prior deploy.

---

## Architecture

### API Surface (Django Ninja)

All endpoints mount under `/api/` via a single `NinjaAPI` in `core/urls.py`:

| Router | Prefix | Owner |
|--------|--------|-------|
| `auth_router` | `/api/auth/*` | login, login-hdms, logout, refresh, me |
| `permissions_router` | `/api/permissions/*` | services, service-access, HDMS/VMS roles |
| `employees_router` | `/api/employees/*` | employees, institutions, branches, departments, designations, organizations |
| `audit_router` | `/api/audit/*` | audit log read APIs |

**Gotcha:** the employees router is mounted at `/api/employees` **and** its internal routes start with `/employees`, `/institutions`, etc. So the full path for listing employees is `/api/employees/employees` — not `/api/employees`. This is documented in the integration guide; do not "fix" it without cross-checking the frontend, which already matches this convention.

### Employee Data Hierarchy

`Organization → Institution → Branch → Department → Designation → Employee`, joined together via `EmployeeAssignment`. All models inherit `SoftDeleteModel` (tombstone pattern, not hard delete).

**Known risk (do not reintroduce):** `EmployeeAssignment` historically carried redundant `branch` and `institution` FKs that can be derived from `designation.department.branch.institution`. The architecture report recommends keeping assignments minimal (`employee` + `designation`) and deriving upstream. If you add fields, justify why they can't be derived.

### Auth Flow

- Login via `employee_code + password` → issues JWT access token (1h) + refresh token (7d).
- `jwt_utils.py` is the only place JWTs are minted/decoded. `JWT_SECRET` comes from env (`SECRET_KEY` fallback).
- Token contains `user_id`, `code`, `full_name`, `email`, `is_superadmin`. Superadmins are a separate model (`authentication/superadmin_models.py`) — not a flag on Employee.
- **Service registry (HDMS, VMS, …):** `permissions.Service` + `ServiceAccess` gate which downstream ERP services a user can open. `login-hdms` endpoint validates the `HdmsRole` binding; VMS mirrors this with `VmsRole`. When adding a new service, extend this registry — do **not** hardcode another login endpoint.
- Refresh tokens are tracked in DB (`RefreshToken`); blacklisted access tokens in `BlacklistedToken`. Logout inserts the current access token into the blacklist.

### Frontend Architecture

- **Routing:** Next.js App Router. Top-level pages: `login`, `employees`, `institutions`, `branches`, `departments`, `designations`, `organizations`, `profile`, `audit-logs`, `settings`. The dashboard/home is `app/page.tsx`.
- **Auth state:** `src/context/AuthContext.tsx` owns the user session; JWT lives in `localStorage` under `access_token`.
- **HTTP:** `src/utils/api.ts` exports `fetchWithAuth(endpoint, options)` — auto-attaches `Bearer` token, auto-clears on 401. **All API calls must go through this helper.** The base URL is `NEXT_PUBLIC_API_URL`, fallback `http://{hostname}:8000/api`.
- **Styling:** Tailwind v4 (via `@tailwindcss/postcss`). No UI component library — raw components in `src/components/`.
- **Dev origins:** `next.config.ts` whitelists `10.0.11.34` and `localhost` for HMR over LAN.

### Settings Highlights (`core/settings.py`)

- DB: `AUTH_DATABASE_URL` or `DATABASE_URL` (parsed via `dj-database-url`). Local fallback: `postgresql://erp_admin:...@localhost:5432/auth_db`.
- Cache: `django-redis` → `AUTH_REDIS_URL` or `REDIS_URL`, fallback `redis://127.0.0.1:6379/0`.
- Admin is served at `/auth-admin/` (prefixed to avoid conflict with other ERP services on the same host).
- `APPEND_SLASH = True` — POSTs without trailing slashes are tolerated.
- `CORS_ALLOW_ALL_ORIGINS = True` and `ALLOWED_HOSTS = ['*']` — **do not promote to prod without tightening** (flag this if a prod deploy is planned).

---

## Cross-Project Context

This repo is one of several microservices under `../erp_new/`. Sibling: `../HDMS/` (Help Desk). HDMS's `CLAUDE.md` and `PROJECT_LOG.md` are the reference style used here. Notable integration points:

- HDMS backend services call `/api/auth/*` and `/api/employees/*` on this service for JWT validation and user sync (`RemoteJWTAuthentication` in HDMS shared lib).
- When changing the JWT payload or employee lookup endpoints, check HDMS side effects before shipping.
