# PROJECT_LOG.md — Auth-Service Change Log

> Single source of truth for all changes. Update immediately after every change, then commit.

---

## Change History

### 2026-06-17 — RBAC M4: Enforce Permissions on All API Endpoints

**Feature:** Every non-RBAC endpoint now enforces RBAC. Unauthenticated → 401. Missing permission → 403.

**Core enforcement (`permissions/rbac.py`, `employees/api.py`, `permissions/api.py`, `audit/api.py`):**
- `require_permission(codename)` decorator — raises `HttpError(403)`, SuperAdmin bypasses.
- `employees/api.py` — router-level `AuthBearer` + `@require_permission` on all 29 endpoints.
- `permissions/api.py` — router-level `AuthBearer` + `@require_permission` on 12 non-RBAC endpoints.
- `audit/api.py` — router-level `AuthBearer` + `@require_permission("audit.view")`.

**Codename mapping:**
- `organization.view`, `institution.*`, `branch.*`, `department.*`, `designation.*` — org hierarchy
- `employee.view/create/edit/delete`, `assignment.create/edit/delete` — employee management
- `service_access.view/grant/toggle` — service provisioning
- `audit.view` — audit logs

**Bug fixes (post-deployment testing):**
- `core/settings.py` — `CORS_ALLOW_HEADERS = ['*']` → explicit list including `Authorization`. Firefox blocks `*` wildcard for credentialed requests per Fetch spec.
- `permissions/signals.py` + `permissions/apps.py` — `m2m_changed` signal on `Role.permissions`: auto-clears Redis cache for all affected employees when role permissions change via Django admin or any ORM call. Previously only API-level changes cleared cache.
- `rbac_api.py` — `POST /overrides` returns 409 if DENY override targets a permission already granted by employee's role. Accepts `force=true` to bypass. Frontend shows confirm dialog on 409.
- `frontend/Dockerfile` — `NEXT_PUBLIC_API_URL` as build ARG (overridable). Previously hardcoded prod URL.
- `docker-compose.dev.yml` — auth-frontend now starts via Docker with `ports: 3005:3000` and `NEXT_PUBLIC_API_URL=http://localhost:8000/api`. Single `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d` starts both services.

**Tests:** 43/43 pass. `python manage.py check` clean.

**Known gaps (M5 backlog):**
- Frontend pages show white screen on 403 — no "Access Denied" UI
- `pytest` not in `requirements.txt` — tests can't run inside Docker container
- `employee.view` missing from `seed_permissions` command (added manually to roles)

**Branch:** `feat/rbac-m4-enforcement`
**PR:** #3 — https://github.com/fun33333/Auth-service/pull/3
**Commits:** `806ef3a` → `88dcf22` → `4a58ae6` → `fd9d671` → `94c9b11`

---

### 2026-06-16 — RBAC M3 Frontend: Auth Subsystem Tab + Role Management UI

**Feature:** Admin-facing UI for RBAC — roles, employee assignments, and per-employee permission overrides. No more developer involvement for runtime role changes.

**Backend additions (`permissions/rbac_api.py`):**
- `GET /api/permissions/rbac/permissions?service=` — list all permissions, filterable by service
- `GET /api/permissions/rbac/roles/{role_id}` — role detail with `permission_codenames[]`
- `GET /api/permissions/rbac/employee-roles?employee_id=` — list assignments, filterable by employee
- `GET /api/permissions/rbac/roles?service=` — updated existing endpoint to accept service filter

**Frontend additions:**

- `frontend/src/services/rbacService.ts` (new) — typed API client wrapping `fetchWithAuth` for all 12 RBAC operations (listPermissions, listRoles, getRole, createRole, updateRole, deleteRole, listEmployeeRoles, assignRole, removeRoleAssignment, createOverride, removeOverride, getEffectivePermissions).

- `frontend/src/app/service/page.tsx` — major extension:
  - **Auth tab** added alongside HDMS/VMS tabs. Shows employee-role assignment table.
  - **RoleManagementPanel** — create/edit/delete auth roles with permission checkbox modal.
  - **Dynamic role dropdown** in provision modal — fetches from API for auth service; HDMS/VMS remain hardcoded. Password section hidden for auth (no credentials needed).
  - **OverridesPanel** — per-employee expandable panel; ALLOW/DENY individual permissions inline.

