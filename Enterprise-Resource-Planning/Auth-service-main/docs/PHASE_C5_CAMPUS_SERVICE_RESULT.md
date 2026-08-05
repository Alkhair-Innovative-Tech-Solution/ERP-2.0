# Phase C5: Repoint campus-service onto Central Auth — Result

Branch: `phase-c5-campus-service` (not merged to `main`). Scoped to
`campus-service/` only, per the prompt. Fifth of 13 — reused C1-C4's recipe
throughout; this doc records where campus-service needed more than a
copy-paste.

## Template reuse — confirmed unchanged

`central_auth/` (4 files) copied from `subject-service/central_auth/`
directly (`cp`, then `diff -rq` against the source — zero output, byte-
identical). `SERVICE_CODE` was already `'sms'`. `campus_service/dual_auth.py`
lives at the project-package level (same reasoning as C4's
`subject_service/dual_auth.py`) — `campus`/`classes` are two peer apps, no
single "primary" one to hang it off.

## What's different in campus-service — confirmed as the prompt described

Permissions here are simple (`IsAuthenticated` only, no role-gate classes —
like C4, unlike C3). The prompt's own person-vs-domain split held up
exactly as described:

- **Person refs** (get a `central_*_id` UUID): `ClassRoom.class_teacher`
  (→ `teachers.Teacher`), `ClassRoom.assigned_by` (→ `users.User`),
  `Level.assigned_coordinator_id` (bare `PositiveIntegerField`, same
  bare-int gotcha as C1/C4).
- **Domain objects** (left alone): `Campus`, `Level`, `Grade`, `ClassRoom`
  themselves, and their `campus`/`grade`/`level` FKs — confirmed none of
  these got a central UUID column.

## Field audit (the recipe's step 2) — exhaustive

| Field | Model | Person or domain? | Treatment |
|---|---|---|---|
| `Campus.organization` | Campus | — (Org FK) | mixin (`tenant_id` + `central_org_id`) |
| `Level.organization` | Level | — (Org FK) | mixin |
| `Level.campus` | Level | **domain** (Campus ref) | left as-is |
| `Level.assigned_coordinator_id` | Level | **person** | separate `central_assigned_coordinator_id` (UUID) |
| `Grade.organization` | Grade | — (Org FK) | mixin |
| `Grade.level` / `Grade.campus` | Grade | **domain** | left as-is |
| `ClassRoom.organization` | ClassRoom | — (Org FK) | mixin |
| `ClassRoom.grade` | ClassRoom | **domain** | left as-is |
| `ClassRoom.class_teacher` | ClassRoom | **person** (real FK → `teachers.Teacher`) | separate `central_class_teacher_id` (UUID) |
| `ClassRoom.assigned_by` | ClassRoom | **person** (real FK → `users.User`) | separate `central_assigned_by_id` (UUID) — the one person-ref this phase could actually *populate* (see below) |

Two additive migrations (`campus/migrations/0004_campus_central_org_id_campus_tenant_id`,
`classes/migrations/0007_classroom_central_assigned_by_id_and_more`), applied
clean. `CentralAuthFieldsMixin` defined once in `campus/models.py`, imported
into `classes/models.py` (cross-app import, same pattern as C4's
`subjects`/`assignments`).

**Two flagged, unpopulated columns**: `central_assigned_coordinator_id`
(Level) and `central_class_teacher_id` (ClassRoom) both exist in the schema
but no write path in this phase populates them — `assign_coordinator`
accepts only a bare int `coordinator_id` from the client payload,
`assign_teacher` only a bare int `teacher_id`; neither endpoint has a
central UUID for *that other person* available to it (same class of gap as
C4's `SubjectTeacherAssignmentCreateSerializer.teacher_id` — the assigned
person isn't `request.user`, so `central_person_id(request.user)` doesn't
apply). `central_assigned_by_id` is different: `assigned_by` **is**
`request.user` (whoever is doing the assigning), so that one is correctly
stamped — proven below.

## A real bug found while wiring the recipe: `Campus`/`Level`/`Grade` had no `all_objects` manager

