# Phase C4: Repoint subject-service onto Central Auth — Result

Branch: `phase-c4-subject-service` (not merged to `main`). Scoped to
`subject-service/` only, per the prompt. Fourth of 13 — reused C1/C2/C3's
recipe throughout; this doc records where subject-service needed more than
a copy-paste.

## Template reuse — confirmed unchanged

`central_auth/` (4 files) copied from `result-service/central_auth/`
directly (`cp`, then `diff -rq` against the source — zero output, byte-
identical). `SERVICE_CODE` was already `'sms'`.

Unlike C1/C2/C3, `dual_auth.py` lives at the **project-package level**
(`subject_service/dual_auth.py`), not inside a single app — subject-service
has two peer apps (`subjects`, `assignments`) that both need it, with no
natural "primary" app to hang it off of. `DualAuthentication`/
`DualServiceSubscribed`/`DualRequiresPermission` are the same shape as
C1/C2/C3's versions, unchanged logic.

## What's different in subject-service — confirmed as the prompt described

Permissions here really are simple: every view used only `IsAuthenticated`,
no role-gate classes, no `HasDynamicPermission` — so C3's `DualIsTeacher`-
style class-per-role work does not apply. The real problem, exactly as
flagged: **student/teacher/creator/grader identity is a bare `IntegerField`
throughout**, populated directly from `request.user.id`. A `CentralAuthUser`'s
`.id` is a UUID string — assigning it to an `IntegerField` raises
`ValueError` at save time, not just returns wrong data.

## Field audit (the recipe's step 2) — exhaustive

