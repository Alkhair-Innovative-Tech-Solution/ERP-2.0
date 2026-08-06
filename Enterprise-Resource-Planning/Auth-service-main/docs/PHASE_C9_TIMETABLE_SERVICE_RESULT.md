# Phase C9: Repoint timetable-service onto Central Auth — Result

Branch: `phase-c9-timetable-service` (off `main`, not merged). Scoped to
`timetable-service/` only, per the prompt. Ninth of 13 — a "normal" (not
identity-critical) service per the prompt's own framing: two person-FKs
(`teacher`/`created_by`) and one role gate (`IsPrincipal`). Reused the
C1-C8 recipe throughout; this doc records where it needed more than a
copy-paste, and two real bugs the proof itself surfaced.

## Structurally different from every prior phase, confirmed up front

**Every view in this service already avoids `.objects` (OrganizationManager)
entirely, in favor of `_base_manager`/`all_objects`, even on the LEGACY
path** — a pre-existing pattern unrelated to central-auth
(`OrganizationManager.get_queryset()` returns `.none()`/excludes NULL-org
rows whenever the org context-var isn't populated, e.g. a management
command; the original authors worked around this everywhere already). So,
unlike every prior phase, there was no read-side "blind, empty queryset"
hazard to fix here on the already-existing endpoints. There WAS a
consequence, though: `_base_manager` has **no tenant scoping at all** —
fine for legacy (single-tenant-per-deployment trust), but a cross-tenant
**leak** risk for central-auth specifically. `_central_tenant_filter()`
(`timetable/views.py`) layers an explicit `tenant_id` filter on top of the
existing `_base_manager` queryset **only** for a `CentralAuthUser` request
— legacy's already-established unscoped `_base_manager` reads are left
completely unchanged, proven below.

No local `requests` app collision (confirmed — no local app named
`requests`, and the pip package wasn't even in `requirements.txt` before
this phase, since nothing in this service called it) — standard
`requests`-based `central_auth/jwks.py` template used unchanged.

## Field audit — exhaustive

| Field | Model | Person, org, or domain? | Treatment |
|---|---|---|---|
| `ClassTimeTable.teacher` | ClassTimeTable | **person** (real FK → `teachers.Teacher`) | `central_teacher_id` (schema-ready, not populated this phase — see below) |
| `ClassTimeTable.created_by` | ClassTimeTable | **person** (real FK → `users.User`) — the acting user | `central_created_by_id`, populated on create |
| `TeacherTimeTable.teacher` | TeacherTimeTable | **person** | `central_teacher_id` (same as above) |
| `TeacherTimeTable.created_by` | TeacherTimeTable | **person** — acting user | `central_created_by_id`, populated on create |
| `Subject.organization`, `ClassTimeTable.organization`, `TeacherTimeTable.organization`, `ShiftTiming.organization` | timetable models | — (Org FK) | `tenant_id` + `central_org_id` (mixin) |
| `transfers/models.py`'s 6 org-linked models (`TransferRequest`, `IDHistory`, `ClassTransfer`, `ShiftTransfer`, `GradeSkipTransfer`, `CampusTransfer`) | transfers | — (Org FK) | `tenant_id` + `central_org_id` (mixin) — **schema-only**, see below |
| `Subject.campus`/`.level`, `ClassTimeTable.classroom`/`.subject`, `TeacherTimeTable.classroom`/`.subject`, `ShiftTiming.campus` | timetable models | **domain** (school-structure/curriculum, not users) | left untouched, per the prompt's explicit instruction |
| `transfers` models' many `Teacher`/`Coordinator`/`User`/`Student` person-FKs (`requesting_principal`, `initiated_by_teacher`, `approved_by`, etc.) | transfers | **person** | **not touched** — out of scope, see below |

