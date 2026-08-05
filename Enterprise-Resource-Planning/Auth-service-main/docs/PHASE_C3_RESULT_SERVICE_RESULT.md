# Phase C3: Repoint result-service onto Central Auth — Result

Branch: `phase-c3-result-service` (not merged to `main`). Scoped to
`result-service/` only, per the prompt. Third of 13 — reused C1/C2's recipe
(`docs/PHASE_C1_CONTENT_SERVICE_RESULT.md`, `docs/PHASE_C2_FEES_SERVICE_RESULT.md`)
throughout; this doc records where result-service needed more than a
copy-paste — confirmed to be the most coupled of the three so far, exactly
as the prompt itself flagged going in.

## Template reuse — confirmed unchanged

`central_auth/` (4 files) copied from `fees-service/central_auth/` directly
(`cp`, then `diff -rq` against the source — zero output, byte-identical).
`SERVICE_CODE` was already `'sms'`. `result/dual_auth.py`'s
`DualAuthentication`/`DualServiceSubscribed`/`DualRequiresPermission` are the
same shape as C1/C2's versions — copied in spirit, unchanged logic.

## What's structurally different here vs C1/C2

Unlike content-service (one dynamic permission gap) and fees-service (one
dynamic permission system, two real FKs), result-service is gated almost
entirely by **five role-based permission classes**
(`IsTeacher`/`IsCoordinator`/`IsCoordinatorOrAbove`/`IsPrincipal`/`IsStudent`,
from the shared `users.permissions`), and central-auth tokens carry **no
role claim at all** — not even the gap-flagged `.role` attribute C1/C2 dealt
with; `CentralAuthUser` has no such attribute in any shape. Role for a
central-auth principal has to be *resolved*, not read.

**Resolution mechanism**: the exact same email/employee_code lookup
`views.py` already used to resolve a person's local `Teacher`/`Coordinator`/
`Principal` row for ANY token (`_get_teacher`/`_get_coordinator`/
`_get_principal`) — made dual-safe (see below) and reused as the source of
truth for "is this CentralAuthUser a teacher/coordinator/principal", instead
of inventing a parallel claims-based scheme. Staff vs student (Employee vs
NonStaffIdentity) is told apart by the JWT's `employee_id` claim: central
auth's `jwt_utils.generate_access_token()` only adds `employee_code`/
`employee_id` `if hasattr(user, 'employee_code')` — `NonStaffIdentity` (the
model backing SMS student identities since Phase B2) has no such attribute,
so a student token's `employee_id` claim is always empty. This is a
best-effort inference from token shape, not a claim read — flagged, since a
future phase adding a real `principal_type` claim would make it exact.

## Field-type audit (the recipe's step 2)

| Field | Type | Treatment |
|---|---|---|
| `Result.organization` | FK → `users.Organization` | mixin (`tenant_id` + `central_org_id`) |
| `SubjectMark.organization` | FK → `users.Organization` | mixin |
| `ResultEditRequest.organization` | FK → `users.Organization` | mixin |
| `MonthlyMarkConfig.organization` | FK → `users.Organization` | mixin |
| `RegionalBenchmark.organization` | FK → `users.Organization` | mixin |
| `Result.student` | real FK → `students.Student` | separate `central_student_id` (UUID) |
| `Result.teacher` | real FK → `teachers.Teacher` | separate `central_teacher_id` |
| `Result.coordinator` | real FK → `coordinator.Coordinator` | separate `central_coordinator_id` |
| `Result.approved_by_coordinator` | real FK → `coordinator.Coordinator` | separate `central_approved_by_coordinator_id` (own column — can differ from the reviewing `coordinator`) |
| `Result.approved_by_principal` | real FK → `principals.Principal` | separate `central_approved_by_principal_id` |
| `ResultEditRequest.teacher` / `.coordinator` | real FKs | own `central_teacher_id` / `central_coordinator_id` on this model |
| `RegionalBenchmark.uploaded_by` | real FK → `settings.AUTH_USER_MODEL` | separate `central_uploaded_by_id` — added for completeness; **not exercised**, `RegionalBenchmark` has no create/update endpoint in `views.py` today (read-only, via `services/regional_variance.py`) |
| `MonthlyMarkConfig` | no person FK | mixin only |