**Security fixes (post-testing):**
- `AssignRoleIn.employee_id` changed from `uuid.UUID` to `str` — frontend sends varchar employee code (e.g. `IAK-0001`), not UUID. Consistent with HDMS/VMS grant endpoints.
- `SuperAdminBearer` added to RBAC router — all 12 RBAC management endpoints now require superadmin JWT. Regular employees get 401.
- 5 security tests added confirming employee + unauthenticated access is blocked.

**Tests:** 43/43 pass. TypeScript: 0 errors.

**Acceptance criteria:**
- [x] A: Auth tab visible on `/service` page alongside HDMS/VMS
- [x] B: Admin can create/edit/delete roles with permission checkboxes — no code deployment
- [x] C: Provision modal role dropdown is API-driven for auth service; role assignment posts correctly
- [x] D: Per-employee overrides panel functional (add ALLOW/DENY, remove)

**Known gaps (M4 backlog):**
- RBAC permissions not enforced on non-RBAC endpoints (`/api/employees/*`, `/api/departments/*`, etc.) — any authenticated employee can call them
- Missing edge case tests (duplicate assignment 400, nonexistent employee 404, etc.)

**Branch:** `feat/rbac-m3-frontend`
**Commits:** `2048ade` → `5630a9e` → `d332b09` → `16d4ec1` → `404c357` → `398b074` → `d4ebffe` → `15f75a2`

---

### 2026-06-15 — RBAC M2 Backend API & Permission Engine

**Feature:** Permission engine, decorator, and 9 RBAC management API endpoints.

**Files added:**
- `permissions/rbac.py` — `get_effective_permissions`, `has_permission`, `clear_permission_cache`. Redis cache 5-min TTL. Formula: (role perms ∪ allowed overrides) − denied overrides.
- `permissions/decorators.py` — `@require_permission(codename)`. Raises `HttpError(403)` if denied. SuperAdmin bypasses unconditionally.
- `permissions/rbac_api.py` — 9 endpoints at `/api/permissions/rbac/*`: roles CRUD (4), employee-role assignment (2), permission overrides (2), effective-permissions (1).
- `permissions/test_rbac_engine.py` — 31 tests covering engine, decorator, all API endpoints.

**conftest.py:** Added `superadmin` and `superadmin_auth_client` fixtures.

**Routing:** `core/urls.py` — mounted `rbac_router` at `/api/permissions/rbac`.

**Tests:** 51/51 pass (M1 + M2 combined).

**Commits:** `06152cf` → `af23e7f` → `46e4674` → `99a14d7`

---

### 2026-06-15 — RBAC M1 Foundation

**Feature:** Dynamic RBAC system foundation — 4 new models, migrations, seed command, admin registration.

**Models added (`permissions/models.py`):**
- `Permission` — plain model, codename/name/service. Engineering-defined via seed command.
- `Role` (SoftDeleteModel) — named permission bundle per service. M2M to Permission.
- `EmployeeRole` (SoftDeleteModel) — assigns a role to an employee. GenericFK scope fields (null = global, Phase 2 will fill for branch/institution scoping).
- `EmployeePermissionOverride` (SoftDeleteModel) — per-employee grant or block overriding role defaults.

**Migrations:** `0007_rbac_permission`, `0008_rbac_role`, `0009_rbac_employee_role_and_override` — all apply clean.

**Management command:** `permissions/management/commands/seed_permissions.py` — 30 permissions covering all existing API endpoints. Idempotent (safe to re-run).

**Admin:** `PermissionAdmin`, `RoleAdmin`, `EmployeeRoleAdmin`, `EmployeePermissionOverrideAdmin` registered in `permissions/admin.py`.

**Tests:** `permissions/test_rbac_foundation.py` — 20 tests. All pass.

**Commits:** `3e16894` (models) → `c0a516a` (seed command) → `6c79e7c` (admin)

**Note:** 10 pre-existing errors in `permissions/tests.py` (`dept_sector` fixture) — not caused by M1 changes.

---

### 2026-06-06 — Remove redundant `branch` FK from `EmployeeAssignment`

**Problem:** `EmployeeAssignment.branch` FK was a second source of truth. `designation → department → branch` already provides the branch. Two stored values could silently diverge (impossible assignments).

