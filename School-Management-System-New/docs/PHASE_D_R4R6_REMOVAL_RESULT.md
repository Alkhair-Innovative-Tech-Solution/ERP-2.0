# Phase D-R4/R5/R6 — Retire Legacy Auth (HS256 + auth-8001): Result

Final phase of the SMS→central-auth repoint. One-way-door: HS256 verification
code is deleted, auth-8001's Postgres volume is dropped, and its container is
removed from `docker-compose.yml`. Verify-before-delete discipline applied
throughout — every destructive step was preceded by a check, and every code
change was rebuilt, redeployed, and proven with a real central-auth login
before moving to the next step.

## R4 — Remove legacy HS256 verification, service by service

All 13 SMS services' `dual_auth.py` now delegate straight to
`CentralAuthAuthentication` (RS256/JWKS) — the `alg`-header routing to
`ams_shared.jwt.validator.ServiceJWTAuthentication` (HS256) is gone:

- **11 "plain pattern" services** (attendance, campus, content, fees,
  notification, result, student, subject, support, timetable, ai-service):
  `DualAuthentication.authenticate()` reduced to
  `return CentralAuthAuthentication().authenticate(request)` (ai-service
  additionally wraps the result in `AiCentralAuthUser`, unchanged from
  before — only its legacy `JWTStatelessUserAuthentication` branch was
  removed).
- **org-service / staff-service**: kept their `OrgCentralAuthUser` /
  `StaffCentralAuthUser` wrappers (needed since Phase C11/C12 — a raw
  `CentralAuthUser.is_superadmin` is a bool claim, but these services' own
  User model and every vendored role-check convention expects a callable),
  only the `alg`-header branching + `ServiceJWTAuthentication` fallback was
  removed.

Two manual-authentication fallbacks (separate from `dual_auth.py` — these
run at the Django **middleware** layer, before DRF's authentication chain,
because `OrganizationManager`/`MultiTenantUserManager` need the acting user
resolved before any queryset filters) were also found and fixed:

- `org-service/users/middleware.py`
- `staff-service/users_override/middleware.py`

Both previously did their own `alg`-header routing to
`ServiceJWTAuthentication`; both now delegate straight to their own service's
`DualAuthentication`.

A **third**, previously-unaudited HS256 path was found in
`notification-service/notifications/consumers.py` (WebSocket auth, entirely
outside the `dual_auth.py`/DRF-authentication-class system):

- `NotificationConsumer.authenticate_user()` — routed HS256 vs RS256 by
  `alg` header; now RS256/JWKS-only.
- `MonitoringConsumer.authenticate_user_local()` — **HS256-only, no RS256
  branch at all**. This meant a central-auth superadmin could never open the
  system-monitoring dashboard even before this phase (pre-existing gap, not
  introduced today). Fixed to central-auth-only, and the connect()
  admin-tier gate (`user.role in ['superadmin', 'admin']`) and `log_message`'s
  role branching were updated to `is_superadmin` (`CentralAuthUser` has no
  `.role` claim at all — same unresolvable admin-tier gap flagged throughout
  this whole project; fails closed to superadmin only).

Stale docstrings/comments describing the old dual-run routing were corrected
in `attendance-service/settings.py`, `ai-service/settings.py`,
`content-service/settings.py`.

## R5 — Retire auth-8001 itself

