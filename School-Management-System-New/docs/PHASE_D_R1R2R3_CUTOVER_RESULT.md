# Phase D R1+R2+R3: Cut Over to Central Auth + Stop auth-8001 — Result

> Branch: `phase-d-r1r2r3-cutover`. Dev environment, test data only, confirmed
> no prod/real users. Each step verified before the next, per the prompt's
> own discipline. **Nothing deleted** — auth-8001 ends this phase STOPPED,
> not removed; HS256/`DualAuthentication`/`postgres-auth`/dead code are all
> untouched. That's R4–R6, not this phase.

## R1 — Cut over: what was flipped

- **`SYNC_TO_CENTRAL_AUTH=true`** — uncommented for real in this environment's
  own `.env` (gitignored by design, same as every prior D-phase's flag
  flip — the *committed* default in `docker-compose.yml` stays `false`).
  Restarted `staff-service`, `student-service`, `org-service`.
- **`NEXT_PUBLIC_AUTH_SOURCE=central`** + **`NEXT_PUBLIC_CENTRAL_AUTH_URL=http://localhost:8000`**
  — added to `.env`. These are Next.js build-time constants, so this
  required `docker compose build frontend` (not just a restart) to actually
  bake in.

## R1 — two real, pre-existing infra bugs found and fixed while verifying

Proving "central tokens work across SMS services" (the prompt's explicit
step 5, with an explicit "fix any that don't work BEFORE proceeding"
instruction) surfaced two genuine, pre-existing bugs — neither introduced
by this phase, both blocking the verification itself:

1. **SMS's own gateway (`ams_gateway`) had never successfully started in
   this environment.** `docker-compose.yml`'s `gateway` service mounted
   `./nginx/proxy_params` — a path that was never an actual file in this
   repo (Docker silently bind-mounted it as an empty directory instead),
   so nginx crashed on start (`pread() ... failed (21: Is a directory)`).
   The real, git-tracked file lives at `microservices/gateway/proxy_params.conf`.
   Fixed the volume mount path in `docker-compose.yml`. Separately, the
   gateway's intended host port 80 was already claimed by an unrelated,
   pre-existing `erp-edge-nginx` container (the ERP-2.0-wide router for
   VMS/HDMS/HRMS — confirmed by reading its config, it has zero SMS
   routing). Ran SMS's gateway on port 8090 instead
   (`NGINX_HTTP_PORT=8090`, an env override the compose file already
   supported) rather than touch either nginx's config.
2. **attendance-service's own vendored `teachers` migration history was
   missing a migration.** `teachers/` (models.py) is vendored from
   staff-service into 9 services at Docker build time, but each service
   keeps its **own independent** migration history for it via Django's
   `MIGRATION_MODULES` setting (`teachers_attendance_migrations`,
   `teachers_staff_migrations`, etc. — one per vendoring service, so
   9 separate schemas can each apply the shared model differently over
   time). staff-service's own history had migration `0008` (adding
   `central_user_id`/`tenant_id`/`central_classroom_assigned_by_id` —
   these columns clearly exist in its live DB); attendance-service's
   history was stuck at `0007` — that migration was simply never written
   for this service. This surfaced as a live 500
   (`django.db.utils.ProgrammingError: column teachers_teacher.central_user_id
   does not exist`) inside `DualHasAttendanceViewPermission.find_teacher()`
   (Phase C10 code, unrelated to D-b6) the moment a central-auth staff
   token hit the attendance review endpoint. Fixed by copying
   staff-service's `0008` migration into attendance-service's own
   `teachers_attendance_migrations/` (same fields, same dependency chain,
   confirmed identical up through `0007` in both) and rebuilding.
   **Not fixed, flagged instead**: 8 other services also vendor `teachers/`
   (support, result, content, subject, student, campus, timetable,
   fees-service) and may have the same drift — only attendance-service was
   actually exercised and confirmed broken in this phase's testing; the
   other 8 weren't touched since nothing in this phase's verification hit
   them. A real gap for whoever next touches those services' central-auth
   paths.