**Changes:**
- `employees/models.py`: Removed `branch` FK from `EmployeeAssignment`. `save()` and `__str__()` now derive branch via `self.designation.department.branch`. `Institution.employee_count()` updated to filter via `department__branch__institution`.
- `employees/admin.py`: Replaced `branch` in `list_display` with `branch_display` method. Removed `branch` from `list_filter` and `AssignmentInline.fields`.
- `employees/api.py`: Updated `_assignment_institution()`, `_assignment_response()`, `create_assignment()`, `update_assignment()`, `create_employee()`, `update_employee()`, and both `prefetch_related` calls. Removed `branch_code` from `EmployeeAssignmentCreateSchema`, `EmployeeAssignmentUpdateSchema`, and `EmployeeUpdateSchema`.
- `migrations/0018_remove_employeeassignment_branch.py`: Drops the column.

**Tests:** `employees/tests_assignment_branch.py` — 11 tests (7 unit + 4 integration). All green.

**Commit:** `b071cd1`

---

## Feature Roadmap

| Feature | Status | Notes |
|---------|--------|-------|
| JWT login + refresh | Done | `authentication/api.py`, `jwt_utils.py` (access 1h, refresh 7d) |
| HDMS service gating | Done | `login-hdms` endpoint + `HdmsRole` model |
| VMS service gating | Done | `b5c32c9` — dynamic service registry + `VmsRole` |
| Employee UUID lookup | Done | `05384c8` — `GET /employees/by-user/{user_id}` |
| Branch support on employees | Done | `9c38bc4` — Branch import fix, designation POST restored |
| Unified Docker compose | Done | `docker-compose.yml` at repo root, both containers on `erp_network` |
| Frontend API integration guide | Done | `FRONTEND_API_INTEGRATION_GUIDE.md` (1735 lines, per-page contract) |
| Next.js frontend pages | In progress | login, employees, institutions, branches, departments, designations, profile, audit-logs, settings scaffolded |
| Remove redundant FKs on `EmployeeAssignment` | **Planned** | See `authservice_architecture_report.md` §3 — drop `branch` + `institution`, derive via `designation.department.branch.institution` |
| OpenAPI → TS type generation | **Planned** | Exploit the monorepo layout; sync backend schemas into `frontend/src/types/` |
| Tighten CORS / ALLOWED_HOSTS for prod | **Planned** | Currently `*` — acceptable for dev, must gate before prod |
| Audit log UI wiring | **Planned** | `/api/audit/*` endpoints exist; frontend page is scaffold only |
| RBAC M1 — Foundation models | **Done** | Permission, Role, EmployeeRole, EmployeePermissionOverride + seed_permissions + admin |
| RBAC M2 — Backend enforcement | **Done** | Permission engine + @require_permission decorator + 9 RBAC API endpoints |
| RBAC M3 — Frontend gating | **Planned** | Frontend permission checks based on JWT/API response |
| Content-Types-based `Department` parent | **Future** | Replace 3 nullable FKs (org/institution/branch) with Generic FK per arch report §4 |

---

## Change History

### 2026-06-03 — SuperAdmin auth fix + logout security fix + BlacklistedToken field fix

**Bugs fixed (3):**

#### Bug 1 — `SuperAdmin` login always returned 401
**Root cause:** `SuperAdmin` model had no `is_superadmin` attribute. `getattr(user, 'is_superadmin', False)` returned `False` for every SuperAdmin instance. Login code then built `cred_filter = {'employee': superadmin_obj}` (wrong FK), causing `UserCredentials.DoesNotExist` → 401. No SuperAdmin had ever been able to log in.

**Affected endpoints:** `POST /api/auth/login`, `POST /api/auth/login-sis`, `GET /api/auth/me`

**Fix:** Added `@property is_superadmin(self) → True` to `SuperAdmin` model.

**File:** `authentication/superadmin_models.py`

---

#### Bug 2 — Logout did not revoke SuperAdmin refresh tokens (security)
**Root cause:** `logout` endpoint hard-coded `RefreshToken.objects.filter(employee=request.auth, ...)`. When `request.auth` is a `SuperAdmin`, this filters on the wrong FK — no rows matched — refresh tokens were never revoked. SuperAdmin could reuse refresh tokens after logout.

**Fix:** Dynamic filter based on user type — `{'superadmin': ...}` or `{'employee': ...}`.

**File:** `authentication/api.py` (logout endpoint)

---

#### Bug 3 — Logout crashed for all users (`BlacklistedToken.token` too short)
**Root cause:** `BlacklistedToken.token` was `CharField(max_length=500)`. RS256 JWT tokens are ~800–900 chars. DB rejected the insert → logout returned 401 → token was never blacklisted → users could reuse tokens after logout (security hole).