**Zero live traffic confirmed.** `ams_auth` auto-restarted once (Docker
Desktop's own restart earlier in this session triggered its `restart:
always` policy) and served exactly one request — a Docker healthcheck
(`GET /health/` from `127.0.0.1`) — before being stopped again. No real
application traffic reached it in this session.

**`auth_db` dumped and verified before drop.** `docs/archive/auth_db_final_dump_2026-08-08.sql`
(71K, all 19 tables). Contrary to an initial mis-parse, the real state (verified
via direct `SELECT count(*)`) is: `users_user` **0 rows**, `campus_campus`
**0 rows**, `users_organization` **1 row** — a leftover synthetic
`"R2 Verify Organization"` record from an earlier phase's incomplete cleanup,
harmless, now archived and gone — `users_role_permission` 282 rows (legacy
RBAC seed data, not user data). No real data was at risk.

**Removed:** `ams_auth` + `ams_db_auth` containers, the
`school-management-system-new_postgres_auth` Docker volume, and the
`auth-service`/`postgres-auth` blocks + `postgres_auth` volume declaration
from `docker-compose.yml`.

**Collateral breakage caught and fixed before it shipped:**
- `docker-compose.yml` had 3 more `depends_on: auth-service` blocks
  (`frontend`, `gateway`) and one `depends_on: postgres-auth` +
  `AUTH_DB_HOST/NAME/USER/PASSWORD` env block (`attendance-service`) that
  would have made `docker compose config` invalid / blocked those
  containers from starting at all. All removed.
- `attendance-service`'s `sync_master_data.py` had a `sync_staff_users()`
  step (run on every container start) that pulled staff records from
  `auth_db` — now guaranteed to fail every time. Removed, along with its
  `_auth_conn()` helper and the now-unreachable legacy branch of
  `HasAttendanceViewPermission` in `attendance/permissions.py` (a live
  per-request raw-SQL `auth_db` read, unreachable since D-R4 removed the
  only code path that could produce a non-`CentralAuthUser` there).

## R6 — Delete now-fully-dead code

**`WRITE_TO_AUTH_8001` flag and every write call site removed** (5 found in
the original D-R0 sweep, **2 more found in this phase's own sweep** that
weren't flag-gated at all — `org-service`'s `mark_overdue_invoices.py` and
`generate_recurring_invoices.py`, both run hourly via `org-cron`):
`org-service/users/serializers.py`, `users/views.py` (×3),
`users/management/commands/{mark_overdue_invoices,generate_recurring_invoices}.py`,
`staff-service/services/user_creation_service.py` (whole `_sync_user_to_auth`
method deleted), `teachers/management/commands/sync_staff_to_auth.py`,
`student-service/students/services/student_csv_import.py`. Removed the flag
from `docker-compose.yml` (3 services) and the 2 remaining hardcoded
`AUTH_SERVICE_URL: http://auth-service:8001` env vars (`org-service`,
`org-cron`).

**nginx: ~20 orphaned location blocks removed** — `/sms-admin/`,
`/health/auth/`, and the entire `/api/auth/*` block (login, profile, users,
permissions, current-user, version, sidebar-badges, and 8
password-reset/OTP routes), all pointing at `auth-service:8001`.

> **Finding: the broken-frontend-endpoint list is larger than previously
> tracked.** The working assumption going into this phase was that
> `CURRENT_USER_UPLOAD_PHOTO` was the only remaining frontend feature still
> calling an auth-8001-only endpoint. Checking `frontend/src/lib/api.ts`
> against every nginx route removed here found it isn't: the **forgot-password
> OTP flow** (send/verify/reset), the **change-password OTP flow**
> (send/verify/change), **student-direct-change-password**, and
> **`/api/users/{org-staff,switch-role,toggle-active}`** are all still called
> by the frontend and route to the same dead backend. Confirmed empirically
> (`curl` against these paths returned 502 **before** any nginx.conf edit in
> this phase) that all of this has been broken since auth-8001 was stopped in
> D-R1/R3 — removing the dead nginx config changes nothing about their
> runtime behavior, it just removes now-meaningless routing rules. This is a
> real product gap, not something this phase introduced; flagging it here
> since it wasn't previously enumerated.

**Monitoring dashboard fixed** — both the frontend's service-status grid
(`frontend/src/app/admin/monitoring/page.tsx`) and the backend's TCP-probe
list (`notification-service/notifications/consumers.py`'s
`MonitoringConsumer.MICROSERVICE_PROBES`) still listed `auth`/`auth-service:8001`.
Since that hostname no longer exists, the dashboard would have shown a
permanent false "Unhealthy" card, and the backend would have wasted a probe
attempt every 2 seconds forever. Both removed.

**Frontend build-time defaults fixed** — `docker-compose.yml`'s
`NEXT_PUBLIC_AUTH_SOURCE` default was still `legacy` (posts to auth-8001);
flipped to `central` so a fresh deployment without an explicit `.env`
override doesn't silently break login. `NEXT_PUBLIC_CENTRAL_AUTH_URL`'s
default was an empty string (would degrade to broken same-origin relative
requests under the new `central` default) — defaulted to
`http://localhost:8000` to match. This environment's own `.env` already had
both set correctly, so nothing changed here at runtime — only the
fresh-clone default.

