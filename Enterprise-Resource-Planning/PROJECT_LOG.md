# PROJECT_LOG.md — ERP Integration Log

> Single source of truth for cross-service changes. Update immediately after every change, then commit.

---

## Active Projects

| Project | Status | Repo |
|---------|--------|------|
| VMS ↔ Auth-Service Integration | In Progress | `erp_new/VMS/` |
| HDMS (Help Desk Management System) | Production Live | `erp_new/HDMS/` |
| Auth-Service | Staging Live | `erp_new/Auth-service/` |
| Infra / Edge Nginx | Staging Live | `erp_new/` |
| CI/CD (GitHub Actions) | Live — self-hosted runner on VM | `erp_new/`, `HDMS/`, `Auth-service/` |

---

## VMS ↔ Auth-Service Integration Roadmap

| Task | Status | Notes |
|------|--------|-------|
| Auth-Service: Add `Service` model (dynamic registry) | ✅ Done | Migration 0004 — seeds sis, hdms, vms |
| Auth-Service: Add `VmsRole` model | ✅ Done | admin / receptionist / security_staff |
| Auth-Service: `POST /api/auth/login-vms` | ✅ Done | Validates ServiceAccess(service='vms') + VmsRole |
| Auth-Service: VMS permission endpoints | ✅ Done | grant-vms-access, vms-access/{id}, vms-role, vms-users |
| Auth-Service: `check/{service}` dynamic validation | ✅ Done | Now queries Service table instead of hardcoded list |
| VMS: `AuthServiceClient` utility | ✅ Done | login, verify_token, get_employees, get_departments, get_designations |
| VMS: `VmsHybridAuthentication` DRF class | ✅ Done | Detects auth-service vs local JWT, Redis-cached /me validation |
| VMS: Login proxy with local fallback + warning | ✅ Done | `VmsLoginView` — 503-safe, amber toast on frontend |
| VMS: Employee/dept views from auth-service | ✅ Done | Live fetch + Redis 5-min cache + 503 fallback message |
| VMS: Docker `erp_network` join | ✅ Done | `AUTH_SERVICE_URL=http://auth-service:8000` |
| VMS: Frontend warning toast | ✅ Done | Amber toast when logged in via local fallback |
| Run auth-service migration (`makemigrations` / `migrate`) | ✅ Done | Migrations 0004 + 0005 applied |
| Grant VMS access to employees via `grant-vms-access` | ✅ Done | IAK-0002 (Noman) set up as receptionist for testing |
| E2E test: login-vms + employee fetch | ✅ Done | Playwright — 9 scenarios verified incl. fallback + 503 |

---

## Change History

### 2026-05-21 — HDMS Production Bug Fixes

All fixes committed to `HDMS` repo (`main` branch). CI/CD triggered automatically.

**Login broken (`JSON.parse` error):**
- `next.config.ts` hardcoded `http://auth_service:8000` when `DOCKER_ENV=true`. Container not in HDMS Docker network (auth-service is external at `hrms.idaraalkhair.sbs`). Next.js proxy → connection refused → HTML error page returned → `JSON.parse` failed in browser.
- Fix: `AUTH_SERVICE_INTERNAL_URL=https://hrms.idaraalkhair.sbs` added to `docker-compose.yml` frontend env. `next.config.ts` reads this var first.

**WebSocket connecting to `ws://localhost` on live site:**
- No `.dockerignore` → `.env.local` (`NEXT_PUBLIC_WS_URL=ws://localhost:8003/ws`) was copied into Docker build context. Next.js bakes `NEXT_PUBLIC_*` at build time → `localhost` inlined into production JS bundle.
- Fix: Created `services/frontend-service/.dockerignore`. Added `ARG/ENV NEXT_PUBLIC_WS_URL` to Dockerfile builder stage. Passed `wss://hdms.idaraalkhair.sbs/ws` as build arg in `docker-compose.yml`.

**Multiple 404s on `/api/institutions`, `/api/branches`, `/api/departments`, `/api/designations`:**
- Auth-service mounts employees router at `/api/employees/` prefix. Frontend called paths without this prefix.
- Fix: `branchService.ts`, `institutionService.ts`, `EmployeeForm.tsx` — all paths corrected to `/api/employees/*`.

**Notification 422 (`user_id` field required):**
- All communication-service notification endpoints require `?user_id=` query param. `notificationService` never passed it.
- Fix: `notificationService.ts` — added `userId` param to `getNotifications`, `getUnreadCount`, `markAllAsRead`, `deleteAllNotifications`. `useNotifications.ts` — reads `user.id` from Zustand `authStore`, guards all calls when user not yet loaded.