**Fix:** Changed field to `TextField`. Migration `authentication/0005_blacklistedtoken_token_to_textfield` applied.

**Files:** `authentication/models.py`, `authentication/migrations/0005_blacklistedtoken_token_to_textfield.py`

---

**Also present (pre-existing, already fixed in previous session):**

- `employees/migrations/0017_employee_code_nullable_revert` — reverts migration 0016 which incorrectly added NOT NULL to `employee_code` column while model kept `null=True`. Employee creation without a primary assignment would crash. Migration 0017 restores nullable. Applied ✅

**Test results:**
- SuperAdmin login → `is_superadmin: true` in token ✅
- `/me` for SuperAdmin → correct response ✅
- Logout blacklists token ✅
- Token rejected after logout (`401 Unauthorized`) ✅
- Employee save without assignment → `employee_code=NULL`, no crash ✅

---

### 2026-05-21 — Maryam UI merge + security cleanup

**Branch:** `merge-dev → main` (merge commit `7e748fd`)

**Frontend UI refresh (Maryam's work — absorbed via merge-dev):**
- `login/page.tsx` — full redesign: animated background scene (orbs, particles, grid), feature cards, mount transition. Logic unchanged (raw `fetch` to `/auth/login`, `fetchWithAuth` import correctly dropped since login needs no token).
- `page.tsx` (dashboard) — major UI rework with new color scheme (`#6B3F69`).
- `employees/page.tsx` — new card/table toggle, stats bar, filters (status/gender/employment type), delete button added (soft-delete via `DELETE /employees/{id}`).
- `employees/[id]/edit/page.tsx` — minor UI polish.
- `employees/new/page.tsx` — formatting cleanup, `register()` spreads preserved (no logic change).
- `institutions/page.tsx` — inline modal edit replaces route-based edit. 3 separate route pages deleted: `institutions/[id]/edit`, `institutions/[id]/page`, `institutions/new` — functionality moved into `InstitutionModal` inside the list page.
- `designations/page.tsx` — UI refresh.
- `profile/page.tsx` — UI refresh.
- `ProtectedLayout.tsx` — sidebar color `indigo` → `#6B3F69`, user avatar section now a `<Link>` to `/profile`, `isProfileOpen` state removed.
- `layout.tsx` — minor changes.
- `globals.css` — minor additions.
- `branches/page.tsx`, `departments/page.tsx` — minor UI tweaks.

**New dependencies:**
- `framer-motion ^12.38.0`, `react-hot-toast ^2.6.0` — required by UI updates. Lock file committed.

**Backend — additive only (no breaking change):**
- `Backend/src/employees/api.py` — `gender` field added to `list_employees` response dict. Additive; HDMS unaffected.
- `Backend/.env.example` — deleted (was outdated).

**New infra/scripts (non-breaking):**
- `docker-compose.infra.yml` — shared ERP infrastructure compose (postgres, pgbouncer, redis).
- `config/pgbouncer/entrypoint.sh`, `config/postgres/postgresql.conf` — infra config files.
- `scripts/init-erp-dbs.sh`, `scripts/init-md5-password.sh` — DB init helpers.
- `verify_sso.py`, `verify_sso_deep.py` — SSO debug/verification scripts.
- `frontend/.dockerignore` — added.

**Bugfix:**
- `employees/page.tsx` delete confirmation: "cannot be undone" → "archive... can be restored by admin" — backend always soft-deletes (`is_deleted=True`), old wording was misleading.

**Security:**
- `.env`, `config/jwt_private.pem`, `config/jwt_public.pem`, `config/pgbouncer/pgbouncer.ini`, `config/pgbouncer/userlist.txt` — accidentally committed in merge-dev, removed before merge to main. None of these reached main history.
- `.gitignore` merge conflict resolved. Added explicit rules: `config/pgbouncer/userlist.txt`, `config/pgbouncer/pgbouncer.ini` (`.env` and `*.pem` were already covered).

> ⚠️ **Action needed:** JWT keys committed in merge-dev history (not main). If those are real production keys, rotate them.

**E2E verified (Playwright):**
- Dashboard loads, employees page loads with new UI ✅
- Delete confirmation dialog shows correct archive wording ✅

---

### 2026-05-16 — Staging hardening + production deploy

- `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` — all env-driven. Was hardcoded `*` before.
- `employee_code` model: added `null=True` — migration `0015`. Fix: unique constraint crash when adding employee without assignment.
- `NEXT_PUBLIC_API_URL=https://hrms.idaraalkhair.sbs/api` — auth-frontend compose env. Fixes CORS error (was falling back to `http://127.0.0.1:8000`).
- `docker-compose.yml`: ports → expose. Auth-service no longer exposed on host.
- WhiteNoise confirmed working for static files in production (`DEBUG=False`). Collectstatic: 134 files.
- `CSRF_TRUSTED_ORIGINS` fix: Django admin login was 403 — domain not in trusted origins.
- GitHub Actions deploy workflow added (`.github/workflows/deploy.yml`). Blocker: self-hosted runner needed (VM port 22 not internet-accessible).
- VM deployed at `/var/www/erp_new/Auth-service/`. Migrations applied. Superuser created.

### 2026-04-27 (Validation hardening + masked inputs + assignment endpoints + E2E verification)

**Scope:** Multi-part forms+API hardening pass across employees/institutions/branches.

**Backend (`employees/api.py`):**
- Added `EmployeeCreateSchema` / `EmployeeUpdateSchema` validators:
  - `dob` — must be `YYYY-MM-DD`, employee min age 13 years
  - `gender` — restricted to `['male','female']` (no "other")
  - `maritalStatus`, `shift`, `employmentType`, `branch.status`, `institution.inst_type` — enum-bounded
- `shift` choices kept aligned with model (`general/morning/afternoon/night/hourly/both`) — wrong values would break `employee_code` generation (`shift[0].upper()`).
- Added `EmployeeUpdateSchema.isActive` + `employmentType` handling in `update_employee`.
- Added dedicated `EmployeeAssignment` endpoints (POST/PUT/DELETE) with `_assignment_response()` helper.
- Fixed silent DOB default — now returns 400 + `field_errors`.
- Fixed `joining_date` NOT NULL violation in assignment create — defaults to `date.today()` when omitted (commit `f95666f`).

**Frontend:**
- New components: `PhoneInput.tsx` (max 11 digits, auto-dash after 4: `XXXX-XXXXXXX`), `CNICInput.tsx` (13 digits, `XXXXX-XXXXXXX-X`).
- Wired via `Controller` into: `employees/new`, `employees/[id]/edit`, `branches`, `institutions/new`, `institutions/[id]/edit`.
- Removed gender "other" option everywhere.
- Edit form pre-populates `isActive`, exposes toggle in placement step.
- `shift` options match model exactly across all frontend forms.

**E2E (Playwright):** Employee list loads, CNIC + phone masking work, gender "other" rejected, DOB <13 rejected by backend, assignment POST/PUT/DELETE all pass after `joining_date` fix, isActive toggle visible + pre-populated, shift "evening" rejected.

**Pending:** DOB age validation in frontend zod schema (currently only backend catches under-13).

**Commits:** `57111e4`, `f95666f`.

---

### 2026-04-25 (Bugfix — employee list empty on frontend)

**Bug:** `GET /api/employees/employees` returned `{ employees: [], total: 0, error: "..." }` — frontend showed empty list.

**Root cause:** `list_employees` in `employees/api.py:896` had `prefetch_related('assignments__institution')`. `EmployeeAssignment.institution` FK was removed in P1 cleanup (commit `14b44ac`) — Django rejected the invalid prefetch path at query time, the except block caught it and returned an empty list.

**Fix:** Replaced invalid prefetch with the correct traversal chain that `_assignment_institution()` actually uses:
- `assignments__branch__institution`
- `assignments__department__institution`

**File:** `Backend/src/employees/api.py:896`

---

### 2026-04-24 (Bugfix — stale container image after P6/P7 model cleanup)

**Bug:** `ProgrammingError: column employees_employee.state does not exist` on admin Employee change/save.

**Root cause:** P6/P7 commit (`db7ed7a`) removed `state` from `Employee` model and generated migration `0014` to drop the column. Migration ran fine. But container image was never rebuilt — old image still had `state` in models.py. ORM generated SQL selecting `state` → PostgreSQL rejected it (column already dropped).

**Fix:** `docker compose build auth-service && docker compose up -d auth-service` — container now runs latest code, model and DB in sync.

**Lesson:** After any model field removal, container must be rebuilt, not just migrated.

---

### 2026-04-24 (Bugfix — stale field references after P1-P5 model cleanup)

**Bugs found via post-cleanup audit:**

1. **`employees/api.py` — `get_institution` + `update_institution` (`AttributeError` at runtime)**
   - Both response dicts accessed `inst.inst_id` and `inst.extra_data` — both removed from `Institution` in P4 cleanup (`ee110da`).
   - `InstitutionSchema` already had these fields stripped; only the response builders were missed.
   - Fixed: removed `inst_id` and `extra_data` keys from both response dicts (lines ~355, ~401).

2. **`employees/admin.py` — `AssignmentInline.fields` (over-corrected in initial fix)**
   - Original fix removed `branch` from the inline fields, but `EmployeeAssignment.branch` FK still exists on the model.
   - Only `institution` was removed (P1 commit `14b44ac`).
   - Fixed: fields now `['branch', 'department', 'designation', 'joining_date', 'shift', 'is_primary', 'is_active']`.

**Migration scripts** (`enrich_campus_timestamps.py`, `migrate_campuses_to_branches.py`, `migrate_employees.py`, `run_full_migration.py`) also reference `legacy_campus_id` / `domain_data` on `Branch` — these are one-time historical scripts, already executed, not called at runtime. Left as-is.

---

### 2026-04-24 (Bugfix — Django admin FieldError on EmployeeAssignment change view)

**Bug:** `FieldError: Unknown field(s) (institution) specified for EmployeeAssignment` when opening any employee record in `/auth-admin/`.

**Root cause:** `AssignmentInline.fields` in `employees/admin.py:83` still listed `branch` and `institution`, both of which were removed from `EmployeeAssignment` model in the P2-P5 data model cleanup (commit `ee110da`). Admin tried to render a non-existent field → Django threw `FieldError` at change_view time.

**Fix:** Removed `branch` + `institution` from `AssignmentInline.fields`. Fields now: `['designation', 'joining_date', 'shift', 'is_primary', 'is_active']` — matches actual model shape.

**File:** `Backend/src/employees/admin.py:83`

---

### 2026-04-22 (Phase 2 — CRUD forms rebuild: branches / departments / designations / institutions)

**Frontend — rhf+zod rewrites:**
- `frontend/src/app/branches/page.tsx` — modal rebuilt with `react-hook-form` + `zod`. Inline per-field errors, backend `field_errors` surfacing, PK phone + email regex validation. Delete uses `branch_code` as key (soft-delete, recoverable).
- `frontend/src/app/departments/page.tsx` — same treatment. `dept_code` locked on edit (server-side immutable). Regex validator (`^[A-Za-z0-9]+$`, ≤6 chars) enforces alphanumeric client-side before POST fires.
- `frontend/src/app/designations/page.tsx` — same treatment. `position_code` + `department_code` locked on edit.
- `frontend/src/app/institutions/new/page.tsx` — full rewrite (standalone route) with rhf+zod, org pill-picker, PK phone validation.
- `frontend/src/app/institutions/[id]/edit/page.tsx` — full rewrite with `reset()` pre-populate on GET.

**Backend — `Backend/src/employees/api.py`:**
- **Critical fix:** `payload: dict` in Django Ninja routes is treated as a **query** param, not body — causing 422 "Field required" on every JSON POST. Fixed by switching to `payload: Body[dict]` (ninja.Body) on `create_institution`, `update_institution`, `create_branch`, `update_branch`. This bug was silent until the frontend started actually sending JSON bodies from rhf forms. `from ninja import ... Body` added to imports.
- **New endpoints:** `PUT /branches/{branch_key}` + `DELETE /branches/{branch_key}` (soft-delete). Key accepts `branch_id` OR `branch_code` via `Q()` — frontend list passes `branch_code`. Previously frontend was calling these routes and silently 404ing.
- **Fix:** `DesignationUpdateSchema` fields were typed `str = None` — Pydantic v2 rejects `null` for non-`Optional` fields, causing 422 on PUT. Changed to `Optional[str] = None`.

**Verified end-to-end with Playwright (spec: `docs/superpowers/specs/2026-04-22-crud-forms-e2e-test-plan.md`):**

| Entity | Create | Edit | Validation |
|--------|--------|------|------------|
| Branch | ✅ 201 | ✅ PUT 200 | ✅ 3 inline errors, no POST |
| Department | ✅ 201 | ✅ PUT 200 | ✅ regex error on `AB$`, no POST |
| Designation | ✅ 201 | ✅ PUT 200 | ✅ 3 inline errors, no POST |
| Institution | ✅ 201 → redirect | ✅ PUT 200 → redirect | ✅ phone error on `12345`, no POST |

12/12 checks pass.

### 2026-04-21 (Phase 2 kickoff — Employee create + edit: rebuild + E2E verified)

**Frontend — full rewrites with `react-hook-form` + `zod`:**
- `frontend/src/app/employees/new/page.tsx` — rebuilt from 544 lines (formData + setState bloat) to a clean rhf+zod multi-step form. 4 steps (Identity / Contact / Placement / History). Client-side validators mirror backend Pydantic: CNIC `^\d{5}-?\d{7}-?\d{1}$`, PK mobile, email. Cascading dropdowns (institution→branch, department→designation) with useEffect+watch. Inline field errors. Backend `field_errors` map surfaced per field. Robust error fallback handles Ninja's default `{detail:[{type,loc,msg}]}` shape so React can't crash on bad responses.
- `frontend/src/app/employees/[id]/edit/page.tsx` — same pattern + `reset()` on GET response to pre-populate. Uses `primary` assignment for placement pre-selection.
- Installed: `react-hook-form`, `zod`, `@hookform/resolvers`.

**Backend — `Backend/src/employees/api.py`:**
- `POST /employees`: signature `Form(...) + File(...)` → plain JSON body (`payload: EmployeeCreateSchema`). Frontend was sending JSON, backend was expecting multipart — produced 422 on every submit. Resume upload deferred to a future separate endpoint.
- `GET /employees/{employee_id}`: now accepts **either** `employee_id` (e.g. `IAK-0001`) **or** `employee_code` (e.g. `AIT01-G-26-T-0006`) via `Q(employee_id=...) | Q(employee_code=...)`. Frontend list passes `employee_code`; old endpoint only matched `employee_id`. Same change applied to `PUT` and `DELETE /employees/{employee_id}`.
- `GET /employees/{id}` response: assignments now include `institution_code`, `branch_code`, `department_code`, `designation_code` alongside names. Edit form needs codes to pre-select dropdowns.
- `GET /employees/{id}` response: added raw enum values `gender`, `marital_status`, `employment_type` alongside `*_display` labels. Edit form binds raw values to `<select>`.
- `POST /employees` + `PUT /employees/{id}`: empty string `""` → `None` for `org_email`, `org_phone`, `personal_email` before save. `Employee.org_email` has `unique=True, blank=True, null=True` — two records with `org_email=""` collide on the unique index. Fix preserves NULL-as-absent semantics.

**Backend — schema correction (from arch report heads-up, deferred for now):**
- `EmployeeAssignment.institution` and `.branch` FKs remain (documented tech debt). **Not removed this sprint** — in-use by `create_employee` (line ~649) and `get_employee` (line ~859). Full denormalization removal planned as Phase 1.5 with a data-integrity pre-check (count impossible assignments where stored `branch` disagrees with `designation.department.branch`).

**Verified end-to-end with Playwright:**
- Login → fill create form (Identity/Contact/Placement) → submit → **201** → redirect to `/employees`.
- Open edit → form pre-populated from GET → edit name → save → **PUT 200** → redirect to `/employees`.
- Cascade: Institution "IT Institute" → Branch dropdown populated "Alkhair Institute of Technology"; Department "Academic" → Designation "Teacher". Working as designed.

### 2026-04-21 (Phase 1 — Broken POST/PUT URLs + backend PUT /employees)

**Frontend URL fixes (5 files):**
- `employees/new/page.tsx:127` — `/branches?institution_code=...` → `/employees/branches?institution_code=...` (was missing the router prefix; dependent dropdown for branch selection was broken).
- `employees/new/page.tsx:232` — success redirect `/employees/employees` → `/employees` (double-prefix was a frontend route, not an API path).
- `employees/[id]/edit/page.tsx:198` — `` `employees/designations?...` `` → `` `/employees/designations?...` `` (missing leading slash meant relative URL).
- `employees/[id]/edit/page.tsx:257` — `` `employees/employees/${id}` `` → `` `/employees/${id}` `` (wrong path; now matches new backend `PUT /employees/{employee_id}`).
- `institutions/[id]/edit/page.tsx:53,104` + `institutions/[id]/page.tsx:35,59` — removed trailing slashes; standardized with rest of codebase (Django was 301-redirecting).
- `institutions/[id]/edit/page.tsx:111` + `institutions/[id]/page.tsx:61` — success redirect `/employees/institutions` → `/institutions` (wrong route).

**Backend — new endpoint:**
- `Backend/src/employees/api.py` — added `PUT /employees/{employee_id}` (`EmployeeUpdateSchema` + `update_employee`). All fields optional; CNIC uniqueness check excludes self; primary `EmployeeAssignment` updated in place if any assignment FK is provided; same Pydantic validators as create (CNIC, phone, email formats). Returns 400 with `field_errors` map for inline surfacing.

**Removed:**
- `frontend/src/app/settings/page.tsx` — deleted. Page was UI-only (buttons not wired), no API. Not linked from nav. User requested removal.

### 2026-04-21 (Soft-delete rule confirmed + saved to memory)
- Verified all DELETE endpoints in `Backend/src/employees/api.py` soft-delete (`is_deleted=True`). `SoftDeleteModel` in `employees/utils.py` provides `soft_delete()`, `restore()`, and a loud `hard_delete()` escape hatch. Only hard-deletes in codebase: `RefreshToken.cleanup_expired` (expired-token maintenance) and `scripts/test_auth_system.py` (test fixture reset) — both acceptable.
- Saved as durable user rule in `~/.claude/projects/.../memory/feedback_soft_delete.md`.

### 2026-04-21 (Claude Code init)
- **`CLAUDE.md`** (new) — Root assistant guide modelled on `HDMS/CLAUDE.md`. Documents role/tone, service-monorepo layout, backend + frontend dev commands, Django Ninja API surface, employee hierarchy, auth/JWT flow, and cross-project links to HDMS. Flags known gotchas: `/api/employees/employees` double-prefix (intentional), `CORS_ALLOW_ALL_ORIGINS` not prod-safe, `EmployeeAssignment` denormalization risk.
- **`PROJECT_LOG.md`** (new) — This file. Seeded Feature Roadmap from recent commits (VMS support, UUID lookup, Branch fix) and planned work from `authservice_architecture_report.md`.
- **Pointers:** `FRONTEND_API_INTEGRATION_GUIDE.md` designated as canonical frontend↔backend contract; `authservice_architecture_report.md` as the hierarchy audit reference.

### 2026-04-21 (Git sync — intern's work merged)
- **Fix:** Local `maryam` branch was tracking `origin/main` instead of `origin/maryam` — intern's commit `183c7af` (work-in-progress fixes) was never pulling. Merged `origin/maryam` into local `maryam` (non-fast-forward, merge commit `9d979bd`), preserving local commits `b5c32c9` (VMS) and `05384c8` (UUID lookup). Upstream reset to `origin/maryam`.

### 2026-04-16 to 2026-04-20 (pre-log commits — reconstructed from `git log`)
- `b5c32c9` — **feat(auth):** VMS service support added via dynamic service registry. `permissions.VmsRole` model + registration mirrors the HDMS pattern.
- `05384c8` — **feat:** `GET /api/employees/by-user/{user_id}` endpoint added for UUID-based employee lookup (needed by HDMS ticket-service to resolve requestor names from `user_uuid`).
- `9c38bc4` — **fix (backend, 3):** (1) missing `Branch` import that was crashing all branch endpoints, (2) removed duplicate `create_employee` route (kept the one with Branch support), (3) restored missing `POST /designations` endpoint.
- `19d5327` — **docs:** initial `FRONTEND_API_INTEGRATION_GUIDE.md` published for the frontend intern.
- `c006d84` — **feat:** unified auth-service deployment via root `docker-compose.yml`, added frontend `Dockerfile`, updated user authentication API response shape.

---

## Known Issues / Tech Debt

- **`EmployeeAssignment` carries redundant `branch` + `institution` FKs** — can produce "Impossible Assignments" where the assignment's branch disagrees with `designation.department.branch`. Fix: drop the fields, derive on read. (`authservice_architecture_report.md` §3)
- **`Department` uses 3 nullable FKs for parent** (org / institution / branch) — brittle at scale. Fix: Django Content Types / Generic FK. (§4)
- **`domain_data = JSONField()` used for structural schema extensions** (school vs hospital) — hurts query perf. Fix: Multi-Table Inheritance. (§4)
- **`CORS_ALLOW_ALL_ORIGINS = True` and `ALLOWED_HOSTS = ['*']`** in `core/settings.py` — must tighten before any prod deploy.
- **Migrations run with `--fake-initial`** in the Docker CMD — safe on fresh DBs with existing schema, but can hide migration graph issues. Watch when renaming models.