**`microservices/auth-service/` trimmed, not deleted wholesale.** Initial
attempt deleted the entire directory; this broke Docker builds for 12 of the
other 13 services, which `COPY` `users/`, `services/`, and `utils/` out of it
at build time (same vendoring pattern as `teachers/` elsewhere in this
project) — caught immediately via build failures, restored via git, and
redone precisely: removed `Dockerfile`, `entrypoint.sh`, `manage.py`,
`requirements.txt`, the `auth_service/` Django project folder, and the
unvendored `campus/` app; kept `users/`, `services/`, `utils/` since 12
services still build from them.

**`ams_shared/jwt/` (the shared HS256 validator library) deleted** —
confirmed zero remaining imports anywhere after D-R4. This surfaced a second,
more serious latent bug (see below).

`microservices/gateway/nginx.conf` — a **separate, unused, unmounted**
duplicate nginx config (confirmed via `docker-compose.yml`: only
`nginx/nginx.conf` is ever mounted into `ams_gateway`) still has 12 `:8001`
upstream/location references. Flagged, not touched — zero live effect,
and editing dead config not referenced anywhere felt like unnecessary risk
for zero benefit.

### Two regressions caught before deploy, both self-corrected

1. **Deleting `ams_shared/jwt/` broke 10 services' Django startup**
   (`ModuleNotFoundError: No module named 'ams_shared.jwt'`). Root cause:
   `microservices/auth-service/users/middleware.py` — vendored **verbatim**
   into attendance, campus, content, fees, notification, result, student,
   subject, support, and timetable-service — still imported
   `ServiceJWTAuthentication` at module level. Only org-service's and
   staff-service's own *overriding* copies of this file had been fixed in
   R4; this shared source hadn't. Fixed the same way: delegate to
   `CentralAuthAuthentication`.

2. **That fix then crashed all 10 services differently**:
   `TypeError: 'bool' object is not callable`, from
   `users/managers.py`'s `OrganizationManager`/`MultiTenantUserManager`
   calling `user.is_superadmin()` as a method. This was a **latent** bug,
   not a new one: this vendored middleware could never successfully
   authenticate an RS256 token before (it only ever tried HS256), so
   `get_current_user()` was always `None` for a central-auth request and
   this code path was never actually exercised end-to-end until R4 made
   central auth the only path. Fixed with the same `_BoolCallable` wrapper
   pattern established in Phase C11/C12 (`OrgCentralAuthUser`/
   `StaffCentralAuthUser`) — added directly to the vendored
   `users/middleware.py` (`_VendoredCentralAuthUser`), so it propagates to
   all 10 services that copy this file at build time.

Both were caught via full rebuild + redeploy + a real central-auth login
hitting every affected service before this doc was written — not left for
someone else to find.

## Final verification

- Repo-wide `grep -r "8001"` (excluding `docs/archive/`, the retired
  `ams-shared`/nothing, and the confirmed-unused `microservices/gateway/nginx.conf`):
  every remaining hit is a historical/removal-note comment, zero live code.
- Fresh central-auth login (`POST /api/auth/login-sms`) → real RS256 token →
  exercised across all 13 services after every rebuild in this phase:
  `result`, `fees`, `timetable`, `content`, `teachers` (staff-service),
  `subjects` → 200; `organizations`, `students` → 403 (correct fail-closed
  for a non-superadmin token); no-token / garbage-token controls → 401 on
  every service. Zero 500s in the final pass.
- `docker compose config` valid after every compose edit.
- `git diff --stat` against the pre-phase baseline (`3aaa320`): 53 files
  changed, all under `School-Management-System-New/` — zero VMS/HDMS/
  Auth-service-main files touched, confirmed explicitly.
- Synthetic test data (one `Employee`+`UserCredentials`+`ServiceAccess`
  triple, created twice for pre/post-R6 verification) created and cleaned
  up both times; nothing left behind.

## Flagged, not acted on