One additive migration (`0011_monthlymarkconfig_central_org_id_and_more`),
applied clean. The prompt's own "~6 Organization FKs" estimate was close —
5 confirmed in `models.py` (`Result`, `SubjectMark`, `ResultEditRequest`,
`MonthlyMarkConfig`, `RegionalBenchmark`); no 6th surfaced in `views.py`
either, consistent with C1/C2's plan estimates always being approximate,
not exact.

**Why `approved_by_coordinator`/`coordinator` get separate columns instead
of sharing one**: same root cause as C2's `Payment.received_by` — a
`CentralAuthUser` can't be assigned to a real Django FK (`ValueError`). Two
columns because the *reviewing* coordinator and the one who *ultimately
approved* are, in principle, independent fields on the model already.

## Role resolution — `result/dual_auth.py`

Built `DualIsTeacher`/`DualIsCoordinator`/`DualIsCoordinatorOrAbove`/
`DualIsPrincipal`/`DualIsStudent`, aliased over the original import names
(`from result.dual_auth import DualIsTeacher as IsTeacher, ...`) so every
existing `permission_classes = [IsAuthenticated, IsTeacher]`-style
declaration across `views.py` (~20 call sites) picked up the dual behavior
via one import-line change, with zero further edits to those lines.

- **Legacy branch**: byte-for-byte the original logic
  (`user.is_teacher()`/`.is_coordinator()`/`.is_principal()`/
  `.can_approve_requests()`/`.role == 'student'`), relocated unchanged.