C1-C4's central-auth read path always uses `Model.all_objects` (the
unfiltered manager) + explicit `tenant_id` filtering. `ClassRoom` already
had `all_objects = models.Manager()` (pre-existing, for signals/internal
use), so it was easy to assume all four campus-service models did — they
didn't. `Campus`, `Level`, and `Grade` only had `objects = OrganizationManager()`.
Referencing `Campus.all_objects` in the first draft of `campus/views.py`
would have raised `AttributeError` on every central-auth request touching
those models. Caught immediately (first `POST /api/campus/` test — the
create actually returned 201 with `tenant_id: null` because the request
happened to take the *superadmin* branch, which doesn't touch
`all_objects` — the bug was latent, not yet triggered). Fixed by adding
`all_objects = models.Manager()` to all three — **not a schema change**
(a manager isn't a field, confirmed via `makemigrations --check --dry-run`
→ "No changes detected" both before and after).

## The DRF `PrimaryKeyRelatedField` blind spot — found again, same as C3/C4

`LevelSerializer.campus`, `GradeSerializer.level`/`.campus`, and
`ClassRoomSerializer.grade`/`.class_teacher` are all auto-derived
`PrimaryKeyRelatedField`s whose default queryset is the model's
`OrganizationManager`-filtered `.objects` — empty for a central-auth
request, rejecting every valid id with `"object does not exist"`. Fixed
with the same `__init__`-override pattern as C4's
`ResultCreateSerializer`: each serializer now swaps the relevant field's
`queryset` to `.all_objects.all()` (or `Teacher._base_manager.all()` for
`class_teacher`, since `Teacher` has no `all_objects` either and lives
outside this service) when `self.context['request'].user` is a
`CentralAuthUser`.

## A genuinely dangerous pre-existing bug found, NOT fixed (out of scope, two services removed)

Proving `assign_teacher` (the endpoint that stamps `central_assigned_by_id`)
**hung the entire gunicorn worker** until it was SIGKILLed
(`WORKER TIMEOUT` / `Perhaps out of memory?` in the container logs) partway
through the request. Root cause, traced to
`staff-service/teachers/signals.py`'s `_sync_class_teacher_to_campus_db`
(triggered by the `m2m_changed` signal on `Teacher.assigned_classrooms`,
which `assign_teacher` fires via `teacher.assigned_classrooms.add(classroom)`):
it opens a **second, raw `psycopg2` connection** to the *same*
`postgres-campus` database campus-service's own Django ORM is already
connected to, and runs `UPDATE classes_classroom SET class_teacher_id = ...`
against it — with a `connect_timeout=3` on the connection itself but **no
statement/lock timeout** on the query. This is pre-existing (this file
lives in `staff-service/`, copied unchanged into campus-service's Docker
image — not touched by this phase, and the mechanism has nothing to do
with token type, legacy or central-auth) — out of scope twice over (wrong
service, and the rule against fixing unrelated code). Confirmed the
`classroom.save()` call that stamps `central_assigned_by_id` **completes
and commits before** the later M2M-triggering line, so proof of the
central-id stamping itself did not require avoiding this — see below. The
container self-healed (gunicorn respawned the killed worker automatically);
`manage.py check` and every subsequent request were confirmed clean
afterward. Flagged prominently rather than silently worked around or
retried into a second hang.

## Endpoint → permission map

Central auth's catalog (`permissions.sms_catalog.SMS_PERMISSIONS`, Phase B3)
has no campus- or classroom-shaped permission at all — same situation as
C4's `sms.subject.*` gap.

| `sms.*` codename | Exists? | Wired to |
|---|---|---|
| `sms.campus.manage` | **Flagged — not in the catalog** | `CampusViewSet` create/update/partial_update/destroy |
| `sms.classroom.manage` | **Flagged — not in the catalog** | `LevelViewSet`/`GradeViewSet`/`ClassRoomViewSet` create/update/partial_update/destroy, plus `assign_coordinator`/`unassign_coordinator`/`unassign_teacher`/`assign_teacher` |

Fail-closed: every non-superadmin central-auth token 403s on every write
in this service today. Reads (list/retrieve/`summary`/`facilities`/`active`/
`campus_stats`/`available_teachers`/`unassigned_classrooms`) are gated by
`DualServiceSubscribed` only, matching "endpoints requiring no special perm
should work" from the C1-C4 recipe.