## R1 — central-login end-to-end proof

Real browser flow (Playwright, system Chrome, same method as D-b4),
against the actual `/login` page, `NEXT_PUBLIC_AUTH_SOURCE=central` baked
into the running frontend image:

```
=== STAFF login ===
redirected to: http://localhost:3000/admin/students/student-list
access token stored: true
sis_user: {..., "role":"teacher", "campus_id":6, ...}     ← D-b4-fix's /me campus resolution confirmed working
requests: POST .../login-sms, GET .../api/teachers/me/
any request hit :8001? false

=== STUDENT login ===
redirected to: http://localhost:3000/student/dashboard
access token stored: true
any request hit :8001? false
```

Cross-service API proof, same central-issued staff token, through the now-
fixed gateway:
```
GET /api/result/           → 200 {"count":0,...}
GET /api/fees/fee-types/   → 403 (legitimate — this synthetic teacher has no fee-management rights)
GET /api/attendance/review/ → 403 (correct fail-closed — D-b6's central path; no auth_db call, and no
                                    500 anymore after the migration fix above)
```

## R2 — stop WRITING to auth-8001 (flag-gated, not deleted)

Introduced one new flag, `WRITE_TO_AUTH_8001` — defaults `true` in every
committed file (so nothing changes anywhere this isn't explicitly set),
set to `false` in this environment's `.env`. Gated the 5 real call sites
found in R0's sweep that make an HTTP write to auth-8001 (confirmed the
student ViewSet's own `_ensure_student_user_account`, by contrast, was
never one of these — it only ever wrote a **local** `users.User` row, no
HTTP call to auth-8001 at all, so nothing needed gating there):