**`central_teacher_id` is schema-ready but never populated this phase** —
same "some other person" residual pattern as nearly every prior phase
(C3's `central_coordinator_id`, C4's `central_teacher_id`, C6's
`central_coordinator_id`/`central_principal_id`, C7's `central_actor_id`,
C8's `central_teacher_id` on the same shape): there is no local mapping
from a vendored `Teacher` row to its own central-auth identity, and
building one is out of scope for a `timetable-service`-scoped phase.

## `transfers/` app — schema-only, not dual-safed

`transfers/views.py` is ~3900 lines of function-based views, exclusively
`IsAuthenticated`-gated (confirmed by reading — no `IsPrincipal` or other
role-class usage found anywhere in it). The prompt's own Goal/Done/Test
sections only describe `timetable/` app endpoints (create a slot,
principal-gated write, the conflict check) — `transfers` is never
mentioned there, only in the "Organization FKs... on TimeTable*, transfers
models" line of the FK audit guidance. Interpreted narrowly and
deliberately: `transfers`' 6 org-linked models got the same
`CentralAuthFieldsMixin` (`tenant_id`/`central_org_id`) + `all_objects`
(the same C5-class hazard fix as everywhere else) as `timetable/`'s
models, so a future phase can wire up `transfers/views.py`'s huge surface
without a fresh migration cycle — but the views themselves are **not**
made dual-safe here. Flagged as a residual gap for a dedicated future
phase, not silently left inconsistent with the FK audit's own guidance.

## The C5-class hazard, checked for up front — confirmed present in FOUR models

Per the prompt's explicit re-check instruction: **`Subject`, `TeacherTimeTable`,
and `ShiftTiming` had no `all_objects` at all** (only `ClassTimeTable`
already had one, pre-existing). Added to all three.
**`TeacherTimeTable`'s missing `all_objects` was the exact hazard the
prompt called out by name** — see the conflict-check section below.

## The conflict-check fix — two layered problems, both found live

**Problem 1 (the one the prompt named)**: `TeacherTimeTable.clean()`'s
double-booking query used `TeacherTimeTable.objects.filter(teacher=...,
day=..., start_time__lt=..., end_time__gt=...)` — `.objects` is
`OrganizationManager`, blind whenever the org context-var isn't populated,
which is always true for a central-auth request. Fixed: `all_objects` +
an explicit tenant filter (`Q(tenant_id=self.tenant_id) |
Q(tenant_id__isnull=True)`, mirroring `central_tenant_qs`'s
permissive-for-unscoped-rows precedent), scoped to the SAME tenant the row
being validated belongs to — never across tenants. This mirrors
`ClassTimeTable.clean()`'s own pre-existing pattern (already used
`all_objects` unconditionally, no tenant filter at all, since that method
predates central-auth) — my version is strictly more conservative, adding
tenant scoping on top rather than removing org-scoping that never existed
there in the first place.

