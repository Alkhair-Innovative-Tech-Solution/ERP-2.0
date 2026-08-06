# Phase C8: Repoint student-service onto Central Auth — Result

Branch: `phase-c8-student-service` (off `main`, not merged). Scoped to
`student-service/` only, per the prompt. Eighth of 13, and — per the
prompt's own framing — the most identity-sensitive phase yet:
`Student.user` is a real `OneToOneField` to `users.User`, the actual
student identity imported centrally in Phase B2. This doc records the
recipe reuse, the identity remap mechanism, and two real bugs the proof
testing itself surfaced (both fixed, both explained below).

## The identity link — `Student.user` → `Student.central_user_id`

`students/models.py:99` (`user = models.OneToOneField('users.User', ...,
null=True, blank=True, related_name='student_profile')`) is the legacy
identity link. `central_user_id` (added this phase, nullable UUID, unique)
is its central-auth counterpart: a central-auth student token's own
`user_id` claim already **is** the `NonStaffIdentity`'s UUID primary key
(Phase B2), so no lookup is needed at request time — `central_user_id`
just needs to already be populated so `Student.all_objects.filter
(central_user_id=token_user_id)` finds the right row.

**The remap**: `students/management/commands/remap_central_user_ids.py`,
an offline, re-runnable batch command (never touched at request time).
Fetches `(legacy_user_id, id)` pairs from auth-service's
`auth_non_staff_identity` table (a direct read-only Postgres connection —
`CENTRAL_AUTH_DB_*` settings — reusing the exact `host.docker.internal` +
published-port path every SMS service already uses for
`AUTH_SERVICE_URL`/JWKS, not new infra), then matches each local
`Student.user_id` against it **exactly** — `legacy_user_id` is Phase B2's
import key, set to the *original* local `users.User.id`, the very same
integer `Student.user_id` already points at. No name/email/username
fallback anywhere in the file — a `Student` whose `user_id` has no
matching `legacy_user_id` is left `central_user_id = NULL` and reported,
never guessed at (A3's rule, restated in this phase's own prompt).

**Proof of exactness** (synthetic): two local `users.User` rows created
with explicit `id=900001`/`900002`, two `Student` rows pointing at them,
two `NonStaffIdentity` rows in auth-service with matching
`legacy_user_id=900001`/`900002`. `remap_central_user_ids --dry-run` first
(0 written, matched=2 reported); then for real:

```
Fetched 2 student NonStaffIdentity rows from auth-service.
Matched: 2. Unmatched: 0. Total Student rows with central_user_id set now: 2.
```

DB afterward: `Student(id=1, user_id=900001, central_user_id=<NonStaffIdentity
A's own UUID>)`, `Student(id=2, user_id=900002, central_user_id=<B's UUID>)`
— confirmed the UUIDs are byte-identical to the tokens minted for A/B
below, not merely "some UUID got set."

## Two real bugs found by the proof itself (not by inspection) — both fixed