1. `staff-service/services/user_creation_service.py::_sync_user_to_auth`
2. `staff-service/teachers/management/commands/sync_staff_to_auth.py::_sync_to_auth`
3. `student-service/students/services/student_csv_import.py::_ensure_student_user_account` (its central half was added in D-R0)
4. `org-service/users/serializers.py` (org-admin `create-user`)
5. `org-service/users/views.py` (all 3 `sync-org` call sites, including the payment_status-only one — it has no central equivalent per D-b5's own decision, so gating it just stops a now-pointless auth-8001 call)

**Deliberately not deleted** — each site keeps its old code path intact
behind `if os.environ.get('WRITE_TO_AUTH_8001', 'true').lower() != 'false':`,
so restoring the write is a one-line env change, no redeploy of logic
needed (only a container recreate to pick up the new env var).

**Proof**, with auth-8001 actually running (see below — it started as a
side effect of the frontend's own `depends_on` this session, letting this
be checked against the real service rather than inferred from connection
errors):
```
>>> Teacher.objects.create(..., email='r2.verify.staff@sms-test.local')
[AUTH-SYNC] Skipped for r2.verify.staff@sms-test.local (WRITE_TO_AUTH_8001=false)
[CENTRAL-AUTH-SYNC] r2.verify.staff@sms-test.local -> {"created": 1, ...}
```
Checked directly against auth-8001's own live database:
`User.objects.filter(email__iexact='r2.verify.staff@sms-test.local').exists()` → **`False`**.
Same result for a synthetic org-admin, created through the real
`OrganizationCreateSerializer`: absent from auth-8001, present in central,
and able to log in via `/login-sms` (`200`, `role: "Org Admin"`).

## R3 — take auth-8001 out of service

**Step 8 — confirmed nothing logs in against it.** Grepped the frontend:
the only reference to `AUTH_LOGIN` is inside `loginWithEmailPassword()`'s
already flag-gated `legacy` branch — dead code in the currently-built
image (`NEXT_PUBLIC_AUTH_SOURCE=central` baked in). Cleared and watched
auth-8001's own access log through a full staff+student browser login:
**zero** hits to `/api/auth/login/` or `/api/auth/refresh/`.

**One honest caveat, not login/refresh but worth naming plainly**: the log
*did* show hits to `/api/current-user/`, `/api/version/`, and
`/api/sidebar-badges/` — all `401`, all served only by auth-8001, all
still called by the frontend after a successful central login (profile
refresh, version check, sidebar badge counts). These were never touched by
D-b1–b6 (out of scope — those phases were about login/refresh specifically)
and already fail today (`401`, since auth-8001 can't verify a central
RS256 token) regardless of whether auth-8001 is up or down. Not a login/
refresh dependency — so it doesn't contradict step 8's specific claim —
but a real, named gap for whoever next works on these three frontend
calls specifically.

**Step 9 — stopped the container.** `docker stop ams_auth` (exit 0).
Confirmed via `docker ps`/`docker ps -a`: not running, still present
(image, container, and its `postgres-auth`/`auth_db` volume all untouched).

**Step 10 — verified with it stopped.** Re-ran the exact same browser
login test (staff + student) — identical results, `campus_id` still
resolves, tokens still store correctly. Re-ran the cross-service API
checks (`result` 200, `attendance` 403-not-500) — identical. Created
another synthetic teacher — local create succeeded, auth-8001 write
correctly skipped (never even attempted, since `WRITE_TO_AUTH_8001=false`
already), central sync succeeded. **No hidden dependency found** — nothing
500s or hangs looking for auth-8001.

## VMS/HDMS unchanged, throughout

Checked after every step (R1, R2, R3):
```
$ curl -X POST .../login-vms -d '{"employee_code":"VMST-B1-G-26-V-0006","password":"VmsUser@123"}'
→ 401 {"error": "invalid_credentials", "detail": "Employee code not found or account inactive"}
```
Identical result every time — the same pre-existing, already-documented
data-availability fact from every prior D-phase (that specific synthetic
VMS employee isn't in this dev DB), not a regression. No file under
`Enterprise-Resource-Planning/` was touched this phase at all.

## Confirmation: nothing deleted, everything reversible

- auth-8001: **stopped, not removed** — container, image, and
  `postgres-auth`/`auth_db` volume all still present. `docker start ams_auth`
  restores it instantly.
- HS256 / `DualAuthentication` legacy branches: **untouched** in every
  service — this phase never opened any `dual_auth.py`.
- `postgres-auth`/`auth_db`: **untouched**, still holds all its data.
- Dead sync code (the auth-8001 write functions themselves): **not
  deleted** — flag-gated off, code intact, one env var away from restored.
- Every flag flipped this phase (`SYNC_TO_CENTRAL_AUTH`,
  `NEXT_PUBLIC_AUTH_SOURCE`, `WRITE_TO_AUTH_8001`) lives in this
  environment's own `.env` (gitignored) or `docker-compose.yml`'s default
  (which stayed conservative — `WRITE_TO_AUTH_8001` still defaults `true`
  in every committed file).

## Cleanup

All synthetic data created while proving each step — 5 central `Employee`
rows, 1 `NonStaffIdentity`, 1 central `Organization`, matching local
`Teacher`/`User` rows in staff-service, one test `Campus` fixture, and one
`Organization`+`User` pair in org-service — deleted after use. Temporary
Playwright test script removed.

## What's next

R4–R6 (remove HS256 per service, drop `postgres-auth`, delete dead
code/secret/compose entries) is the next and final prompt, per the
original plan. Two things this phase surfaced that whoever does R4-R6 (or
sooner) should know about:
- The other 8 services vendoring `teachers/` may have the same missing-
  migration drift attendance-service had — only confirmed/fixed for
  attendance-service here.
- The frontend's `/api/current-user/`, `/api/version/`, `/api/sidebar-badges/`
  calls still target auth-8001 exclusively and will need a central-auth
  equivalent (or removal) before auth-8001 can be safely deleted rather
  than just stopped.