**Problem 2 (found only by attempting the proof, not by reading)**: even
after fixing the query, **the conflict check never actually ran via the
DRF API at all**, for either token type. `ModelSerializer.create()`'s
default implementation calls `Model._default_manager.create(**validated_data)`,
which calls `.save()` — but Django **never calls `.full_clean()`/`.clean()`
automatically on `.save()`** (a well-known Django/DRF gap; only
`ModelForm`, e.g. Django admin, calls `full_clean()` for you). Grepped the
whole service: `full_clean`/`.clean()` is never called anywhere outside
`models.py` itself. So `TeacherTimeTable.clean()`'s conflict check (and
`ClassTimeTable.clean()`'s overlap check) were **dead code from the API's
perspective**, pre-existing, affecting legacy just as much as central-auth
— only Django-admin-created rows were ever actually validated. This
directly blocked the exact proof the prompt requires ("double-booking
within a tenant -> conflict raised"), so it was fixed for **both** token
types (not narrowed to central-auth only — there's no reason legacy should
keep a bug now that it's found): `ClassTimeTableCreateSerializer.create()`/
`TeacherTimeTableCreateSerializer.create()` now build the instance and call
`instance.full_clean(exclude=['id'], validate_unique=False)` before saving,
translating any `django.core.exceptions.ValidationError` into DRF's own
`serializers.ValidationError` (a clean 400, not a 500). `validate_unique=False`
is deliberate: `ClassTimeTableViewSet.create()` intentionally relies on the
DB's own `UniqueConstraint` raising `IntegrityError` for an exact
(classroom, day, start_time) duplicate, which it then catches and
**upserts** — existing, unrelated behavior that a hard `full_clean()`
validation error would have short-circuited into a 400 instead of the
intended 201-upsert. Verified this distinction matters by testing: exact
duplicates still upsert cleanly; overlapping-but-not-identical times now
correctly raise the conflict error that was previously silently skipped.

## The `PrimaryKeyRelatedField` blind spot — found in THREE places

`_classroom_field()`/`_teacher_field()` (`timetable/serializers.py`) were
already written using `._base_manager` from the start (pre-existing,
matching this service's already-`_base_manager`-first style) — no fix
needed there, confirmed by reading. Two genuine blind spots found:

1. **`ClassTimeTableCreateSerializer.subject`/`TeacherTimeTableCreateSerializer.subject`**
   — found live, not by inspection: unlike `classroom`/`teacher`, `subject`
   was a bare field name in `Meta.fields`, so DRF auto-built its
   `PrimaryKeyRelatedField` from `Subject.objects` (blind for
   central-auth) — every create attempt failed with `"Invalid pk"` for a
   real, existing subject. Added `_subject_field()` (same
   `_base_manager` pattern) and used it explicitly in both create
   serializers.
2. **`ShiftTimingSerializer.campus`/`SubjectSerializer.campus`/`SubjectSerializer.level`**
   — implicit PK fields from `campus.Campus`/`classes.Level` (both
   `OrganizationManager`-backed, neither has `all_objects` on `main` — a
   campus-service/campus-service-adjacent model, out of scope to add one
   from here, same finding as C8's identical gap for `Campus`/`Level`/`Grade`).
   Fixed with the standard `__init__`-override pattern, swapping to
   `._base_manager` for `CentralAuthUser`.

## Dual `IsPrincipal` + endpoint → permission map

`timetable_service/dual_auth.py`'s `IsPrincipal`: legacy branch delegates
to the original `users.permissions.IsPrincipal` unchanged
(`request.user.is_principal()` — confirmed `_TokenUser` supports this
natively, no fix needed on that side at all). Central branch: `is_superadmin`
claim, or a resolvable local `Principal` match (`find_principal`, the
established C3/C6/C8 email/employee_code local-DB-match technique —
`principals` is vendored here too).

| Endpoint | Legacy gate | Central gate |
|---|---|---|
| `shift-timings/` (read) | `IsAuthenticated` | + `DualServiceSubscribed` |
| `shift-timings/` (write) | `IsAuthenticated, IsPrincipal` | dual `IsPrincipal` + `DualServiceSubscribed` |
| `subjects/`, `class-timetable/`, `teacher-timetable/` (all actions) | `IsAuthenticated` | + `DualServiceSubscribed` |

Central auth's catalog has no timetable-shaped permission at all — no new
catalog entries invented; the dual `IsPrincipal` resolves via local DB
match, not a catalog codename, matching the "principal-tier" framing in
the prompt (there's nothing to flag as a catalog gap here specifically,
unlike phases with a `sms.*`-mapped write gate).

`SubjectViewSet.get_queryset()`'s legacy campus-scoping branch
(`elif not (user.is_staff or user.is_superuser):`) would `AttributeError`
for a `CentralAuthUser` (neither attribute exists on that class) —
confirmed as a genuine crash risk, not yet triggered live before this fix
since no central-auth request had reached `SubjectViewSet` before this
phase. Fixed with an `isinstance(user, CentralAuthUser)` branch ahead of
it: superadmin sees everything; otherwise resolves campus via
`find_principal`/`find_coordinator`/`find_teacher` (added `find_coordinator`
to `dual_auth.py` for this — `coordinator` is vendored here too, same
technique). Legacy branch (`Coordinator.get_for_user`, teacher_profile
fallback) untouched.

## Central-id stamping

`ClassTimeTableCreateSerializer`/`TeacherTimeTableCreateSerializer.create()`:
legacy `_stamp_actor()` branch is byte-for-byte the original code
(`getattr(user, 'pk', None)` already safely no-ops for `CentralAuthUser`,
which has no `.pk` at all — confirmed this was ALREADY a silent no-op on
the central path before this phase, not something this phase changed).
Central branch stamps `central_created_by_id` (`central_person_id(user)`)
+ `tenant_id`. `ShiftTimingSerializer`/`SubjectSerializer.create()`:
same shape via a shared `_stamp_org_and_tenant()` helper — legacy
`hasattr(user, 'organization')` check also already safely no-op'd for
central-auth before this phase; `tenant_id` added alongside it.
`ShiftTimingViewSet.apply_to_classrooms` (a bulk slot-generation action):
stamps `tenant_id` on every created/updated `ClassTimeTable` row for a
central-auth caller; `organization` stays `None` on that path exactly as
it already did before this phase (no `org_id`/`.organization` on
`CentralAuthUser`).

## Proof on synthetic data

Environment: `postgres-timetable`/`timetable-service` built and started
for the first time this phase (first-time bring-up, matching the
established pattern for every not-yet-started service in this project).

Synthetic fixtures: 1 `Employee` (teacher-shaped, matched by email to a
local `teachers.Teacher` row), 1 `Employee` (principal-shaped, matched to
a local `principals.Principal` row with `campus` set), 1 superadmin-flagged
token (reusing the teacher identity, `is_superadmin=True` via
`generate_access_token`'s kwarg passthrough), 1 `Employee` under a
VMS-only tenant (no `sms` subscription) — plus a local `Campus`/`Level`/
`Grade`/`ClassRoom`/`Subject` chain (via `_base_manager`, same technique
`SubjectViewSet` itself uses) to have something to schedule against.

```
POST /api/timetable/class-timetable/ (teacher token, classroom=1, subject=1, teacher=1,
  monday 09:00-10:00) -> 201
  DB: central_teacher_id = NULL (flagged, schema-ready — see field audit),
      central_created_by_id = <teacher token's own UUID>,
      tenant_id = <SMS01 tenant>

POST /api/timetable/shift-timings/ (teacher token, non-principal) -> 403
POST /api/timetable/shift-timings/ (principal token)              -> 201
```

**The double-booking conflict check, tenant-scoped, proven both directions**
(a `timetable/signals.py` receiver mirrors `ClassTimeTable` creates into a
matching `TeacherTimeTable` row, which is what the first conflict check
below fires against):
```
POST /api/timetable/teacher-timetable/ (same teacher, monday 09:00-10:00,
  already mirrored from the class-timetable create above)
  -> 400 "Teacher C9 Test Teacher is already assigned to another class during this time"
POST /api/timetable/teacher-timetable/ (same teacher, tuesday 09:00-10:00, no conflict)
  -> 201

# Cross-tenant isolation: a row manually tagged to a DIFFERENT tenant, wednesday 11:15-12:00
POST /api/timetable/teacher-timetable/ (SMS01 teacher token, wednesday 11:00-12:00,
  OVERLAPS the other tenant's 11:15-12:00 row for the SAME teacher)
  -> 201 — the other tenant's row is correctly NOT seen as a conflict
POST /api/timetable/teacher-timetable/ (SAME tenant, wednesday 11:30-12:30,
  overlaps the 11:00-12:00 row just created, SAME tenant)
  -> 400 — same-tenant conflict still correctly fires
```

**Permission / subscription gates + tenant isolation on read:**
```
GET /api/timetable/class-timetable/ (VMS-only tenant token, no sms subscription) -> 403
GET /api/timetable/teacher-timetable/ (SMS01 teacher token)
  -> 200, 3 rows (monday/tuesday/wednesday-11:00) — the other-tenant
     wednesday-11:15 row is correctly absent
```

**Legacy dual-run still works** (raw HS256 tokens, `role=principal`/`role=teacher`,
`org_id=5` — required setting the synthetic `Campus.organization_id=5` to
satisfy `OrganizationManager`'s org-scoping on the legacy `ShiftTimingSerializer.campus`
field specifically, a test-fixture gap, same class as every prior phase's
equivalent note, not a code bug):
```
GET  /api/timetable/teacher-timetable/ (legacy principal token) -> 200
POST /api/timetable/shift-timings/ (legacy principal token)     -> 201, organization=5
POST /api/timetable/shift-timings/ (legacy teacher/non-principal token) -> 403
```

All synthetic data (4 `TeacherTimeTable`, 1 `ClassTimeTable`, 2
`ShiftTiming`, 1 `Subject`, 1 `ClassRoom`, 1 `Grade`, 1 `Level`, 1
`Campus`, 1 `Teacher`, 1 `Principal`, 1 `Organization`, 3 `Employee`s)
deleted after verification — confirmed via direct row-count queries (`0`
across every synthetic table) post-cleanup.

## Proof VMS/HDMS unchanged

```
manage.py check (auth_service)       -> System check identified no issues (0 silenced)
manage.py check (timetable-service)  -> System check identified no issues (0 silenced)
POST /api/auth/login-vms (nonexistent employee_code)
  -> 401 {"error": "invalid_credentials", "detail": "Employee code not found or account inactive"}
```

Central-auth suite: `5 failed, 66 passed, 25 errors` — identical to every
prior phase's baseline, same pre-existing causes, no new failures or
errors. `timetable`/`transfers` apps have no exercised test suite
(`manage.py test timetable transfers` finds zero tests — consistent with
every SMS service checked so far).

## Confirmed untouched

- `central_auth/authentication.py`, `jwks.py`, `permissions.py`,
  `tenant.py`: byte-identical to the C1-C8 template.
- `users.permissions.IsPrincipal`: not modified — the dual class delegates
  to it directly for the legacy branch.
- `Coordinator.get_for_user`, `teacher_profile` fallback (legacy campus
  resolution in `SubjectViewSet`): untouched, byte-identical.
- `teachers.Teacher`, `principals.Principal`, `coordinator.Coordinator`,
  `campus.Campus`, `classes.Level`/`Grade`/`ClassRoom` (vendored, other
  services' own models): not modified — worked around via
  `_base_manager`/`all_objects` exactly as C3/C5/C6/C8 established.
  `ClassTimeTable.clean()`'s own pre-existing overlap-check query: left
  exactly as it was (already `all_objects`-based, no tenant filter added —
  out of scope, the prompt named `TeacherTimeTable`'s check specifically;
  `ClassTimeTable`'s equivalent gap is flagged below for a future pass).
- `transfers/views.py`, and every person-FK inside `transfers/models.py`
  besides the Organization-FK mixin: untouched — flagged as a residual
  gap above, not silently left half-migrated without documentation.
- Every other SMS service, VMS, HDMS, central auth's own code: untouched.
- The legacy `_base_manager`-based, org-context-independent read path:
  proven working unchanged end-to-end (dual-run proof above).

## What's next

C10 is next, separately, per the 13-service plan. Also open, carried
forward: `transfers/views.py`'s ~3900-line function-based-view surface
needs a dedicated future phase to become dual-safe (schema is ready);
`central_teacher_id` remains schema-only (no local Teacher→central-identity
mapping exists anywhere in this project yet — same gap flagged since C3);
`ClassTimeTable.clean()`'s overlap-check query has the identical
"no tenant filter" gap `TeacherTimeTable.clean()` had, not fixed this
phase (the prompt named the teacher conflict check specifically) — worth
folding into the same future pass that tackles `transfers`; and — same as
every prior phase — `Teacher`/`Principal`/`Coordinator`/`Campus`/`Level`
still have no `tenant_id` of their own, so every `_base_manager`/
`all_objects` lookup in this phase remains best-effort, not a
tenant-scoped guarantee.