**CI/CD optimisation:**
- Replaced `docker compose build --no-cache` (full rebuild every push) with selective builds using `git diff`. Only changed service rebuilds. Docker layer cache used. `shared/` changes → restart only (volume-mounted).
- File: `HDMS/.github/workflows/deploy.yml`

---

### 2026-05-16 — Staging deployment live on VM (10.0.8.135)

**Infrastructure:**
- Single edge nginx added (`erp_new/nginx/`) — replaced per-service nginx. Routes `hrms.*`, `hdms.*`, `vms.*` by Host header. HAProxy → VM:80 → edge nginx → containers.
- All backend ports changed `ports:` → `expose:` — host ports closed. Only port 80 exposed via edge-nginx.
- Admin panels restricted to `10.0.0.0/8` (LAN only) in nginx conf.
- `docker-compose.infra.yml` updated — edge-nginx service added.
- `erp_new/nginx/conf.d/default.conf` added — localhost dev routing (all admins + HDMS frontend accessible at localhost).

**HDMS:**
- `DOCKER_ENV=true` added to Dockerfile builder stage — Next.js now uses container names (not localhost) for API rewrites.
- Frontend env updated: `NEXT_PUBLIC_API_URL=https://hdms.idaraalkhair.sbs`, `NEXT_PUBLIC_WS_URL=wss://hdms.idaraalkhair.sbs/ws`.
- All backend `ports:` → `expose:`. `hdms-nginx` removed from compose (edge nginx takes over).
- `ENVIRONMENT=production` added to `.env` — ticket/comm/file-service now load prod settings.
- `collectstatic` run on all HDMS services (161 static files).

**Auth-service:**
- `CSRF_TRUSTED_ORIGINS` + `CORS_ALLOWED_ORIGINS` + `ALLOWED_HOSTS` — now env-driven (was hardcoded `*`).
- `employee_code` field: `null=True` added — migration `0015`. Prevents unique constraint violation for employees without assignment.
- `NEXT_PUBLIC_API_URL=https://hrms.idaraalkhair.sbs/api` added to docker-compose for auth-frontend.
- `collectstatic` run (134 files). WhiteNoise serving static in production.
- Ports changed to `expose`.

**VMS:**
- Moved from `../visitor-management-system/` → `erp_new/VMS/`.
- `version: "3.9"` removed (obsolete attribute).
- `ALLOWED_HOSTS` + `CORS_ALLOWED_ORIGINS` updated for domain.
- VMS nginx added to `erp_network`.
- `erp_new/.gitignore`: `VMS/` added (nested git repo — tracked separately).
- VMS NOT yet deployed on VM — pending.

**CI/CD:**
- GitHub Actions workflows added: `erp_new`, `HDMS`, `Auth-service`.
- SSH key generated on VM (`/root/.ssh/github_actions`). GitHub Secrets set: `VM_SSH_KEY`, `VM_HOST`, `VM_USER`.
- **Blocker:** VM port 22 not internet-accessible — GitHub Actions SSH timeout. Self-hosted runner required.
- Workflows fixed: branch `master` → `main` for HDMS + Auth-service. `collectstatic` added to deploy scripts.

**VM one-time setup done:**
- Repos cloned at `/var/www/erp_new/`
- `.env` + JWT keys manually copied
- Migrations run on all services
- Superuser created on Auth-service (VM)

**Known pending:**
- ~~Self-hosted GitHub Actions runner on VM~~ ✅ Done
- VMS deploy on VM
- Superusers for HDMS services (ticket/comm/file) on VM
- Auth-frontend rebuild on VM (NEXT_PUBLIC_API_URL fix — CI/CD will handle on next push)
- Project logs for Auth-service + HDMS not updated yet

### 2026-04-21 — E2E Verification & Integration Fixes

**Bugs found and fixed via Playwright E2E:**
- Auth-service: `VmsRole` table missing SoftDelete columns (`deleted_at`, `deleted_by`, `deletion_reason`, `created_at`, `updated_at`). Migration `0005_fix_vmsrole_softdelete_fields` adds them.
- VMS compose: nginx port 80 collided with `hdms-nginx` → moved VMS to `8080:80`.
- VMS compose: `REDIS_HOST=redis` resolved via `erp_network` to password-protected `erp_redis` (alias collision). Local redis aliased to `vms-redis`, `REDIS_HOST` updated.
- VMS `VmsLoginView`: missing `authentication_classes = []` → 500s on wrong password because DRF ran auth on the login request itself.
- VMS `frontend/lib/api.ts`: axios 401 interceptor was redirecting to `/login` during login, wiping the error toast. Now skips `/auth/login` and `/auth/refresh`.
- VMS `auth_service_client.py`: wrong paths. Auth-service mounts employees router at `/api/employees/*` with internal routes. Corrected to `/api/employees/employees`, `/api/employees/departments`, `/api/employees/designations`; also parse `"employees"` key in paginated response.