**Bug 1 — UUID-vs-string comparison always false.** `StudentViewSet.get_object()`'s
central-auth re-check did `obj.central_user_id != user.id` — `obj.central_user_id`
is a `uuid.UUID` instance (from the DB); `user.id` is the token's own
`user_id` claim, always a plain string (JWT claims serialize as strings).
A bare `!=` between the two types is **always true**, regardless of value
— so student A's *own* record retrieve returned 403, not 200. Caught live:
the very first IDOR proof attempt showed A blocked from their own record.
Every `.filter(central_user_id=user.id)` call elsewhere in this phase
(get_queryset, find_student) was unaffected — Django's ORM coerces the
string for the SQL comparison; only this one bare Python comparison
needed an explicit `str(a) != str(b)`. The same class of bug was also
present in `get_object()`'s destroy-path tenant check (`obj.tenant_id !=
user.tenant_id`) — fixed identically. Grepped every other `user.id`/
`user.tenant_id` use in this phase's code afterward to confirm no other
instance of the same mistake exists.

**Bug 2 — empty-string false-positive staff match.** `student_service/dual_auth.py`'s
`_find()` (the C3/C6-pattern Teacher/Coordinator/Principal resolver) did
`Q(email=user.email) | Q(employee_code=user_identifier(user))` unguarded.
A `NonStaffIdentity`-minted token (a student) carries **neither** an
`email` nor an `employee_code`/`employee_id` claim — `CentralAuthUser`
defaults both to `''`. Without a guard, `Q(email='') | Q(employee_code='')`
can match any Teacher/Coordinator/Principal row with a blank email/
employee_code (leftover seed data, in this case), silently misidentifying
a student token as staff — which then computed an empty classroom set and
denied the student their own record (`cqs.none()`). C3/C6 never hit this
because they only ever tested with genuinely staff-shaped tokens. Fixed:
`_find()` now returns `None` immediately for a `CentralAuthUser` with no
`employee_id` claim (the same staff-vs-non-staff signal C6's
`user_is_staff_principal` used), and only builds a `Q()` clause for a
field that actually has a non-empty value.

Both bugs were specific to this phase's *new* code (dual_auth.py /
views.py), not pre-existing — flagged here in detail because they're
exactly the shape of mistake the prompt's "go carefully, prove hard"
instruction was guarding against, and because the fix pattern
(str-compare central UUIDs; guard staff-lookup on `employee_id`) is worth
carrying into any future phase that resolves a *subject* identity (not
just an *actor* identity) via a central-auth token.

## Field audit — exhaustive

| Field | Model | Person, org, or domain? | Treatment |
|---|---|---|---|
| `Student.user` | Student | **THE identity link** (real FK → `users.User`) | `central_user_id` (UUID, unique), populated by the offline remap only |
| `Student.organization` | Student | — (Org FK) | `tenant_id` + `central_org_id`, applied inline (mixin shape, no separate class needed — only Student and one sibling model need it) |
| `EnrollmentEvent.created_by` | EnrollmentEvent | **person** (real FK → `users.User`) — the acting staff member, not the student | `central_created_by_id` |
| `EnrollmentStatusRequest.requested_by` | EnrollmentStatusRequest | **person** (real FK) — acting teacher | `central_requested_by_id` |
| `EnrollmentStatusRequest.reviewed_by` | EnrollmentStatusRequest | **person** (real FK) — acting coordinator/principal | `central_reviewed_by_id` |
| `EnrollmentStatusRequest.organization` | EnrollmentStatusRequest | — (Org FK) | `tenant_id` + `central_org_id` |
| `EnrollmentSnapshot.organization` | EnrollmentSnapshot | — (Org FK) | **not touched** — no live endpoint exposes this model at all (confirmed by grep — analytics-only, populated out-of-band); adding unused columns would be scope creep, flagged instead |
| `Student`/`EnrollmentEvent`/etc. `student` FKs | various | **domain** (the profile itself / its own history rows) | left as-is |
| `Student.campus`/`.classroom`/`.last_classroom` | Student | **domain** | left as-is; `PrimaryKeyRelatedField` blind spot fixed (see below) |
| `guardian_name`/`guardian_cnic`/`guardian_contact`/`father_*`/`mother_*` | Student | **domain data** — plain `CharField`/`PhoneNumberField`, confirmed NOT a `users.User` FK or any identity reference | left entirely untouched, exactly as the prompt specified |
| `EnrollmentStatusRequestSerializer.student` (writable PK field) | serializer | points at `Student` (`StudentManager` blind spot) | **checked, not fixed** — grepped every usage; this serializer is only ever instantiated read-only (`Serializer(qs, many=True).data` / `Serializer(req).data`) across all 7 call sites in `views.py`, never `.save()`'d — no live write path exists through it |

Migration: one additive migration
(`students/migrations/0013_enrollmentevent_central_created_by_id_and_more.py`)
covering all central-id/tenant columns across `Student`/`EnrollmentEvent`/
`EnrollmentStatusRequest`. Applied clean; `makemigrations --check --dry-run`
confirms no further `students`-app changes pending.

## The C5-class hazard, checked for up front — confirmed present in THREE places

Per the prompt's explicit re-check instruction: **`Student` had no
`all_objects` at all** (only `StudentManager(OrganizationManager)` — even
`with_deleted()`/`only_deleted()` still route through
`super().get_queryset()`, i.e. still org-filtered — there was no unfiltered
bypass whatsoever). Added. **`FormOption` also had none** — found via
reasoning through `form_options` (students/views.py), which calls
`FormOption.objects.get_or_create(...)` on every request to seed missing
dropdown-choice defaults; without a bypass, the blind-spotted `.objects`
manager would never see rows the previous call's `create()` just inserted
(INSERTs aren't filtered by a manager's `get_queryset()`, only SELECTs
are), re-inserting duplicates on every single call until the
`(organization, category, value)` unique constraint started throwing
`IntegrityError`. Found by reasoning through the manager chain (not
triggered live, to avoid the same risk C5's `assign_teacher` hang
demonstrated the cost of triggering blind). Added `all_objects` to both.

**Also checked**: `Campus`/`Level`/`Grade` (vendored from campus-service)
still have **no** `all_objects` on `main` (the C5 phase that added it lives
on its own unmerged branch, not visible from here) — `Campus._base_manager`
is used instead wherever this phase touches it (serializer's `campus`
field, `find_principal`'s campus resolution), the same not-tenant-scoped
caveat `_find()` already carries for Teacher/Coordinator/Principal.
`ClassRoom` already had `all_objects` on `main` (pre-existing, confirmed
before use) — used directly, no workaround needed there.

## Dual role-classes — legacy delegates to the ORIGINAL classes unchanged

`IsStudent`/`IsTeacherOrAbove`/`IsCoordinatorOrAbove`/`IsSuperAdminOrPrincipal`/
`HasDynamicPermission` (`student_service/dual_auth.py`) — legacy branch of
every one of these **imports and delegates to the original
`users.permissions` class directly** (`_LegacyIsStudent().has_permission(...)`,
etc.), not a reimplementation — the most literal form of "unchanged" C6
established with `get_coordinator`.

Central branch, per class:
- `IsStudent`: `find_student(user) is not None` — the strongest available
  signal (an actual resolved local record), not just the token's
  `person_type` claim.
- `IsTeacherOrAbove`: `is_superadmin` or a resolvable teacher/coordinator/
  principal. `admin`/`org_admin`/`accounts_officer`/`donor` (part of the
  legacy role list) have no local table or claim to resolve against —
  **flagged, fails closed**.
- `IsCoordinatorOrAbove`: `is_superadmin` or resolvable coordinator/
  principal. `org_admin` — same flagged gap.
- `IsSuperAdminOrPrincipal`: `is_superadmin` or resolvable principal.
  `admin`/`org_admin` — same flagged gap.
- `HasDynamicPermission`: `is_superadmin` bypass; else checks
  `view.required_permission` against the central catalog via
  `user.has_perm(codename)` if the view sets one, else allows (matching
  legacy's own "no permission specified → allow" fallback). **Found**:
  `StudentBulkUploadView`/`StudentBulkUploadTemplateView`'s
  `required_permission = 'add_student'` is a legacy Django-style codename,
  not an `sms.*` central catalog entry — `user.has_perm('add_student')`
  will not match for any non-superadmin central token. Not renamed (not
  this phase's call to invent/rename catalog permissions) — the resulting
  behavior (only superadmin/principal get through, via the `|
  IsSuperAdminOrPrincipal` half) is a safe, correct fail-closed outcome,
  flagged here for a future catalog-alignment pass.

## Endpoint → permission map

| Endpoint | Legacy gate | Central gate |
|---|---|---|
| `students/my-profile/`, `students/upload-photo/` | `IsStudent` | `IsStudent` (central_user_id match) + `DualServiceSubscribed` |
| `StudentViewSet` (list/retrieve/CRUD) | `IsTeacherOrAbove \| IsStudent` | same classes, dual-safe + `DualServiceSubscribed` |
| `students/bulk-upload/`, `bulk-upload-template/` | `IsSuperAdminOrPrincipal \| HasDynamicPermission` | same (fails closed to superadmin/principal — see `add_student` note above) + `DualServiceSubscribed` |
| `enrollment-requests/mine/` | `IsTeacherOrAbove` | same, dual-safe + `DualServiceSubscribed` |
| `enrollment-requests/pending/`, `/approve/`, `/reject/` | `IsCoordinatorOrAbove` | same, dual-safe + `DualServiceSubscribed` |
| `enrollment-kpis/` | `IsAuthenticated` only | unchanged gate; **not fully dual-safed** — already crash-safe (uses `getattr(...,None)`/`callable()` guards that happen to no-op cleanly for `CentralAuthUser`), but returns empty/zeroed KPIs for a central-auth caller today (`Student.objects` blind spot, not worth a bespoke fix for a stats-only endpoint outside this phase's explicit test plan) — **flagged**, not fixed. |

Central auth's catalog (`permissions.sms_catalog.SMS_PERMISSIONS`) has no
student-shaped permission entries at all beyond the pre-existing
`add_student` mismatch noted above — no new catalog entries invented.

## The `PrimaryKeyRelatedField` blind spot — found in `StudentSerializer`

`organization`/`campus`/`classroom` are writable `PrimaryKeyRelatedField`s
DRF auto-derives from the model FKs, each built from that model's OWN
`.objects` (`OrganizationManager`-backed, blind for central-auth). Fixed
with the standard `__init__`-override pattern: `Organization.all_objects`,
`ClassRoom.all_objects` (both available), `Campus._base_manager` (no
`all_objects` on `main` — see above). `enrollment_events`
(`EnrollmentEventSerializer(many=True, read_only=True)`, the reverse-accessor
shorthand C6 found a blind spot in for a *different* model) — **checked,
no fix needed**: `EnrollmentEvent` uses Django's plain default manager, not
`OrganizationManager` (confirmed by reading `students/models.py` — no
`objects = OrganizationManager()` line on that class at all), so there's
no blind spot to work around here.

## `perform_create` — central-auth branch, with a flagged consequence

`StudentViewSet.perform_create()`'s `user.is_superadmin()` call would
`TypeError` for a `CentralAuthUser` (`is_superadmin` is a bool attribute,
not a method, on that class) — fixed with an `isinstance` branch. Central
branch skips organization/quota enforcement (no local `Organization`
reliably correlates to a central-auth tenant — same gap as C7's
notification fan-out) and stamps `tenant_id` instead. **Flagged
deliberately, not fixed**: `_ensure_student_user_account` (which
provisions a *legacy* `users.User` login, username=student_id, default
password `12345`) is skipped entirely for a central-auth-created student —
running it would leave a dangling, unused, default-password legacy account
nobody needs. A central-auth-created student's real login (a
`NonStaffIdentity`) would need to be created centrally (a B2-style import)
and then linked via `remap_central_user_ids` — no live path for that exists
yet, out of scope here (touches only student-service).

## `StudentViewSet.get_queryset()`/`get_object()` — full central-auth branch

Rebuilt from `Student.all_objects` + `central_tenant_qs` (the legacy
`queryset` variable is `Student.objects`-based and therefore already blind
for this token type — reusing it would silently return nothing).
Per-tier resolution, in order: superadmin (tenant-scoped, full access) →
principal (`find_principal`, campus-filtered) → teacher (`find_teacher` +
the *same* `_get_teacher_classroom_ids`/`_get_result_student_ids` helpers
the legacy path already uses, given a plain employee_code string instead
of a user object — a minimal, backward-compatible signature widening,
verified to not change legacy call behavior at all) → coordinator
(`find_coordinator` + local level/classroom resolution, same shape) →
student (`central_user_id` match — the core IDOR boundary). `admin`/
`org_admin` — no local resolution, fail closed to `cqs.none()`, flagged.
`get_object()` mirrors this per-object (including the `destroy` action's
raw-fetch path, which bypasses `get_queryset()` entirely in both the
legacy and central code — re-validated explicitly rather than assumed
safe).

## Enrollment-request views — dual-safed

`TeacherEnrollmentRequestListView`: legacy `requested_by_id=user.id`
(an int FK) can't be compared against a central-auth UUID — central branch
filters `central_requested_by_id=user.id` instead (tenant-scoped). **Flagged**:
no live central-auth *create*-request endpoint exists in this phase's
routed surface, so `central_requested_by_id` has no write path yet — same
"schema ready, write path not built" pattern as every prior phase's
"some other person" central-id columns.
`CoordinatorEnrollmentRequestListView`/`Approve`/`Reject`: `Coordinator.get_for_user(user)`
reads `user.username`/`.email` (don't exist in that shape on
`CentralAuthUser`) and is `.objects`-backed — central branch uses
`find_coordinator`/`find_principal` instead. Approve's `Student.change_status(...,
user=None)` call (the shared method also used by legacy, left
byte-identical) is followed by a small explicit stamp of the just-created
`EnrollmentEvent.central_created_by_id` — extending `change_status()`'s own
signature was avoided since it's shared, unmodified code.

## Proof on synthetic data

Environment: `postgres-student`/`student-service` already running from
prior work in this session (not a first-time bring-up); `auth-service`
already running.

Synthetic fixtures: 2 local `users.User` rows (explicit `id=900001`/`900002`,
to control the exact `legacy_user_id` match) + 2 `Student` rows pointing at
them (`central_user_id` initially NULL) in student-service; 2
`NonStaffIdentity` rows in auth-service with matching `legacy_user_id`; one
`Employee` (teacher-shaped, local `teachers.Teacher` row created to match
by email) for the teacher-tier/permission proof; one superadmin-flagged
token (reusing the teacher Employee's identity with `is_superadmin=True`
via `generate_access_token`'s kwarg passthrough); one `Employee` under a
VMS-only tenant (no `sms` subscription) for the subscription-gate check.

```
remap_central_user_ids --dry-run  -> Matched: 0 (before linking)
remap_central_user_ids             -> Matched: 2, Unmatched: 0
DB: Student(id=1).central_user_id == NonStaffIdentity A's own UUID (exact)
    Student(id=2).central_user_id == NonStaffIdentity B's own UUID (exact)