- **Central-auth branch**: `user.has_service('sms')` AND a local DB match
  via `find_teacher`/`find_coordinator`/`find_principal` (email OR
  employee_code). `IsStudent`'s central branch is `has_service('sms') AND
  NOT` staff-shaped (no DB lookup needed or possible — see below).

Also added `user_is_teacher`/`user_is_coordinator`/`user_is_principal`/
`user_is_superuser`/`user_can_approve_requests` — dual-safe drop-ins for the
**raw** `user.is_teacher()` etc. calls `views.py` makes directly, not just
in `permission_classes` (`ResultViewSet.get_queryset`, `BulkApproveView`,
`BulkRejectView`) — sed-replaced at 8 call sites across those three classes.

**Pre-existing bug found, not touched**: `IsCoordinatorOrAbove`'s legacy
path calls `request.user.can_approve_requests()` — a method that exists on
the real `users.User` model but **not** on `_TokenUser` (the object
`ServiceJWTAuthentication` — the actual legacy authenticator wired into
this service — builds for every legacy request). Calling it today raises
`AttributeError` for any legacy token hitting `BulkApproveView`/
`PromoteStudentsView`/`BulkRejectView`. This predates C3 entirely (relocated
byte-for-byte, not introduced); out of scope to fix here.

## The identity-resolution gap that's real, not cosmetic: `Teacher`/`Coordinator`/`Principal` have no `tenant_id`

`find_teacher`/`find_coordinator`/`find_principal` (`dual_auth.py`) resolve
a CentralAuthUser's role by querying `Teacher`/`Coordinator`/`Principal`'s
`._base_manager` (bypassing the `OrganizationManager` blind spot — see
below) filtered by `email` OR `employee_code`. **This is NOT tenant-scoped.**
These models live in `staff-service` (out of scope to touch — no `tenant_id`
column exists there, and adding one is a staff-service-scoped change, not a
result-service one). Correctness today relies on email/employee_code being
globally unique, not on an explicit per-tenant filter. Same class of
residual gap as C2's flagged `PaymentViewSet.perform_create` — documented
in `dual_auth.py`'s `_find()` docstring, not silently left unmentioned. A
future staff-service repoint adding `tenant_id` there should close this.

The same reasoning applies to `ResultCreateSerializer`'s `student` field
(its auto-derived `PrimaryKeyRelatedField` queryset needed the same
`_base_manager`, unscoped-by-tenant swap — see below) — `Student` also
lives outside result-service.

## The `OrganizationManager` blind spot — pervasive here, fixed on every path the proof exercises

Same root cause as C1/C2: `OrganizationMiddleware`'s hardcoded legacy
`ServiceJWTAuthentication()` call never populates its contextvars for an
RS256 (central-auth) request, so every `Model.objects` (`Result`,
`SubjectMark`, `ResultEditRequest`, `Teacher`, `Coordinator`, `Principal`,
`Student`) silently returns empty on that path. Fixed via `_result_base_qs`/
`_edit_request_base_qs` (`Model.all_objects` + explicit `tenant_id` filter)
everywhere the proof plan's flows touch: `ResultViewSet`, `TeacherResultListView`,
`ResultSubmitView`, `CoordinatorResultListView`, `CoordinatorApproveResultView`/
`RejectView`, `PrincipalResultApprovalView`, `PrincipalApproveResultView`/
`RejectView`, `ResultApprovalView`, `StudentMyResultsView`, edit-request
views, `BulkApproveView`/`RejectView`, `PromoteStudentsView`.

**Found one level deeper than C1/C2 had to go**: `Teacher.assigned_coordinators`
is a `ManyToManyField` to `Coordinator` — Django's related manager for a
forward M2M uses the target model's **default manager**
(`Coordinator.objects`) under the hood, so `teacher.assigned_coordinators.exists()`/
`.first()` hit the exact same blind spot even though no code explicitly
wrote `Coordinator.objects` at that call site. Confirmed by direct
reproduction while building the synthetic-data proof: a real through-table
row existed (verified via raw SQL) but `.all()`/`.exists()` came back empty.
Fixed via `dual_auth.teacher_assigned_coordinators()` (queries the
M2M through-table directly, bypassing the manager) — applied at every call
site that gates *coordinator-assignment* itself (`TeacherResultListView.perform_create`,
`ResultCreateSerializer.create()`, `ResultSubmitSerializer.update()`,
`ResultViewSet.forward_class_results`); left as the original `.exists()`/
`.first()` on the legacy branch (unchanged — works correctly for real legacy
HTTP requests where `OrganizationMiddleware` **does** populate the
contextvar; it only read empty in a request-less `manage.py shell`, which is
where this was first noticed while wiring up test fixtures).

**Found and fixed in `ResultCreateSerializer` (not just `views.py`)**: two
independent bugs that only surface at the serializer layer, past every
`views.py` fix:
1. `ResultCreateSerializer.validate()`'s midterm-duplicate check used
   `Result.objects.filter(...)` directly — same blind spot, fixed inline.
2. `ResultCreateSerializer.create()` **entirely re-derives its own `teacher`**
   via `Teacher.objects.get(email=user.email)`, ignoring whatever
   `TeacherResultListView.perform_create` already resolved and passed via
   `serializer.save(teacher=teacher, ...)` — and separately does its own
   `user.organization`/`user.org_id` reads (crash: `CentralAuthUser` has
   **no** `.organization` attribute at all, not even `None` — direct access
   raises `AttributeError`, not just returns falsy) and its own
   `SubjectMark.objects.create(..., organization_id=user.org_id)` (same
   crash). Rewrote `create()`: reuse `validated_data['teacher']` if the view
   already set it; central-auth branch stamps `tenant_id`/`central_teacher_id`
   instead of `organization_id`/`user.org_id` throughout, including on the
   created `SubjectMark` rows (which also got the `CentralAuthFieldsMixin`).
3. `ResultCreateSerializer.__init__` overridden so the `student` field's
   `PrimaryKeyRelatedField` queryset swaps to `Student._base_manager` for a
   `CentralAuthUser` — its auto-derived default (`Student.objects`) rejected
   every valid id with `"object does not exist"` (same blind spot, DRF
   validation layer this time, same class of gap as C2's flagged
   `PaymentViewSet.perform_create` serializer-level FK resolution issue).
4. `ResultSubmitSerializer.update()` had the same `teacher.assigned_coordinators`
   blind spot as (2) above — fixed the same way.

**Found and fixed, `StudentMyResultsView`**: resolved the requesting
student via `user.username` (crash — no such attribute on `CentralAuthUser`)
then a two-hop `LocalUser` → `Student.objects.filter(user_id=...)` lookup
(also blind-spot-affected). `Student.email` exists directly on the model —
central-auth branch resolves in one hop via `Student._base_manager.filter(email=user.email)`
instead. Also fixed `result.subject_marks.all()` (same M2M-adjacent blind
spot pattern as `assigned_coordinators` — a reverse FK accessor backed by
`SubjectMark.objects`) via a new `_subject_marks_for(result, user)` helper,
reused in `_handle_final_promotion` too.

## A bug found and explicitly NOT fixed: `retest`/`timetable` apps are absent from this Docker image, for BOTH token types

While proving `StudentMyResultsView` end-to-end, hit
`ModuleNotFoundError: No module named 'retest'` at `views.py`'s
`"has_pending_retest": RetestResult.objects.filter(...)` line — unconditional,
runs for every result regardless of subject-mark count. Confirmed via
`result-service/Dockerfile`: neither `retest` nor `timetable` (the app
backing `RESULT_LIST_PREFETCH_RELATED`'s `teacher__subject_assignments__subject`,
which crashed `with_result_relations()` — used by `ResultViewSet`'s
superuser branch and `CoordinatorResultListView` — with
`ValueError: Related model 'timetable.Subject' cannot be resolved`) is
copied into this service's image at all. **This is pre-existing and
identical for legacy and central-auth tokens** — confirmed by reproducing
the `with_result_relations()` crash with a plain legacy HS256 token too, not
just a central-auth one. Not fixed: closing it means adding `COPY` lines
for two more apps to `result-service/Dockerfile`, a real infra decision
outside "touch only what central-auth requires" and outside this
service-scoped phase. Flagged prominently rather than silently worked
around — the C3 proof below routes through endpoints that avoid these two
code paths (`CoordinatorApproveResultView` instead of
`CoordinatorResultListView`'s list view; a subject-mark-bearing result for
the create proof, a **separate, subject-mark-free** result for the student
read proof) to demonstrate the central-auth-specific mechanics are correct
independent of this unrelated gap.

## Proof on synthetic data

Environment: stack survived from C2 (25 containers) plus `postgres-result`/
`result-service` brought up fresh for the first time this phase (never
built/started in earlier phases). Docker Desktop restarted itself mid-session
(unrelated infra hiccup, not caused by this work) — all containers, volumes,
and DB state survived; re-verified `manage.py check` clean on both
`auth_service` and `ams_result` after.

Synthetic fixtures: 4 `Employee`s (teacher/coordinator/principal under
tenant `SMS School`; one more under the VMS tenant, deliberately **not**
sms-subscribed) + 1 `NonStaffIdentity` (student) in central auth; a local
Organization/Campus/Level/Grade/ClassRoom/Teacher/Coordinator/Principal/Student
chain in `result-service`'s own DB (its `teachers`/`coordinator`/
`principals`/`students`/`campus`/`classes` tables are local read-replica
copies of those services' data, kept in sync via a startup script — not a
cross-service DB connection).

```
POST /api/result/create/ (teacher token, monthly exam, 1 subject mark)
  -> 201 Created
  DB: central_teacher_id = <teacher's own central-auth UUID>, tenant_id =
      <SMS01 tenant>, organization_id = NULL, teacher_id/student_id = local
      FKs (unchanged shape). SubjectMark row: tenant_id stamped, matching.

