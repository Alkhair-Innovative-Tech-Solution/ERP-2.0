# Phase C12: Repoint staff-service onto Central Auth — Result

Branch: `phase-c12-staff-service` (off `main`, not merged). Scoped to
`staff-service/` only, per the prompt. The last and most coupled of the
13 services — real Teacher/Principal/Coordinator identities with `.user`
OneToOnes (student-service C8's shape), plus the standing
`assign_teacher` gunicorn-hang bug fixed here as instructed.

## The `assign_teacher` hang — root cause, fix, proof

**What it did before**: `teachers/signals.py`'s `_sync_class_teacher_to_campus_db`
(fired by `m2m_changed` on `Teacher.assigned_classrooms.through` — the
actual `assign_teacher` / classroom-assignment path) opened its own
ad-hoc `psycopg2.connect()` **per call**, direct to campus-service's own
Postgres (`postgres-campus` — a genuinely different service's database,
not staff-service's own), with **no statement or lock timeout set
anywhere**. Traced the actual hang mechanism precisely (not just "a
second connection exists"): `connect_timeout=3` only bounds the initial
TCP handshake — once connected, an `INSERT`/`UPDATE` against a table
someone else holds locked (or a slow/degraded target) blocks
**indefinitely**, and because gunicorn's default `sync` worker processes
one request per OS thread, that block freezes the entire worker until an
operator kills it — exactly "hangs until killed."

**What it does now**: the target database gets a real, second Django
database alias (`campus_db` in `staff_service/settings.py`'s
`DATABASES`) instead of a bespoke `psycopg2.connect()`/`close()` pair —
`CONN_MAX_AGE`-pooled and lifecycle-managed by Django like every other
connection in this codebase, with `OPTIONS: {'options': '-c
statement_timeout=5000 -c lock_timeout=3000'}` — a hard 3-5s cap so
Postgres itself forcibly cancels a blocked query instead of waiting
forever. The query code inside `_sync_class_teacher_to_campus_db` is
**byte-identical raw SQL** — deliberately not rewritten as ORM `.save()`/
`.create()` calls: campus-service's own `teachers_teacher` table
(confirmed by reading `campus-service/classes/views.py`) is an
independently-migrated, **narrower** schema than staff-service's own
authoritative `Teacher` model (fewer columns, no `central_user_id` etc.)
— a full-model ORM save would attempt to write columns that table
doesn't have and fail outright. The existing raw SQL already hand-picks
the exact column set that table has; keeping it raw (just on a managed,
timeout-bounded connection now) preserves the exact data effect with zero
schema-mismatch risk.

**No dockerfile/campus-service change** — `CAMPUS_DB_HOST`/`_NAME`/`_USER`/
`_PASSWORD` env vars already existed (read directly by the old code);
the new alias just reuses them. `DATABASE_ROUTERS` was deliberately left
unset — no staff-service model auto-routes to `campus_db`; only this one
function ever uses it explicitly via `connections['campus_db']`.

**Proof (no hang, behavior preserved)**:
```
Happy path (no contention): teacher.assigned_classrooms.add(classroom) via
  the actual M2M signal -> completed in 0.02s.
Full API path: PATCH /api/teachers/2/ {"assigned_classrooms":[2]} (central
  superadmin token) -> 200 OK in <0.3s wall-clock, classroom.class_teacher
  and teacher.is_class_teacher correctly updated (verified in the response
  body: "class_teacher_name":"C12 Test Teacher", "is_class_teacher":true).

Lock-contention test (the actual root-cause proof): held an
  ACCESS EXCLUSIVE lock on campus_db's teachers_teacher table from a
  separate psql session (confirmed held via pg_locks), then called the
  exact fixed _sync_class_teacher_to_campus_db('post_add', 1, {1})
  directly:
    -> blocked for exactly 3.02s, then Postgres itself raised
       "canceling statement due to lock timeout" (matching lock_timeout=3000),
       caught by the SAME pre-existing except Exception handler
       ([WARN] print, no crash, no hang) — function returned normally.
  Direct connections['campus_db'] query under the same lock: identical
  3.01s bounded failure, confirming the mechanism precisely.
```

## FK / `*_id` audit table

| Field | Model | Category | Treatment |
|---|---|---|---|
| `Teacher.user` (`teachers/models.py:70`) | Teacher | **person** (real identity) | `central_user_id`, exact `legacy_user_id` remap |
| `Principal.user` (`principals/models.py:68`) | Principal | **person** | `central_user_id`, exact remap |
| `Coordinator.user` (`coordinator/models.py:53`) | Coordinator | **person** | `central_user_id`, exact remap |
| `Teacher.classroom_assigned_by` (`teachers/models.py:~240`) | Teacher | **person** (acting-user audit FK) | `central_classroom_assigned_by_id` (additive, nullable — **not yet stamped**, see gaps below) |
| `Organization` (whole model, vendored from auth-service's `users` app) | — | org concept | **not touched** — see below |
| `Teacher`/`Principal`/`Coordinator.organization` | all three | domain-adjacent org FK | left as-is; central-path scoping uses the NEW `tenant_id` field on each model directly instead (see below) |
| `Teacher.current_campus`, `assigned_classroom`, `assigned_classrooms`; `Principal.campus`; `Coordinator.campus`/`.level`/`.assigned_levels` | all three | **domain** (school structure) | left untouched (per rules), only the PK-field blind-spot fix applied where found (see below) |

**`teachers/models.py:225`'s other `users.User` ref, audited**: that's
`classroom_assigned_by` (row above) — confirmed via direct read, not a
second identity link.

**Organization: deliberately not touched.** Unlike C11 (org-service),
which added `tenant_id`/`central_org_id` directly to its own
`Organization` model, staff-service only **vendors** `users.Organization`
(copied wholesale from auth-service — the very same file C11 left
untouched in auth-service's own tree, since C11 only migrated
org-service's copy). Adding a schema column to a vendored copy of another
service's model, migrated independently per-service, was judged riskier
than the alternative: give `Teacher`/`Principal`/`Coordinator` their own
`tenant_id` field directly (a 1:1-with-the-row scoping value, same shape
as every other SMS service's per-row `tenant_id`) and scope reads/writes
off THAT instead of the Organization indirection. This sidesteps the
whole question of Organization schema drift across services entirely —
central-path tenant scoping never needs `Organization.tenant_id` to
exist at all.

## Why the C3 dual-role-class pattern doesn't apply as literally written here (same finding as C11)

staff-service vendors the exact same `users/permissions.py` +
`users/models.py` shape Phase C11 (org-service) diagnosed — both trace
back to the same auth-service `users` app. Confirmed again here: role
checks are **not** isolated in permission classes — ~30+ inline
`request.user.is_superadmin()` / `.role == 'x'` / `.is_principal()` calls
scattered through `teachers/`, `principals/`, `coordinator/`'s views.py,
PLUS `users/middleware.py`'s own manual-auth fallback and
`TeacherManager`/`PrincipalManager`/`CoordinatorManager`/`MultiTenantUserManager`'s
`get_queryset()`. Reused C11's exact fix rather than reinventing it:
`staff_service/dual_auth.py`'s **`StaffCentralAuthUser`** (a
`CentralAuthUser` subclass `DualAuthentication` returns instead of the
raw class) — same `_BoolCallable` trick for `is_superadmin` (must be both
a bool for `CentralAuthUser`'s own inherited `has_service()`/`has_perm()`
and callable for this codebase's `.is_superadmin()` convention, from the
SAME underlying flag — see C11's result doc for why naively overwriting
it breaks subscription checks), same `.role = None` / fail-closed
`is_org_admin_role()`/`is_principal()`/`is_coordinator()`/`is_teacher()`/
`is_admin()`/`is_student()`. `isinstance(x, CentralAuthUser)` stays True
everywhere; `users/permissions.py` (`IsSuperAdminOrPrincipal`,
`IsNotDonorForWrites`, etc.) is **never touched** — every existing role
class works unchanged for both token types.

**Fail-closed** (per this phase's own instruction): staff-service's role
concepts (org_admin/principal/coordinator/teacher/admin) have no
equivalent in central auth's SMS catalog today — same finding as C11
(`permissions/sms_catalog.py` only wires "SMS Student"; staff-role RBAC
is still deferred). A central token satisfies `IsSuperAdmin` and
`IsSuperAdminOrPrincipal`'s superadmin branch, and nothing else, until a
future phase builds an SMS staff-RBAC catalog.

**`IsNotDonorForWrites` is naturally safe** on the central path without
any special-casing: `StaffCentralAuthUser.role` is `None`, which never
equals `'donor'`, so central writes are never incorrectly blocked; the
donor-block itself can only be proven on the legacy path today (no
catalog "donor" concept exists centrally either) — proven below on
legacy, unchanged.

## The exact `legacy_user_id` remap — never fuzzy

`teachers/management/commands/remap_central_user_ids.py` (new, mirrors
Phase C8's student-service command exactly — one DB connection, one
fetch of `employees_employee`'s whole `legacy_user_id -> id` map, applied
across all three models in one pass rather than three separate
connections). Match is a **plain integer equality**:
`employees_employee.legacy_user_id == <profile>.user_id` — no name/email
guessing. A profile whose `user_id` has no matching `legacy_user_id` is
left `NULL` and reported, never guessed at.

`Principal.get_for_user`/`Coordinator.get_for_user` (pre-existing
classmethods) and the new `Teacher.get_for_user` (added this phase —
Teacher never had one; three inline `getattr(user, 'teacher_profile',
None)` call sites in `teachers/views.py` now delegate to it) all gained a
central-auth branch **ahead of** their existing fuzzy
username/employee_code fallback: for a `CentralAuthUser`, resolution is
`Model.all_objects.filter(central_user_id=user.id).first()` — exact UUID
match only. The existing fuzzy fallback (matching a *central*
employee_code/email against a *local* Teacher/Principal/Coordinator
employee_code/email — two unrelated ID spaces) is explicitly never used
for a central token, exactly per this phase's "never fuzzy" rule.

**Proof**: created a local `Teacher`/`Principal`/`Coordinator` each with
a `user_id` pointing at a synthetic local `User`, then a matching
`Employee` (auth-service) with `legacy_user_id` set to that same integer.
Ran the remap command:
```
Fetched 3 Employee rows from auth-service.
Teacher: Matched: 1. Unmatched: 0. Total Teacher rows with central_user_id set now: 1.
Principal: Matched: 1. Unmatched: 0. Total Principal rows with central_user_id set now: 1.
Coordinator: Matched: 1. Unmatched: 0. Total Coordinator rows with central_user_id set now: 1.
```
Verified byte-exact: `Teacher.central_user_id`, `Principal.central_user_id`,
`Coordinator.central_user_id` each equal to their corresponding
`Employee.id` UUID exactly (direct comparison, not just "matched"
count). Then minted a central token for the SAME Employee (the teacher)
and called `GET /api/teachers/my-classes/` — resolved to the **exact**
"C12 Test Teacher" profile via `Teacher.get_for_user`'s new
`central_user_id` branch (not a 404, not a wrong match).

## The C5-class hazard, checked for up front

`Teacher`, `Principal`, `Coordinator` had **no `all_objects` at all**
(only `ClassRoom`/`Campus`/`Level`/`Grade`, vendored from campus-service's
own already-central-auth'd copies, had one). Added to all three.

## Endpoint → gate map (touched this phase)

| Endpoint | Legacy gate | Central gate |
|---|---|---|
| `GET/POST/PATCH/DELETE /teachers/` | `IsAuthenticated, IsNotDonorForWrites` | + `DualServiceSubscribed`; tenant-scoped via `Teacher.tenant_id` |
| `GET/POST/PATCH/DELETE /principals/` | `IsAuthenticated, IsNotDonorForWrites` | + `DualServiceSubscribed`; tenant-scoped via `Principal.tenant_id` |
| `GET/POST/PATCH/DELETE /coordinators/` | `IsAuthenticated, IsNotDonorForWrites` | + `DualServiceSubscribed`; tenant-scoped via `Coordinator.tenant_id` (also: this ViewSet had **no** `get_queryset()` override at all before this phase — added one) |
| `teachers/bulk-upload/`, `bulk-upload-template/` | `IsAuthenticated, IsSuperAdminOrPrincipal` | + `DualServiceSubscribed`; superadmin only (principal/admin/org_admin branches fail closed) |
| `teachers/my-classes/`, `signature/save`, `signature/get` | inline `.teacher_profile`/employee_code fallback | exact `central_user_id` match via `Teacher.get_for_user` (new) |

`DualServiceSubscribed` added to each ViewSet's explicit `permission_classes`
list (DRF replaces, not appends, the default list, so the handful of
views with their own explicit list needed it added by hand — same as
C11).

## The `PrimaryKeyRelatedField` blind spot — found in two places, one already safe

- **`TeacherSerializer`**: `Meta.fields = "__all__"` auto-generated
  `current_campus`/`assigned_classroom`/`assigned_classrooms` from
  `Campus`/`ClassRoom`'s default manager (`OrganizationManager` — blind
  for central-auth, same C9-class blind spot as every prior phase).
  Overridden with explicit `_base_manager`-backed fields.
- **`PrincipalSerializer`**: same finding for the bare `campus` field —
  same fix.
- **`CoordinatorSerializer`**: already using `_base_manager` for
  `level`/`campus`/`assigned_levels` — confirmed safe, no fix needed
  (pre-existing, predates this phase).

## Central-id stamping

`TeacherViewSet`/`PrincipalViewSet`/`CoordinatorViewSet.perform_create()`:
central branch stamps `tenant_id` (from the token's own claim);
`organization` stays unset (no tenant_id column to resolve one from, see
the Organization section above) — legacy branches are otherwise
byte-for-byte unchanged.

## What was NOT stamped (flagged, not fixed)

- **`Teacher.central_classroom_assigned_by_id`** — schema-ready, but the
  classroom-assignment write path (`TeacherSerializer._sync_classroom_assignments`)
  doesn't currently stamp `classroom_assigned_by`/`central_classroom_assigned_by_id`
  at all for EITHER token type (pre-existing — that field is set
  elsewhere, e.g. campus-service's own `assign_teacher` action, not this
  serializer path). Left as-is rather than introducing new stamping logic
  not requested by this phase's scope.
- **`TeacherSubjectAssignment` — pre-existing, unrelated gap, found and
  deliberately NOT fixed.** `makemigrations` proposed `CreateModel` for
  this model as part of my additive migration — the model has apparently
  **never had a working migration** (migration numbering jumps 0004 ->
  0006, skipping 0005) and its own FK to `timetable.subject` can't even
  be satisfied (`timetable` is not an installed/vendored app in
  staff-service at all). `TeacherSubjectAssignmentViewSet` has therefore
  never worked in this environment. Excluded from this phase's migration;
  still flagged by `makemigrations --check` (expected, confirmed, not a
  regression this phase introduced).
- **Org-admin/principal/coordinator/teacher roles remain unresolvable
  for central tokens** — same SMS staff-RBAC catalog gap C11 flagged,
  carried forward.

## Proof on synthetic data

Environment: staff-service was already running (from a prior session);
`central_auth/` vendored fresh this phase (staff-service's vendored
`campus`/`classes` apps — copied from campus-service, which already went
through its own central-auth phase — already imported `central_auth.authentication.CentralAuthUser`
directly, confirmed via a real `ModuleNotFoundError` before vendoring
fixed it).

Synthetic fixtures: 1 local `Teacher`/`Principal`/`Coordinator` each
linked to a local `User` + a matching central `Employee` (`legacy_user_id`
set for the exact-remap proof), 2 more `Teacher` rows tagged to different
`tenant_id`s (cross-tenant isolation proof), 4 central tokens (superadmin,
plain non-superadmin, the remapped teacher, a VMS-only-tenant token), 3
legacy HS256 tokens (superadmin, teacher, donor).

```
(a) PATCH /api/teachers/2/ {"assigned_classrooms":[2]} (central superadmin)
      -> 200, <0.3s, classroom + is_class_teacher correctly updated (see hang-fix section for the full no-hang proof)
(b) remap_central_user_ids: 3/3 matched, byte-exact UUIDs (see remap section)
    GET /api/teachers/my-classes/ (remapped central teacher token) -> 200, resolves the EXACT teacher
(c) GET /api/teachers/bulk-upload-template/ (IsSuperAdminOrPrincipal):
      central superadmin -> 200; central plain (non-superadmin) -> 403
      legacy superadmin -> 200; legacy teacher -> 403
(d) GET /api/teachers/ (legacy donor token) -> 200 (read allowed)
    PATCH /api/teachers/2/ (legacy donor token) -> 403 "Donor accounts have view-only access."
(e) GET /api/teachers/ (VMS-only tenant token, no sms subscription) -> 403
    GET /api/teachers/?page_size=50 (central plain token, SMS tenant) -> sees its own
      SMS-tenant teacher + a NULL-tenant_id row (permissive-for-unscoped-rows,
      same precedent as C1-C11), does NOT see the OTHER-tenant-tagged teacher
(f) GET /api/teachers/ (legacy superadmin) -> 200, unchanged
    B4 dual-write: confirmed still wired — with SYNC_TO_CENTRAL_AUTH=true
      (temporarily, reverted after), creating a Teacher produced
      "[CENTRAL-AUTH-SYNC] Warning: HTTP 401: {"error": "Invalid or missing
      internal secret"}" — a REAL HTTP round-trip to the real central
      auth-service's /api/internal/sms-staff endpoint (401 expected — test
      secret didn't match the real one), proving the call path fires
      exactly as before, completely unaffected by this phase's changes.
```

All synthetic data (3 profiles + 2 cross-tenant teachers + 3 local
`User`s + 1 `Campus`/`Level`/`Grade`/`ClassRoom` chain + 7 `Employee`s)
deleted after verification — confirmed via direct row-count queries (`0`)
post-cleanup.

## Proof VMS/HDMS unchanged

```
manage.py check (auth_service)     -> System check identified no issues (0 silenced)
manage.py check (staff-service)    -> System check identified no issues (2 silenced — pre-existing, unrelated)
pytest (auth_service)              -> 5 failed, 66 passed, 25 errors — identical to every prior phase's baseline
POST /api/auth/login-vms (nonexistent employee_code)
  -> 401 {"error": "invalid_credentials", "detail": "Employee code not found or account inactive"}
```

## `AUTH_SERVICE_URL` naming collision — same class as C11, confirmed and worked around

staff-service already had `AUTH_SERVICE_URL` (read directly via
`os.environ.get()` in `sync_staff_to_auth.py`/`user_creation_service.py`,
pointing at the legacy org/user-sync service on :8001) — but nothing read
`settings.AUTH_SERVICE_URL` (the Django *setting*, as opposed to the raw
env var) before this phase; confirmed via grep. `central_auth/jwks.py`
(unchanged template) needs that setting to mean the CENTRAL auth-service.
Repointed the setting to reuse Phase B4's existing `CENTRAL_AUTH_URL` env
var (`services/central_auth_sync_service.py` already points it at the
same central auth-service) — the raw `AUTH_SERVICE_URL` env var, and
every file that reads it directly, is untouched.

## Confirmed untouched

- `central_auth/authentication.py`, `jwks.py`, `permissions.py`:
  byte-identical to the C1-C11 template.
- `users/permissions.py`: not modified — every role class works
  unchanged for both token types via `StaffCentralAuthUser`.
- `services/central_auth_sync_service.py`, `services/user_creation_service.py`'s
  B4 sync call site: byte-identical — proven still firing above.
- `CoordinatorSerializer`: already `_base_manager`-safe, confirmed by
  reading, not modified.
- The legacy `ServiceJWTAuthentication`/`_TokenUser` path: proven working
  unchanged end-to-end (dual-run proof above, including the donor
  write-block and role-gate 403).
- Every other SMS service, VMS, HDMS, central auth's own code: untouched.

## What's next

This completes all 13 planned service repoints except **ai-service**
(0-coupling, token-verify only), which is the final one, per this
phase's own closing instruction. Carried forward: an SMS staff-RBAC
catalog (so org_admin/principal/coordinator/teacher become resolvable for
central tokens beyond superadmin) remains Phase D-adjacent work, same gap
flagged since C11; `TeacherSubjectAssignment`'s pre-existing broken
migration is unrelated and untouched; `Teacher.classroom_assigned_by`'s
central stamping is schema-ready but not wired into any write path this
phase.