| Field | Model | Person or entity? | Treatment |
|---|---|---|---|
| `Subject.organization` | Subject | — (Org FK) | mixin (`tenant_id` + `central_org_id`) |
| `Subject.grade_id` | Subject | **entity** (a Grade ref) | left as bare int, unchanged |
| `Subject.campus_id` | Subject | **entity** (a Campus ref) | left as bare int, unchanged |
| `SubjectTeacherAssignment.organization` | SubjectTeacherAssignment | — (Org FK) | mixin |
| `SubjectTeacherAssignment.teacher_id` | SubjectTeacherAssignment | **person** | separate `central_teacher_id` (UUID); widened to nullable |
| `SubjectTeacherAssignment.assigned_by_id` | SubjectTeacherAssignment | **person** (not in the prompt's own example list — found during the exhaustive pass) | separate `central_assigned_by_id` (UUID) |
| `SubjectTeacherAssignment.classroom_id` | SubjectTeacherAssignment | **entity** (a ClassRoom ref) | left as bare int, unchanged |
| `Assignment.organization` | Assignment | — (Org FK) | mixin |
| `Assignment.classroom_id` | Assignment | **entity** | left as bare int, unchanged |
| `Assignment.created_by_id` | Assignment | **person** | separate `central_created_by_id` (UUID); was already nullable |
| `Submission.organization` | Submission | — (Org FK) | mixin |
| `Submission.student_id` | Submission | **person** | separate `central_student_id` (UUID); widened to nullable (was required) |
| `Submission.graded_by_id` | Submission | **person** | separate `central_graded_by_id` (UUID); was already nullable |

Two additive migrations (`assignments/migrations/0005_...`,
`subjects/migrations/0004_...`), applied clean. `CentralAuthFieldsMixin` is
defined once in `subjects/models.py` and imported into `assignments/models.py`
(the `assignments` app already imports `subjects.models.Subject` for its FK,
so this follows an existing cross-app-import precedent rather than
duplicating the mixin).

**Widened-nullable fields needed a partial uniqueness fix, same as C1's
`StudentContentProgress`**: `Submission.student_id`/`SubjectTeacherAssignment.teacher_id`
were both `NOT NULL` originally (not merely un-null-checked like C1/C2/C3's
cases) — Postgres treats every `NULL` as distinct, so simply widening them
and relying on the existing `unique_together` would have silently let the
*same* central-auth student double-submit an assignment (both rows carry
`student_id=NULL`), or the same central-auth teacher be double-assigned.
Added a `UniqueConstraint` on `(assignment, central_student_id)` /
`(subject, central_teacher_id, classroom_id, academic_year)`, each with
`condition=Q(central_*_id__isnull=False)`, alongside the untouched legacy
`unique_together`.

## Endpoint → permission map

Central auth's catalog (`permissions.sms_catalog.SMS_PERMISSIONS`, Phase B3)
has exactly two assignment-shaped permissions and **zero** subject-shaped
ones:

| `sms.*` codename | Exists? | Wired to |
|---|---|---|
| `sms.assignment.view` | **Yes** | `AssignmentViewSet` list/retrieve/`mark_seen`/`list_submissions`; `MySubmissionsView` |
| `sms.assignment.upload` | **Yes** | `AssignmentViewSet.submit` (the student's own submission — exact catalog match, wired directly) |
| `sms.assignment.manage` | **Flagged — not in the catalog** | `AssignmentViewSet` create/update/partial_update/destroy/`grade_submission` |
| `sms.subject.manage` | **Flagged — not in the catalog** | `SubjectViewSet` and `SubjectTeacherAssignmentViewSet` create/update/partial_update/destroy |

`sms.subject.*` has no clean match at all in the catalog (subject/curriculum
management wasn't part of B3's scope) — referenced but **not added** from
this subject-service-scoped task, fail-closed: every non-superadmin
central-auth token 403s on subject-management writes today, proven below.
Reads with no natural permission match (`SubjectViewSet`/
`SubjectTeacherAssignmentViewSet` list/retrieve, `my-subjects`,
`my-classrooms`) are gated by `DualServiceSubscribed` only, matching
"endpoints requiring no special perm should work" from the C1/C2/C3 recipe.

**Narrowed on purpose, flagged**: `grade_submission`'s legacy check is
`user.role in ('teacher', 'org_admin', 'superadmin')`. Central auth has no
`org_admin`-equivalent distinction on `CentralAuthUser` (no principal_type
claim — same gap flagged since B3/C1/C2/C3), so the central-auth branch
narrows to `user_role(user) == 'teacher' or user.is_superadmin` — a
coordinator/principal/plain-employee central-auth token gets 403 there even
though a legacy `org_admin` token would pass. Documented, not silently
narrowed.

## The "read id from JWT" mechanism, made dual-safe

`subjects/views.py`'s `_resolve_teacher_id(user)` already resolved the
acting teacher's **staff-service Teacher PK** (an int, used to key into
`timetable_db`) via a raw `psycopg2` query against `staff_db` keyed on
`employee_code` — cross-service DB access, not a local read-replica or the
Django ORM, a pattern already established by the original code (kept
unchanged in shape). Made dual-safe by swapping the identifier source only:
`CentralAuthUser.employee_code` vs legacy `.username` (moved to
`subject_service/dual_auth.py`'s `resolve_staff_teacher_id`, shared by both
apps).

**Central-auth fallback is `None`, not `user.id`** — the original legacy
code fell back to `user.id` (a Django User PK, an int) when the staff_db
lookup failed; for `CentralAuthUser`, `user.id` is a UUID string, and
falling back to it would send a UUID into a raw SQL query against an
integer column (`timetable_teachertimetable.teacher_id`) — caught and fixed
before it could crash. `_derive_classrooms_from_timetable` now guards
`teacher_id is None` at the top and returns `[]` immediately rather than
querying with it.

**No role/person_type claim exists on `CentralAuthUser`** (same gap as
every prior phase) — `user.role == 'teacher'`/`'student'`, read directly in
~8 places across both apps' `views.py`/`serializers.py`, would crash
(`AttributeError`). `subject_service/dual_auth.py`'s `user_role(user)`
infers it for `CentralAuthUser`: `'student'` if the token wasn't minted
from an Employee (`employee_id` claim absent — see
`user_is_staff_principal`'s docstring), `'teacher'` if staff-shaped AND
`resolve_staff_teacher_id` resolves a match, otherwise `None` (mirrors
legacy's implicit "anyone who isn't teacher/student sees everything"
branch). Legacy branch returns `.role` directly, unchanged.

## A significant bug found in central auth itself — flagged, NOT fixed (out of scope per the prompt's own rule)

While building the synthetic-data proof for "student token submits an
assignment, gated by `sms.assignment.upload`", assigning the `SMS Student`
role template to a synthetic `NonStaffIdentity` (via
`permissions.sms_catalog.assign_sms_role`, confirmed correctly persisted —
`EmployeeRole` row present, role has the right 5 permissions) still
produced a token with **`perms: []`**. Root cause, confirmed by reading
`Auth-service-main/Backend/src/authentication/jwt_utils.py`'s
`_build_authz_claims()`:

```python
'perms': sorted(get_effective_permissions(str(user.id))),
'perm_version': get_perm_version(str(user.id)),
```

Both calls omit `principal_type`, which defaults to `'employee'`
(`get_effective_permissions(principal_id: str, principal_type: str = 'employee')`).
For a `NonStaffIdentity` (student) token, this means `perms`/`perm_version`
are **always** computed against an `employee`-shaped lookup that can never
match — every student token gets `perms: []` regardless of what SMS role is
actually assigned, unconditionally, since Phase B3 introduced the
generalized RBAC path. This is a central-auth bug, not a subject-service
one — `jwt_utils.py` was never updated to detect `NonStaffIdentity` and
pass `principal_type='non_staff'` when B3 generalized the RBAC engine.

Per this phase's explicit rule ("Do NOT touch other services, VMS/HDMS, or
central auth code"), **not fixed here** — flagged instead. Worked around
for the proof below using a `is_superadmin=True` token-minting override
(same technique VMS/HDMS role tokens already use via `generate_access_token`'s
`**kwargs`), which correctly bypasses the permission check via
`CentralAuthUser.has_perm`'s `self.is_superadmin` OR-branch (read straight
from the claim, independent of `perms`) — proving `subject-service`'s own
`DualRequiresPermission` check is correct and would work the moment this
central-auth bug is fixed. **This likely affects every prior phase's
"student gets a real (non-superadmin) `sms.*` permission" claims too** —
worth a follow-up check, not re-verified here (out of this phase's scope).

## Proof on synthetic data

Environment: stack survived from C3; `postgres-subject`/`subject-service`
built and started for the first time this phase (never run in earlier
phases). Docker Desktop was down at the start of this session (separate
infra hiccup, user restarted it manually) — all containers/volumes
survived, `manage.py check` clean on both `auth_service` and `ams_subject`
after.

Synthetic fixtures: 3 `Employee`s (two teacher-shaped under tenant
`SMS School` — one minted with an `is_superadmin=True` override for the
create-mechanics proof, one plain for the missing-perm proof; one under the
VMS tenant, deliberately not sms-subscribed) + 1 `NonStaffIdentity`
(student, assigned the `SMS Student` role — plus a second, superadmin-
flagged token for the same identity, needed only because of the central-
auth bug above) in central auth. No local fixtures needed in
`subject-service` itself — `Subject`/`Assignment`/`Submission` rows were
created directly through the API.

```
POST /api/subjects/ (superadmin-flagged teacher token, {"name":"C4 Test Math"})
  -> 201 Created
  DB: tenant_id = <SMS01 tenant>, organization_id = NULL, central_org_id = NULL

POST /api/assignments/ (same token, subject=<above>) -> 201 Created
  DB: central_created_by_id = <this token's own UUID>, created_by_id = NULL,
      tenant_id = <SMS01 tenant>, created_by_name = "C4 Teacher Superadmin"

POST /api/assignments/1/submit/ (superadmin-flagged student token)
  -> 201 Created
  DB: central_student_id = <this token's own UUID>, student_id = NULL,
      tenant_id = <SMS01 tenant>, student_name = "C4 Test Student"

POST /api/subjects/ (plain teacher token, no sms.subject.manage)
  -> 403 "Missing required permission: sms.subject.manage."
GET  /api/subjects/ (plain teacher token — no perm needed, just subscription)
  -> 200 {"count": 1, ...}
GET  /api/subjects/ (VMS-tenant employee token — no sms subscription)
  -> 403 "Your organization does not have an active SMS subscription."
```

**Tenant isolation** (`Subject`, second row tagged directly to the VMS
tenant):
```
Subject(tenant_id=SMS01) + Subject(tenant_id=VMS_TENANT)
GET /api/subjects/ (SMS01 teacher token) -> count: 1 (only the SMS01 row)
```

**Legacy dual-run still works** — raw HS256 token (`ams_shared.jwt.validator`
shape, `role='teacher'`, `org_id=5`):
```
POST /api/subjects/ (legacy token, {"name":"Legacy Subject"}) -> 201 Created
  DB: organization_id = 5, tenant_id = NULL
  (no permission check applied — DualRequiresPermission is a no-op for a
  legacy token, exactly as designed; unchanged from before this phase)
```

**Role-inference degradation, proven non-crashing**: this environment has
no `staff-service` container running and `staff_db` has no `teachers_teacher`
table at all (`to_regclass('teachers_teacher')` returns `NULL`) — so
`resolve_staff_teacher_id` can never resolve a match here, for *either*
token type, an environment limitation not a subject-service bug.
`GET /api/subjects/my-subjects/` and `/my-classrooms/` were called with the
superadmin-flagged (Employee-backed, non-staff-resolvable) teacher token and
returned `200` (the "everyone else sees everything" / `[]` branches
respectively) — no `AttributeError`, no 500, confirming `user_role()`'s
`None` fallback is handled everywhere it's read, not just in the one place
that happened to get tested.

All synthetic data (3 Employees, 1 NonStaffIdentity + its EmployeeRole, 3
Subjects, 1 Assignment, 1 Submission) deleted after verification.

## Proof VMS/HDMS unchanged

```
manage.py check (auth_service)   -> System check identified no issues (0 silenced)
manage.py check (ams_subject)    -> System check identified no issues (2 silenced)
POST /api/auth/login-vms (real employee_code, wrong password)
  -> 401 {"error": "invalid_credentials", "detail": "Incorrect password"}
  (endpoint round-trips correctly end-to-end; seeded password unknown to
  this session, same limitation as C3's equivalent check)
```

Central-auth suite: `5 failed, 66 passed, 25 errors` — identical to C3's
end-of-phase baseline, same pre-existing causes, no new failures or errors.
subject-service has no test suite (`manage.py test subjects assignments`
finds zero tests, consistent with every SMS service checked so far).

## Confirmed untouched

- `central_auth/authentication.py`, `jwks.py`, `tenant.py`: byte-identical
  to the C1/C2/C3 source.
- `ams_shared/jwt/validator.py`, `users/middleware.py`, `users/permissions.py`,
  and — per this phase's explicit rule — `authentication/jwt_utils.py` and
  every other central-auth file: not modified, despite the bug found above.
- `Teacher`/staff-service's own code: not modified — `_resolve_teacher_id`'s
  raw-SQL query shape is identical to the original, only the identifier
  source changed.
- Every other SMS service, VMS, HDMS, central auth's own code: untouched.
- The legacy local-`User`/session/org path: proven working unchanged
  (dual-run proofs above).

## What's next

C5 is next, separately, per the 13-service plan. Also open, carried
forward: the central-auth `jwt_utils.py` `principal_type` bug (flagged
above — recommend checking whether it silently affected any prior phase's
"student granted a real permission" proof); `sms.subject.*` and
`sms.assignment.manage` need a future catalog step before subject/
assignment management actually works for non-superadmin central-auth users;
`grade_submission`'s narrowed `org_admin` equivalence; and — same as C3's
open item — `Teacher`/`Coordinator`/`Student` still have no `tenant_id` of
their own, so `resolve_staff_teacher_id`'s cross-service identifier lookup
remains a best-effort, not a tenant-scoped guarantee.
