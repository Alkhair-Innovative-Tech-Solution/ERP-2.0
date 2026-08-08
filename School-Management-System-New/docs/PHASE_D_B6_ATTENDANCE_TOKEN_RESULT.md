# Phase D-b6: Attendance Permission Check off `auth_db` → onto the Token — Result

> Branch: `phase-d-b6-attendance-token-perms`. Scope: attendance-service
> only. Additive, dual-run — legacy `auth_db` read stays untouched until
> HS256 is actually retired. Synthetic data only, cleaned up after.

## The `view_attendance` → catalog mapping

Read `permissions/sms_catalog.py` (central auth) in full: `SMS_PERMISSIONS`
has exactly five entries — `sms.assignment.upload`, `sms.assignment.view`,
`sms.fee.pay`, `sms.fee.view`, `sms.result.view`. **No `sms.attendance.*`
permission exists at all.** Confirmed by grep too — zero "attendance"
matches anywhere under `permissions/`.

**Not invented.** Per the prompt's explicit rule, `CENTRAL_PERM_CODENAME =
'sms.attendance.view'` is recorded in `permissions.py` as the *intended*
codename — so wiring it up later is a catalog-only change — but it is
**not added to the catalog** in this phase. Until it exists, a central-auth
request can only pass this check via `CentralAuthUser.has_perm()`'s own
unconditional `is_superadmin` bypass; every other central role fails
closed. This is correct, not a bug: a permission that isn't in the catalog
cannot be honestly granted.

## An important discovery: `HasAttendanceViewPermission` has two call paths

Before touching anything, searched for every usage of
`HasAttendanceViewPermission` and found the class is reached two different
ways:

1. **Via `DualHasAttendanceViewPermission`** (`attendance_service/dual_auth.py`,
   built in **Phase C10** — pre-existing, not part of this phase) — the
   class actually wired into `review_view.py`, `backfill_view.py`,
   `chronic_view.py`, `reminder_view.py` (imported *as*
   `HasAttendanceViewPermission` via aliasing). Its central-auth branch
   **already** avoids `auth_db` — but via a different mechanism than this
   phase's token-`perms` approach: `is_superadmin` or a resolvable
   `Teacher`/`Coordinator`/`Principal` row via local DB match
   (`find_teacher`/`find_coordinator`/`find_principal`, all queries against
   attendance-service's *own* vendored tables, never `auth_db`). C10's own
   docstring already flags this as coarser than the legacy per-role toggle.
   **Left this untouched** — replacing it with a strict `has_perm()`-only
   check would be a real regression: since the catalog has no
   `sms.attendance.*` permission, every central teacher/coordinator/
   principal currently getting access via C10's local-match would instead
   be denied outright. That's the opposite of what this phase wants.

2. **Direct usage of the plain `attendance.permissions.HasAttendanceViewPermission`**
   (no Dual wrapper) — three real, routed endpoints: `export_attendance_csv`
   and `export_attendance_excel` (`attendance/views.py`, routed at
   `/export-csv/`, `/export-excel/`) and `export_attendance_pdf`
   (`services/export_pdf.py`, routed via `export_pdf.py`'s own url). **This
   is where this phase's fix actually applies** — these three had *no*
   central-auth branch in the permission check at all before.

**A genuine pre-existing bug found in the process**: for those three direct
endpoints, `CentralAuthUser` has neither `.organization_id` nor `.org_id`
(confirmed — its full attribute list is `id, employee_id, employee_code,
full_name, email, is_superadmin, is_active, tenant_id, services, perms,
perm_version, vms_role, is_authenticated`). So `getattr(user,
'organization_id', None) or getattr(user, 'org_id', None)` always evaluated
to `None`, and `if not org_id: return False` fired immediately — meaning
**every central-auth request to these three export endpoints was already
being denied outright, without ever attempting an `auth_db` connection**,
regardless of the caller's actual role. So the `auth_db` dependency was
never live on this path either — but the denial was for the *wrong*
reason (a missing attribute, not an actual permission decision), and it
denied even a central superadmin, who should always pass. This phase's fix
corrects that: a central superadmin is now correctly allowed, and any
other central role will be correctly allowed once (and only once)
`sms.attendance.view` exists in the catalog.

## The fix

`attendance/permissions.py`'s `HasAttendanceViewPermission.has_permission()`:
branches on `isinstance(user, CentralAuthUser)` immediately after the
authentication check.

- **Central**: `return user.has_perm(self.CENTRAL_PERM_CODENAME)` — one
  line, zero database calls. `has_perm()` (already defined on
  `CentralAuthUser`, unmodified) is `is_superadmin or '*' in perms or
  codename in perms` — the `is_superadmin` branch is the
  MASTER_ROLES-equivalent bypass for this path.
- **Legacy**: everything below that branch is **byte-for-byte identical**
  to the pre-existing code — same `MASTER_ROLES` check, same `org_id`
  resolution, same `psycopg2.connect()` call, same query, same fail-closed
  `except Exception`.

**MASTER_ROLES caveat, flagged not faked**: legacy's `MASTER_ROLES =
('superadmin', 'org_admin', 'admin')` bypass is a role-*string* match.
`CentralAuthUser` has no `.role` attribute at all (only `.vms_role`, which
is only populated for VMS/HDMS-specific logins, never for a plain SMS
`/login-sms` token) — there is no reliable claim to match `'org_admin'`/
`'admin'` against on the central side. So the central bypass only covers
`is_superadmin`, not the full `MASTER_ROLES` set. A central `org_admin`
(from D-b5) gets no automatic bypass — they'd need `sms.attendance.view`
granted via the RBAC catalog once it exists, same as any other central
role. Documented here rather than invented.

## Proof — central path makes zero `auth_db` connections

Seeded one synthetic staff `Employee` (role=teacher), logged in via
`/login-sms` to get a real, signature-verified access token, then built a
real `CentralAuthUser` from it via the actual `CentralAuthAuthentication`
class (not a hand-built mock). Monkey-patched `psycopg2.connect` with a
call-counting spy before running each scenario:

```
=== CENTRAL: perms empty -> deny ===
result: False | psycopg2.connect calls: 0
=== CENTRAL: perms=[sms.attendance.view] -> allow ===
result: True  | psycopg2.connect calls: 0
=== CENTRAL: is_superadmin -> allow ===
result: True  | psycopg2.connect calls: 0
=== LEGACY: same permission check, fake legacy user ===
result: False | psycopg2.connect calls: 1
```

Every central-path scenario: **zero** `psycopg2.connect` calls, definitively
— not inferred from timing. The legacy path, run through the exact same
`HasAttendanceViewPermission` instance right after, made **exactly one**
connection attempt — proving the legacy branch is completely intact and
still depends on `auth_db`, exactly as required by "dual-run: don't change
the legacy path."

(A secondary, timing-based version of this same test — pointing
`AUTH_DB_HOST` at an unreachable hostname and confirming the central path
still resolved instantly while a legacy-shaped call attempted and failed
against it — was also run and matched, but the connection-counter above is
the stronger, non-inferential proof and is what's reported as the primary
evidence.)

## Proof — allow / deny / master-role / legacy-unchanged

All four required scenarios, using the real token/real `CentralAuthUser`
above:

| Scenario | Result |
|---|---|
| Central token, `perms` doesn't include `sms.attendance.view` (today's actual state — catalog gap) | `False` (403) |
| Central token, `perms` includes `sms.attendance.view` (simulating the catalog gap closed) | `True` (200) |
| Central token, `is_superadmin=True` | `True` (200), regardless of `perms` |
| Legacy (HS256-shaped) request | Identical code path to before — same `MASTER_ROLES` check, same `auth_db` query, same fail-closed behavior; proven by diff (see below) plus the connection-counter test above showing it still fires |

## Legacy path unchanged — proof

`git diff` on `attendance/permissions.py` shows the legacy branch's code is
**textually identical** to before this phase — the diff only adds the new
`isinstance(user, CentralAuthUser)` branch *before* it, plus docstring/
comment updates. Nothing in the legacy branch's logic, query, or exception
handling was touched.

## VMS/HDMS unchanged

`git diff --name-only` for this branch shows exactly one file changed:
```
School-Management-System-New/microservices/attendance-service/attendance/permissions.py
```
**No file under `Enterprise-Resource-Planning/` was touched at all** —
`authentication/api.py`/`jwt_utils.py` (home of `/login-vms`, `/login-hdms`,
and all token-claim logic) were never opened this phase. Live-checked
anyway:
```
$ curl -X POST .../login-vms -d '{"employee_code":"VMST-B1-G-26-V-0006","password":"VmsUser@123"}'
→ 401 {"error": "invalid_credentials", "detail": "Employee code not found or account inactive"}
```
Same result as every prior phase's identical check (pre-existing
data-availability fact of this dev DB, not a regression).

## Cleanup

The synthetic `Employee` (`d.b6.attendance@sms-test.local`) plus its
`UserCredentials`/`RefreshToken` rows were deleted from central auth after
proving. No attendance-service-side rows were created (all testing used
direct `has_permission()` invocation against constructed request/user
objects, not real HTTP attendance-record fixtures).

## What this does and doesn't unblock

This closes the **per-request** `auth_db` dependency for central-auth
callers on the plain `HasAttendanceViewPermission` path (the 3 export
endpoints). It does **not** yet fully decouple `attendance-service` from
`postgres-auth`:
- `DualHasAttendanceViewPermission`'s central branch (the 4 main
  dual-wrapped endpoints) never touched `auth_db` either — untouched by
  this phase, already independent.
- The **legacy** branch, both direct and via the Dual wrapper's delegation,
  still reads `auth_db` live, by design — that's correct until HS256 is
  actually retired.
- `attendance/management/commands/sync_master_data.py` also connects to
  `AUTH_DB_HOST` (a *startup* sync, not a per-request read) — out of scope
  for this phase (the prompt's own framing is specifically about the
  per-request dependency), not touched, and still a real reason
  `postgres-auth` can't be torn down yet.

This is Phase D's last **build** increment. The actual **retirement**
(auth-8001, org-cron, HS256, `postgres-auth`) is the next and final Phase D
stretch, and per the prompt, needs its own careful plan — not started here.