## `request.user.organization` / `get_current_organization()` — the central path never depends on either

Confirmed per the prompt's own note: `CampusViewSet._get_org()` and the
equivalent inline logic in `classes/views.py`'s three `perform_create`s all
read `request.user.organization` (doesn't exist on `CentralAuthUser`) or
call `get_current_organization()` (populated via `OrganizationMiddleware`'s
contextvar, which is never set for a central-auth request — same blind
spot as everywhere else). `get_org_and_tenant(user)` (`campus_service/dual_auth.py`)
branches on `isinstance(user, CentralAuthUser)` before ever touching either
— central-auth returns `(None, user.tenant_id)` directly from the token,
never falling through to the legacy resolution chain.

**Also found and fixed**: `user.is_superadmin()` called as a method in
`CampusViewSet`/`LevelViewSet`/`GradeViewSet`/`ClassRoomViewSet` — a bool
*attribute* on `CentralAuthUser`, not callable (same recurring gotcha as
every prior phase). `user.is_principal()` (`LevelViewSet.perform_create`,
gates a campus-required-for-principal validation) has no central-auth
equivalent — no principal_type claim exists yet (same gap flagged since
B3/C1-C4) — so that validation simply doesn't run on the central-auth path,
flagged rather than silently reinterpreted.

**Also found and fixed**: `classroom.assigned_by = request.user` (three
call sites: `ClassRoomViewSet.unassign_teacher`, the function-based
`unassign_classroom_teacher`, `ClassRoomViewSet.assign_teacher`) assigns the
acting user directly to a real FK — same class of gap as C2's
`Payment.received_by`. Fixed via `legacy_person_id()`/`central_person_id()`
(`campus_service/dual_auth.py`), proven below.

**Found, NOT fixable within scope**: `assign_teacher` also sets
`teacher.classroom_assigned_by = request.user` — also a real FK, but on
`teachers.Teacher`, which lives in **staff-service** (out of scope to touch
from this campus-service-scoped phase, and it has no `central_*_id` column
of its own). Left unset on the central-auth path (nullable field) rather
than crashing `teacher.save()` — flagged, not silently dropped.

## Proof on synthetic data

Environment: stack survived from C4; `campus-service` was rebuilt (not just
`docker cp`'d — this service's image had none of the `requests`/
`cryptography` deps baked in yet, and a first `docker cp`-only attempt
crash-looped on `ModuleNotFoundError: No module named 'requests'`, requiring
a full `docker compose build`). **Migration-file loss caught and fixed**:
the rebuild recreated the container from a fresh image, discarding
migration files generated via an earlier `docker exec ... makemigrations`
that were never `docker cp`'d back to the host — the *database* had already
applied them (confirmed via a direct `django_migrations` table read), but
the files didn't exist for the new container to enumerate. Fixed by
re-running `makemigrations` (deterministic — produced byte-identical
filenames) and copying the files to host immediately this time; verified
with `makemigrations --check --dry-run` → "No changes detected" before
proceeding.

Synthetic fixtures: 3 `Employee`s (superadmin-flagged for the
catalog-independent mechanics proof; plain for the missing-perm proof;
one under the VMS tenant, not sms-subscribed) in central auth, plus one
`Employee` minted with `perms=['*']` injected via `generate_access_token`'s
kwarg passthrough — `is_superadmin=False` (so the tenant_id-stamping branch
of `perform_create` actually runs, not the superadmin bypass) while still
clearing the `DualRequiresPermission` gate via `has_perm`'s `'*' in perms`
check — a more thorough proof than relying on the superadmin path alone,
since it isolates the *stamping* logic from the *permission* logic. One
synthetic `Teacher` row in campus-service's local (Dockerfile-copied)
`teachers` table.

```
POST /api/campus/ (non-superadmin, wildcard-perms token, {"campus_name":"C5 Test Campus 2", "campus_code":"C5CAMP2"})
  -> 201 Created
  DB: tenant_id = <SMS01 tenant>, organization_id = NULL, central_org_id = NULL

POST /api/levels/  (same token, campus=<above>) -> 201, tenant_id stamped
POST /api/grades/  (same token, level=<above>)  -> 201, tenant_id stamped
POST /api/classrooms/ (same token, grade=<above>) -> 201, tenant_id stamped

POST /api/classrooms/<id>/assign_teacher/ (same token, {"teacher_id": <synthetic teacher>})
  -> request hung (the pre-existing signals.py bug above) — but DB read
     immediately after confirmed the relevant line had already run and
     committed:
     class_teacher_id = <teacher>, assigned_by_id = NULL,
     central_assigned_by_id = <this token's own UUID>

POST /api/campus/ (plain token, no sms.campus.manage) -> 403 "Missing required permission: sms.campus.manage."
GET  /api/campus/ (plain token — no perm needed, just subscription) -> 200
GET  /api/campus/ (VMS-tenant employee token — no sms subscription) -> 403 "Your organization does not have an active SMS subscription."
```

**Tenant isolation** (`Campus`, second row tagged directly to the VMS
tenant):
```
Campus(tenant_id=SMS01) + Campus(tenant_id=VMS_TENANT)
GET /api/campus/ (SMS01 employee token) -> count: 1 (only the SMS01 row)
```

**Legacy dual-run still works** — raw HS256 token (`ams_shared.jwt.validator`
shape, `role='admin'`, `org_id=5`):
```
POST /api/campus/ (legacy token, {"campus_name":"Legacy Campus"}) -> 201 Created
  DB: organization_id = 5, tenant_id = NULL
```

All synthetic data (3 Employees, 1 wildcard-perms token reuse of the plain
Employee, 3 Campuses, 1 Level, 1 Grade, 1 ClassRoom, 1 Teacher) deleted
after verification. Cleanup for the Teacher/ClassRoom pair required raw SQL
(same pre-existing missing-migration-table cascade issue C3 already found
and worked around — `teachers_teachersubjectassignment` doesn't exist in
this environment — plus a circular FK between `classes_classroom.class_teacher_id`
and `teachers_teacher.assigned_classroom_id` that needed nulling out both
sides before either row could be deleted).

## Proof VMS/HDMS unchanged

```
manage.py check (auth_service)  -> System check identified no issues (0 silenced)
manage.py check (ams_campus)    -> System check identified no issues (2 silenced)
POST /api/auth/login-vms (real employee_code, wrong password)
  -> 401 {"error": "invalid_credentials", "detail": "Incorrect password"}
  (endpoint round-trips correctly; seeded password unknown to this session,
  same limitation noted in every prior phase's equivalent check)
```

Central-auth suite: `5 failed, 66 passed, 25 errors` — identical to
C4/the jwt-nonstaff-perms fix's baseline, same pre-existing causes, no new
failures or errors. campus-service has no test suite (`manage.py test
campus classes` finds zero tests, consistent with every SMS service
checked so far).

## Confirmed untouched

- `central_auth/authentication.py`, `jwks.py`, `tenant.py`: byte-identical
  to the C1-C4 source.
- `ams_shared/jwt/validator.py`, `users/middleware.py`, `users/permissions.py`
  (shared across services): not modified.
- `teachers.Teacher`/`teachers/signals.py` (staff-service): not modified,
  despite the deadlock-shaped bug found there — flagged, not fixed, per
  the explicit out-of-scope rule.
- Every other SMS service, VMS, HDMS, central auth's own code: untouched.
- The legacy local-`User`/session/org path: proven working unchanged
  (dual-run proofs above).

## What's next

C6 is next, separately, per the 13-service plan. Also open, carried
forward: `sms.campus.manage`/`sms.classroom.manage` need a future catalog
step; `central_assigned_coordinator_id`/`central_class_teacher_id` remain
schema-only (no endpoint today can supply the assigned person's central
UUID, only their local int id); the `teachers/signals.py` deadlock-shaped
bug (real, reproducible, affects legacy and central-auth identically,
lives in staff-service — worth its own fix phase); and `Teacher` still has
no `tenant_id` of its own, so the `available_teachers`/`assign_teacher`
lookups remain a best-effort `_base_manager` query, not tenant-scoped
(same residual gap C3/C4 already flagged for `Teacher`/`Coordinator`/
`Principal`/`Student`).