```

**The core self-service IDOR proof:**
```
GET /api/students/my-profile/  (A's token) -> 200, student_id=C8STU-A
GET /api/students/my-profile/  (B's token) -> 200, student_id=C8STU-B
GET /api/students/1/  (A's token, A's own id)          -> 200
GET /api/students/2/  (A's token, B's id)               -> 404 [not 500, not leaked]
GET /api/students/2/  (B's token, B's own id)           -> 200
GET /api/students/1/  (B's token, A's id)               -> 404
PATCH /api/students/2/ (A's token, B's id, {"name":"HACKED"})  -> 404 (write blocked identically to read)
PATCH /api/students/1/ (A's token, own id, valid name)          -> 200, applied correctly
```

**Teacher-gated endpoint tier check:**
```
GET /api/students/enrollment-requests/mine/ (teacher token)  -> 200, []
GET /api/students/enrollment-requests/mine/ (student token)  -> 403
```

**Permission / subscription gates:**
```
GET  /api/students/ (VMS-only tenant token, no sms subscription) -> 403
POST /api/students/bulk-upload/ (teacher token, no add_student perm, not principal) -> 403
GET  /api/students/bulk-upload-template/ (superadmin token) -> 200
```

**Legacy dual-run still works** (raw HS256 token, `role=student`,
`username=C8STU-A` matching the synthetic student's `student_id` —
required setting `organization_id=5` on the synthetic Student to satisfy
`OrganizationManager`'s org-scoping, matching the token's `org_id` claim —
a test-fixture gap, not a code bug, same class as C6's equivalent note):
```
GET /api/students/my-profile/  (legacy token) -> 200, C8STU-A (Student.user OneToOne path, untouched)
GET /api/students/1/  (legacy token, own id, same org)   -> 200
GET /api/students/2/  (legacy token, B's id, different org) -> 404
```

All synthetic data (2 `Student`s, 2 local `users.User`s incl. one
signal-auto-created account, 1 `Teacher`, 1 `Organization`, 2 `Employee`s,
2 `NonStaffIdentity`s) deleted after verification — confirmed via direct
row-count queries (`0` across every synthetic table) post-cleanup.

## An unrelated pre-existing drift, found but explicitly NOT fixed

`makemigrations --check --dry-run` flags a pending migration for the
vendored `teachers` app (`TeacherSubjectAssignment`, presumably added to
staff-service's real `teachers` app by an earlier, unrelated phase, never
synced into student-service's own `teachers_student_migrations` history).
Attempted to apply it to unblock synthetic-Teacher cleanup — the
generated migration has a hard dependency on a `timetable` app that isn't
installed in student-service at all (`ValueError: Dependency on unknown
app: timetable`), confirming this is a genuine cross-app coupling issue
unrelated to central-auth, out of scope, and not safely fixable from
here. Reverted the generated migration file immediately. Cleaned up the
blocking synthetic Teacher row via a direct SQL `DELETE` instead (bypasses
Django's ORM cascade-collector, which is what was hitting the missing
table). Confirmed pre-existing and unrelated to this phase by inspection
of the dependency chain, not merely assumed.

## Proof VMS/HDMS unchanged

```
manage.py check (auth_service)     -> System check identified no issues (0 silenced)
manage.py check (student-service)  -> System check identified no issues (2 silenced)
POST /api/auth/login-vms (nonexistent employee_code)
  -> 401 {"error": "invalid_credentials", "detail": "Employee code not found or account inactive"}
```

Central-auth suite: `5 failed, 66 passed, 25 errors` — identical to every
prior phase's baseline, same pre-existing causes, no new failures or
errors. student-service has no exercised test suite (`manage.py test
students` finds zero tests — consistent with every SMS service checked so
far).

## Confirmed untouched

- `central_auth/authentication.py`, `jwks.py`, `permissions.py`,
  `tenant.py`: byte-identical to the C1-C7 template (no local `requests`
  app collision here — confirmed, standard `requests`-based `jwks.py` used).
- `users.permissions`'s original `IsStudent`/`IsTeacherOrAbove`/
  `IsCoordinatorOrAbove`/`IsSuperAdminOrPrincipal`/`HasDynamicPermission`:
  not modified — every dual class delegates to them directly for the
  legacy branch.
- `Coordinator.get_for_user`, `Student.change_status()`: called unchanged
  on their respective paths, not reimplemented.
- `teachers.Teacher`, `coordinator.Coordinator`, `principals.Principal`,
  `campus.Campus`, `classes.ClassRoom`/`Level`/`Grade` (vendored, other
  services' own models): not modified — worked around via
  `_base_manager`/`all_objects` exactly as C3/C5/C6 established.
- `guardian_*`/`father_*`/`mother_*` fields: confirmed plain `CharField`/
  `PhoneNumberField` domain data, not identity references — left entirely
  untouched, per the prompt's explicit instruction.
- Every other SMS service, VMS, HDMS, central auth's own code: untouched.
- The legacy `Student.user` OneToOne / session/org path: proven working
  unchanged end-to-end (dual-run proof above).

## What's next

C9 is next, separately, per the 13-service plan. Also open, carried
forward: `sms.*` catalog has no student-shaped permissions at all (the
`add_student` legacy-codename mismatch flagged above needs a future
alignment pass); `central_created_by_id`/`central_requested_by_id`/
`central_reviewed_by_id` remain schema-ready but write-path-incomplete for
several actor positions (no live central-auth create-enrollment-request
endpoint yet); `EnrollmentSnapshot` central-id columns were deliberately
not added (no live endpoint at all); `enrollment-kpis/` returns
empty/zeroed data for central-auth callers (flagged, not fixed); `Campus`/
`Level`/`Grade` still have no `all_objects` on `main` (same residual gap
C5's own unmerged branch already addresses, just not visible from this
branch); the vendored `teachers` app's migration drift (unrelated,
found, reverted) is worth a dedicated look whenever staff-service/
timetable-service's relationship is next touched; and — same as every
prior phase — `Teacher`/`Coordinator`/`Principal`/`Campus` still have no
`tenant_id` of their own, so every `_base_manager`/`.all_objects` lookup
in this phase remains best-effort, not a tenant-scoped guarantee.