POST /api/result/create/ (student token — role-gated) -> 403
GET  /api/result/student/my-results/ (student token, no approved results
      yet) -> 200 []

POST /api/result/create/ (principal token, teacher-only endpoint) -> 403
GET  /api/result/principal/stats/ (principal token) -> 200 {...}
GET  /api/result/principal/stats/ (teacher token) -> 403

POST /api/result/create/ (VMS-tenant employee token — no sms subscription)
  -> 403 "You do not have permission to perform this action."
```

**Tenant isolation** (`Result`, second row tagged directly to a different
tenant, same local `teacher`/`student` FKs on purpose — proves the isolation
is on `tenant_id`, not on the local FK match):
```
Result(tenant_id=SMS01) + Result(tenant_id=VMS_TENANT), same teacher/student
GET /api/result/my-results/ (SMS01 teacher token)
  -> only the SMS01-tagged result returned (count: 1, not 2)
```

**Legacy dual-run still works** — raw HS256 token (`ams_shared.jwt.validator`
shape, `role='teacher'`):
```
GET /api/result/my-results/ (legacy token) -> 200 []
  (correctly does NOT see the central-auth-created row — organization_id=NULL
  doesn't match the legacy token's org_id, proving the two write-paths are
  cleanly separated, not a leak)
```

**End-to-end approval flow, teacher -> coordinator** (central-auth,
monthly exam type — fully approved by coordinator alone per existing
business logic):
```
PATCH /api/result/<id>/submit/ (teacher token) -> 200, status=pending_coordinator
POST  /api/result/coordinator/approve/<id>/ (coordinator token, {"comments":"looks good"})
  -> 200 {"message": "Result approved successfully.", "status": "approved"}
  DB: central_approved_by_coordinator_id = <coordinator's own central-auth
      UUID>, approved_by_coordinator_id = <local FK, unchanged shape>