**org-service's own `/api/auth/login/` view** (`UserLoginView`,
`org-service/users/views.py`) still mints an HS256 refresh token via
`RefreshToken.for_user(user)`. It's dead-in-practice: nginx never routed
`/api/auth/login/` to org-service (only to the now-removed auth-8001), and
org-service's port 8002 is only reachable by someone manually hitting it
directly — this matches the original D0 audit's own characterization.
Removing HS256 *verification* everywhere (this phase's actual scope) makes
any token this view mints unusable regardless of whether the view itself is
deleted. Left in place rather than expanding scope beyond what R4/R6 named;
worth a follow-up phase if this view should be removed outright.

**The broader-than-`CURRENT_USER_UPLOAD_PHOTO` broken-endpoint list** (see
R6 above) — a real product gap (forgot-password, change-password, and a few
`/api/users/*` admin actions are all non-functional), not newly introduced,
but larger than what was previously tracked. Worth its own phase to either
repoint these to central auth or explicitly deprecate them.

## Follow-up: both flagged items acted on

Both items above were revisited and resolved, following the same
verify-before-delete/prove-before-ship discipline as the rest of this phase.

**org-service's `UserLoginView` deleted.** `users/views.py`'s `UserLoginView`
(and its `UserLoginSerializer`) and the `auth/login/` URL registration are
gone — confirmed via `manage.py shell`'s `Client()` that the route now 404s
inside org-service itself, not just unreachable via nginx.

**The broken-endpoint list: investigated further, and the fix turned out to
be different from "delete the frontend code."** Checking `org-service/users/urls.py`
found that `/api/profile/`, `/api/current-user/` (+ `upload-photo`),
`/api/users/` (+ `org-staff`, `switch-role`, `toggle-active`),
`/api/permissions/`, and every one of the password-reset/OTP routes are
**already fully implemented, live views in org-service** — confirmed by
hitting `org-service:8002` directly (400/401 responses, not 502/connection
errors). The only reason they'd been broken since D-R1/R3 is that nginx
routed them at `auth-service:8001` instead of `org-service:8002` — a routing
bug, not a missing backend. Repointed all of them to `org-service:8002`
instead of deleting the frontend code that calls them. `/api/version/` and
`/api/sidebar-badges/` were the only two from the original list confirmed to
have **no** live backend anywhere (auth-service-only) — those stay removed,
and their frontend code (`getSidebarBadges()`, `fetchSystemVersion()`,
`releaseNewVersion()` — the last one dead code, not called from any UI
component) was simplified to drop the now-permanently-dead legacy branch.

**Repointing surfaced 3 more central-auth crashes**, all in code that was
*never actually reachable* by a central-auth token before (nginx pointed
these paths at auth-8001 since before central auth existed) — same root
cause as the two D-R4 regressions above: complex, pre-existing view logic
written against a local `User` model, exercised end-to-end with a real
`CentralAuthUser` for the first time only once the routing was fixed:

- `current_user_profile` — read `user.first_name` directly (`AttributeError`
  on `OrgCentralAuthUser`). Fixed with an early `isinstance(user, CentralAuthUser)`
  branch returning the honest subset of fields actually on the token (id,
  username, email, full_name, employee_code) — the role-specific
  Teacher/Coordinator/Principal/Student resolution below it would never have
  fired anyway, since `OrgCentralAuthUser.role` is always `None` (fail-closed
  by design, Phase C11).
- `UserProfileView` (`/api/profile/`) — `UserSerializer` is a `ModelSerializer`
  bound to the local `User` model; several of its declared fields
  (`phone_number`, `is_verified`, `last_login`, `created_at`, `updated_at`,
  `campus`) don't exist on `OrgCentralAuthUser` at all. Fixed by overriding
  `get()` to return the same reduced shape for a central token instead of
  running it through the incompatible serializer.
- `UserListView` (`/api/users/`) — its final `else` fallback
  (`User.objects.filter(id=user.id)`) assumed `user.id` was this service's
  own integer PK; a central token's `.id` is a UUID, so this raised
  `ValueError: Field 'id' expected a number but got '<uuid>'`. Fixed with an
  explicit `isinstance` branch returning an empty queryset for a
  non-superadmin central token — no local `User` row backs one here
  (`org_id`/`role` are always `None` on `OrgCentralAuthUser`), so there's no
  honest self-only filter to fall back to; same fail-closed precedent used
  everywhere else in this service for unresolvable role concepts.

All three found and fixed via the same method as the two D-R4 regressions:
real request against a real central-auth token, not just code review — a
`django.test.Client` call reproduced each traceback before the fix, and the
same call confirmed 200 after. Full re-verification after rebuild: `current-user`
→ 200, `profile` → 200, `users` → 200, `org-staff`/`permissions` → 403
(correct fail-closed for a non-superadmin token), the OTP/password-reset
endpoints → 400/404 (real validation responses, not 502s). Synthetic test
employee created and cleaned up again for this verification pass.