**E2E scenarios verified (Playwright headless):**
- ✅ Happy-path login via auth-service (JWT minted, `auth_source=auth_service`, dashboard renders)
- ✅ Wrong password → 401 + error toast
- ✅ Unknown user → 401
- ✅ Empty form: submit disabled
- ✅ Auth-service down → local fallback login succeeds, `auth_source=local_fallback`, amber warning visible on page
- ✅ Auth-service token accepted by protected endpoint
- ✅ Request without token → 403
- ✅ Redis cache serves employees while auth-service is stopped (cold cache returns 503)
- ✅ Employees (5) + Departments (1) fetched live from auth-service via VMS proxy

**Commits:**
- `66198f6` — fix(permissions): add SoftDelete columns to VmsRole (migration 0005)
- `760312f` — fix(vms): E2E integration bugs surfaced by Playwright tests

### 2026-04-20 — VMS Auth-Service Integration (Phase 1 & 2)

**Auth-Service changes** (`erp_new/Auth-service/Backend`):
- `permissions/models.py`: Added `Service` model (dynamic service registry), `VmsRole` model (admin/receptionist/security_staff), removed hardcoded `SERVICE_CHOICES` from `ServiceAccess`
- `permissions/migrations/0004_service_vmsrole_dynamic_service_field.py`: Creates Service table, seeds sis/hdms/vms, creates VmsRole table
- `authentication/api.py`: Added `POST /api/auth/login-vms` endpoint
- `permissions/api.py`: Added grant-vms-access, vms-access/{id}, vms-role, vms-users endpoints; `check/{service}` now dynamically validates against Service table
- `permissions/utils.py`: Added `get_vms_role()`, updated `get_employee_permissions()` for VMS
- Git commit: `b5c32c9` — feat(auth): add VMS service support with dynamic service registry

**VMS changes** (`visitor-management-system/`):
- `backend/visitors/auth_service_client.py` [NEW]: HTTP client — login_vms, verify_token, get_employees, get_departments, get_designations, get_employee. All with Redis 5-min cache + AuthServiceUnavailable exception
- `backend/visitors/authentication.py` [NEW]: `VmsHybridAuthentication` DRF class — detects token type via `employee_code` claim, validates auth-service tokens via /me (Redis cached), local tokens via Simple JWT
- `backend/visitors/views.py`: Added `VmsLoginView` (proxy + fallback), `VmsTokenRefreshView`; updated employee/dept views to fetch from auth-service
- `backend/config/urls.py`: Replaced `TokenObtainPairView` with `VmsLoginView`
- `backend/config/settings.py`: `VmsHybridAuthentication` as DEFAULT_AUTHENTICATION_CLASS, Redis CACHES config, `AUTH_SERVICE_URL`, `AUTH_SERVICE_TIMEOUT`
- `backend/requirements.txt`: Added `requests==2.32.3`
- `docker-compose.yml`: backend joins `erp_network`, `AUTH_SERVICE_URL=http://auth-service:8000`
- `frontend/lib/api.ts`: Handles both `access_token` (auth-service) and `access` (Simple JWT) formats
- `frontend/app/login/page.tsx`: Shows amber warning toast when `data.warning` present
- Directory renamed: `visitor-managment-system` → `visitor-management-system` (typo fix)
- Git commit: `158b45c` — feat(vms): integrate auth-service for SSO and live HR data

---

## Pending Actions (Manual Steps Required)

```bash
# 1. Ensure erp_network exists
docker network create erp_network   # skip if already exists

# 2. Run auth-service migration (inside container or locally)
cd erp_new/Auth-service/Backend
python manage.py migrate permissions 0004_service_vmsrole_dynamic_service_field

# 3. Rebuild + restart containers
cd erp_new/Auth-service
docker compose up --build -d

cd visitor-management-system
docker compose up --build -d

# 4. Grant VMS access to employees
# POST http://auth-service:8000/api/permissions/grant-vms-access
# { "employee_id": "IAK-0001", "password": "Pass123", "role": "receptionist", "change_password": true }
```