```

All synthetic data (4 Employees, 1 NonStaffIdentity, 3 Results + 1
SubjectMark, and the full local Teacher/Coordinator/Principal/Student/
Campus/Level/Grade/ClassRoom/Organization chain) deleted after verification.

## Proof VMS/HDMS unchanged

```
manage.py check (auth_service)  -> System check identified no issues (0 silenced)
manage.py check (ams_result)    -> System check identified no issues (2 silenced)
POST /api/auth/login-vms (real employee_code, wrong password)
  -> 401 {"error": "invalid_credentials", "detail": "Incorrect password"}
  (endpoint round-trips correctly end-to-end; seeded password unknown to
  this session, same limitation as any run without the original credentials)
```

Central-auth suite: `5 failed, 66 passed, 25 errors` — same 5
pre-existing failures and 25 pre-existing errors as every prior phase's
baseline (`dept_sector` fixture cause); passed-count differs slightly from
C1/C2's `64` because more Employee/Subscription rows now exist in this
environment from three phases of synthetic-data proofs — not a regression,
no new failures or errors appeared. result-service has no test suite
(`manage.py test result` finds zero tests, consistent with every SMS
service checked so far).

## Confirmed untouched

- `central_auth/authentication.py`, `jwks.py`, `tenant.py`: byte-identical
  to the C1/C2 source.
- `ams_shared/jwt/validator.py`, `users/middleware.py`,
  `users/permissions.py` (shared across services): not modified — every
  `Dual*` class is new, in `result/dual_auth.py`; the originals
  (`IsTeacher`, `IsCoordinator`, etc.) are untouched and still used exactly
  as before by anything importing them directly (nothing else in this repo
  does).
- `Teacher`/`Coordinator`/`Principal`/`Student`/`Campus`/`ClassRoom` models
  themselves (staff-service/student-service/campus-service): not modified —
  only `result-service`'s own `models.py`/`views.py`/`serializers.py`/
  `dual_auth.py` changed.
- Every other SMS service, VMS, HDMS, central auth's own code: untouched.
- The legacy local-`User`/session/org path: proven working unchanged
  (dual-run proofs above).

## What's next

C4 is next, separately, per the 13-service plan. Also open, carried
forward for whoever repoints `staff-service`/`student-service`: adding
`tenant_id` to `Teacher`/`Coordinator`/`Principal`/`Student` so
`dual_auth.py`'s `find_teacher`/`find_coordinator`/`find_principal` and
`ResultCreateSerializer`'s student-FK resolution can be properly
tenant-scoped instead of relying on email/employee_code uniqueness. Also
open: the pre-existing `IsCoordinatorOrAbove`/`_TokenUser.can_approve_requests()`
gap, and the `retest`/`timetable` apps missing from `result-service`'s
Dockerfile (affects legacy and central-auth identically — a Dockerfile
change, not an auth one).
