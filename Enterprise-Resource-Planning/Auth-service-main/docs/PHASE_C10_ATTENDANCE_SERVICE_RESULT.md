# Phase C10: Repoint attendance-service onto Central Auth — Result

Branch: `phase-c10-attendance-service` (off `main`, not merged). Scoped to
`attendance-service/` only, per the prompt. Tenth of 13, and — per the
prompt's own framing — the service with the **most person-FKs so far**: the
`Attendance` workflow (marked/created/updated/deleted/submitted/reviewed/
finalized/reopened by) carries 8 audit-trail person-FKs on its own, plus 2
more on `StudentAttendance`. Permissions are otherwise simple —
`IsAuthenticated` on function-based views, one role-permission class
(`HasAttendanceViewPermission`) wired into a handful of read endpoints.
Reused the C1-C9 recipe throughout; this doc records where it needed more
than a copy-paste, three real bugs the proof itself surfaced, and the scope
this phase deliberately narrowed to (with reasons).

## Field audit — exhaustive

| Field | Model | Person, org, or domain? | Treatment |
|---|---|---|---|
| `Attendance.marked_by` | Attendance | **person** (FK → `users.User`) | `central_marked_by_id` |
| `Attendance.created_by` | Attendance | **person** | `central_created_by_id` (schema-ready; legacy code never actually sets `created_by` on create either — see "confirmed untouched") |
| `Attendance.updated_by` | Attendance | **person** | `central_updated_by_id` (schema-ready; same as above) |
| `Attendance.deleted_by` | Attendance | **person** | `central_deleted_by_id` (schema-ready; `soft_delete()` is out of this phase's routed-endpoint scope — no live central-auth delete endpoint exercises it, see deferred section) |
| `Attendance.submitted_by` | Attendance | **person** | `central_submitted_by_id`, stamped on `mark_attendance`/`mark_bulk_attendance`/`edit_attendance`/`submit_attendance` |
| `Attendance.reviewed_by` | Attendance | **person** | `central_reviewed_by_id`, stamped on `review_attendance` |
| `Attendance.finalized_by` | Attendance | **person** | `central_finalized_by_id`, stamped on `finalize_attendance`/`coordinator_approve_attendance`/`coordinator_bulk_approve_attendance` |
| `Attendance.reopened_by` | Attendance | **person** | `central_reopened_by_id`, stamped on `reopen_attendance` |
| `StudentAttendance.created_by` | StudentAttendance | **person** | `central_created_by_id`, stamped on `mark_bulk_attendance`/`edit_attendance` |
| `StudentAttendance.updated_by` | StudentAttendance | **person** | `central_updated_by_id`, stamped on `mark_bulk_attendance`/`edit_attendance` |
| `Attendance.organization`, `StudentAttendance.organization` | both | — (Org FK) | `tenant_id` + `central_org_id` (`CentralAuthFieldsMixin`, same shape as C1-C9) |
| `Attendance.student` (via `StudentAttendance.student`) → `students.Student` | — | **domain** (the profile, not an identity to re-map) | left untouched, per the prompt's explicit instruction |
| `Attendance.classroom` → `classes.ClassRoom` | — | **domain** | left untouched |
| `total_students`/`present_count`/`absent_count`/`late_count`/`leave_count`/`excused_count` | Attendance | **domain** (counts, not ids) | left untouched |
| `Holiday.created_by`, `AttendanceBackfillPermission.granted_to`/`.granted_by`, `AuditLog.user`, `Weekend.created_by`, `StaffAttendance.user`/`.marked_by`, `BiometricEmployeeMapping.created_by`, `BiometricEmployeeMapping.user` | Holiday / AttendanceBackfillPermission / AuditLog / Weekend / StaffAttendance / BiometricEmployeeMapping | **person**, but on models this phase deliberately did NOT central-repoint | **not touched** — see "Deliberately deferred" below |

Migration: one additive migration
(`attendance/migrations/0015_attendance_central_created_by_id_and_more.py`)
covering all 14 new columns (10 on `Attendance`, 4 on `StudentAttendance`).
Applied clean; `makemigrations --check --dry-run` confirms no further
`attendance`-app changes pending (only the same pre-existing, unrelated
`teachers` app migration drift C8/C9 already found and left alone — see
below).

## Scope: what's in, what's deliberately deferred, and why

The prompt's own endpoint map names "attendance view vs mark vs
submit/review/finalize" as the required surface — this phase treats that as
the primary scope, consistent with its own framing that this is
already the largest FK surface tackled so far. Given this app's real size
(~4,500-line `views.py`, plus biometric device sync, holiday management,
staff-attendance/timing, backfill permissions, audit logs, CSV/PDF export —
each its own sub-domain with its own `organization`/person-FKs), the
following split was made explicit rather than silently leaving a partial
job:

**In scope — made fully dual-safe (central stamping + tenant-scoped
central reads):**
- `mark_attendance`, `mark_bulk_attendance` (the mark tier)
- `edit_attendance` (the 7-day-rule tier)
- `submit_attendance`, `review_attendance`, `finalize_attendance`,
  `coordinator_approve_attendance`, `coordinator_bulk_approve_attendance`,
  `reopen_attendance` (the workflow-step tier)
- `get_class_attendance`, `get_attendance_summary`, `get_class_students`,
  `get_student_attendance`, `get_teacher_classes`, `get_coordinator_classes`
  (the view tier feeding the above)
- The "Unified Attendance Review" endpoint's **permission gate**
  (`DualHasAttendanceViewPermission`, wired into `review_view.py`,
  `reminder_view.py`, `chronic_view.py`) — legacy behavior (the
  `view_attendance` RolePermission-table toggle) unchanged; central
  resolves via local-DB role match instead of a catalog permission (none
  exists — see permission map below).

**Explicitly deferred — `DualAuthentication` makes these endpoints
authenticate a central token (so legacy is provably unaffected), but their
internal view logic and models were NOT central-repointed this phase:**
Biometric device sync/mapping, holiday management, staff-attendance
(manual marking + biometric-derived), employee shift timing, backfill
permissions, CSV/Excel/PDF export, the delete-logs/audit-logs views, and
the "Unified Attendance Review" endpoint's own deep `scope_resolver`/
`calendar_utils` drill-down logic (only its permission gate was made
dual-safe, not its data resolution). These endpoints remain
`IsAuthenticated`-gated via `DualAuthentication` (so they don't reject a
valid central token at the authentication layer), but a central-auth
caller hitting one of them today gets either an empty/no-op result (most
of them, since their queries are `.objects`-based and therefore blind — a
safe fail-closed outcome, not a crash) or, in a few spots that call a
legacy-only method unconditionally, a caught 400 (every one of these
views' bodies are wrapped in `try/except Exception: return
Response(..., 400)`, so nothing 500s). None of these models got
`central_*_id` columns this phase — adding unused columns would be scope
creep on top of an already-large migration. Flagged here as the explicit
residual surface for a future phase, not silently left half-migrated.

## The C5-class hazard, checked for up front — confirmed present, and one deeper instance found live

Per the prompt's explicit re-check instruction: **`Attendance` and
`StudentAttendance` had NO `all_objects` at all** (grepped — zero hits
anywhere in `models.py` before this phase). Added to both.

**A second, deeper instance of the same hazard was found only by running
the proof, not by inspection**: `Attendance.update_counts()` and the
`AttendanceSerializer`'s nested `student_attendance` field both read
through `self.student_attendances`/`obj.student_attendances` — Django's
reverse-FK accessor, which resolves through `StudentAttendance`'s
**default** manager (`objects` = `OrganizationManager`), not whichever
manager was used to fetch the parent `Attendance` row. A central-auth
`mark_attendance` call returned `201` with `total_students: 0` despite the
`StudentAttendance` rows genuinely existing — `update_counts()`'s count
query was silently blind. Fixed in both places by querying
`StudentAttendance.all_objects.filter(attendance=self/obj)` explicitly
instead of the reverse accessor — safe for both token types, since the
query is already pinned to one specific `Attendance` row (and
`StudentAttendance.organization` always mirrors
`self.attendance.organization` per this model's own `save()`, so dropping
the redundant org filter here cannot leak across a boundary). The same
`.student_attendances.all().delete()` pattern (clearing old records before
recreating them) in `mark_attendance`/`mark_bulk_attendance`/
`edit_attendance` had the identical blind spot — fixed identically. Two
other `.student_attendances.all()` call sites exist in this file
(a holiday-replacement archival path and the CSV export), both outside
this phase's in-scope surface — left as-is, same class of gap as the
deferred endpoints above, not fixed opportunistically.

## Two more real bugs found by the proof itself — both fixed

**Bug 1 — `submitted_by`/`reviewed_by`/`reopened_by` raw `request.user`
FK assignment (pre-existing, affects legacy too).** `submit_attendance`,
`review_attendance`, and `reopen_attendance` did e.g.
`attendance.submitted_by = request.user` directly — `request.user` is
NEVER a real `users.User` model instance for either token type (`_TokenUser`
for legacy, `CentralAuthUser` for central), so Django's FK descriptor
raises `ValueError` on assignment, unconditionally. These three endpoints
400'd for every legacy caller too, before this fix — not something this
phase introduced, but it directly blocked the required proof ("submit/
review/finalize stamps the right actor"), so — same precedent as C9's
`full_clean()` fix — corrected for **both** token types, not narrowed to
central-auth only. Fixed with `_db_user(request.user)` (resolves the real
DB row for legacy; safely `None` for central-auth, whose identity is
carried by the new `central_*_by_id` column instead).

**Bug 2 — `_db_user()`/`add_edit_history()` crash on a UUID user id.**
Both helpers did `User.objects.get(pk=uid)` where `uid` comes from
`getattr(user, 'id', None)` — for a `CentralAuthUser`, `id` is a UUID
*string*, not this table's integer primary key. `pk=<uuid-string>` against
an `AutoField` raises `ValueError` deep in the ORM's query-building — NOT
`User.DoesNotExist` — so the original narrower `except User.DoesNotExist`
let it propagate uncaught. `_db_user()` is called from nearly every
workflow view in this phase (`marked_by`/`created_by`/`updated_by`/
`submitted_by`/`reviewed_by`/`finalized_by`/`reopened_by`); `add_edit_history()`
is called from all of them too — an unguarded crash here would have broken
the entire central-auth path service-wide. Fixed: `int(uid)` before the
lookup, with `(User.DoesNotExist, TypeError, ValueError)` caught — a no-op
for every legacy caller (`uid` is already an int there), safely resolving
to `None` for a central-auth caller.

**A third, permission-layer bug, also pre-existing and unrelated to
central-auth**: `AttendanceSerializer.get_display_status()` called
`user.is_teacher()`/`.is_coordinator()`/`.is_principal()`/`.is_superadmin()`
unconditionally — `CentralAuthUser` has none of the first three methods at
all (`AttributeError`), and `.is_superadmin` is a bool *attribute* there,
not a method (`user.is_superadmin()` → `TypeError: 'bool' object is not
callable`). This crashed `AttendanceSerializer` for **every** central-auth
read before the fix. Fixed with an `isinstance(user, CentralAuthUser)`
branch that resolves the same tiers via `find_teacher`/`find_coordinator`/
`find_principal` (the C3/C6/C8/C9 local-DB-match technique) instead.

## The `principals` app: vendored but never registered — found live

`attendance-service`'s Dockerfile already `COPY`s
`microservices/staff-service/principals/` into the image (same as
`coordinator`/`teachers`), but `attendance_service/settings.py`'s
`INSTALLED_APPS` never listed it — confirmed against timetable-service's
own `settings.py`, which does register `principals`. Any principal-tier
code path — legacy or central — crashed with "Model class
`principals.models.Principal` doesn't declare an explicit app_label and
isn't in an application in INSTALLED_APPS" the moment it was exercised.
Found live while proving the 7-day edit window's principal branch (not by
reading — this class of gap doesn't show up without actually running a
principal-scoped request). Fixed by adding `"principals"` to
`INSTALLED_APPS`; its migrations (`0001_initial`/`0002_initial`/
`0003_remove_evening_shift_choice`) applied cleanly against
`postgres-attendance` with no conflicts. Genuinely pre-existing and
unrelated to central-auth, but blocking both token types identically —
fixed for both, same precedent as Bug 1 above.

## Dual `HasAttendanceViewPermission` — legacy delegates unchanged

`attendance_service/dual_auth.py`'s `DualHasAttendanceViewPermission`:
legacy branch delegates to the original `attendance.permissions
.HasAttendanceViewPermission` unchanged (the `view_attendance`
RolePermission-table toggle, read cross-DB from `auth_db` via raw
`psycopg2` — untouched). Central branch: `is_superadmin` claim, or a
resolvable teacher/coordinator/principal via local DB match
(`find_teacher`/`find_coordinator`/`find_principal`) — coarser than the
legacy per-role toggle (an Org Admin can revoke `view_attendance` for
teachers specifically via that toggle; there's no central-auth equivalent
yet), **flagged**, not fixed — fails open only as far as "any resolvable
staff role," never to an unresolvable caller.

`CanMarkAttendance`/`CanEditAttendance`/`CanViewAttendance`/
`CanDeleteAttendance`/`CanExportAttendance` (`attendance/permissions.py`):
confirmed via grep across `views.py` and every `services/*.py` file —
**none of these five classes are wired into any view's `permission_classes`
list** (dead code from the routing's perspective, pre-existing, unrelated
to this phase). No dual work needed for them; left untouched.

## Endpoint → permission map

sms_catalog's `SMS_PERMISSIONS` (`permissions/sms_catalog.py` on the
central auth-service) has **no attendance-shaped entry at all** — only
`sms.assignment.*`/`sms.fee.*`/`sms.result.view` exist (confirmed by
reading the catalog file directly, same finding C8/C9 reported for their
own domains). Per the prompt's "don't invent catalog perms" rule, no
`sms.attendance.mark`/`.review`/etc. was fabricated — every workflow gate
below resolves via **local-DB role match** (the same technique C9's dual
`IsPrincipal` used when no catalog codename existed for it either), not a
central permission codename.

| Endpoint | Legacy gate | Central gate |
|---|---|---|
| `mark/`, `mark-bulk/` | `IsAuthenticated` (no role check inside — any authenticated user can mark; teacher-vs-other distinction only affects Sunday/holiday blocking) | + `DualServiceSubscribed`; role resolved via `find_teacher` for the "who marked this" stamp, not as a hard gate (matches legacy's own lack of a hard gate) |
| `edit/<id>/` | `IsAuthenticated`, role-branched inline (superadmin/teacher-7-day/coordinator-unlimited/principal) | + `DualServiceSubscribed`; role-branched inline via `_central_role_tier` (superadmin/teacher-7-day/coordinator-unlimited/principal), same rule, central-safe resolution — see below |
| `submit/<id>/` | `IsAuthenticated`, inline teacher-of-classroom check | + `DualServiceSubscribed`; central branch via `find_teacher` |
| `review/<id>/`, `finalize/<id>/`, `coordinator-approve/<id>/`, `coordinator-bulk-approve/`, `reopen/<id>/` | `IsAuthenticated`, inline coordinator-of-level check | + `DualServiceSubscribed`; central branch via `find_coordinator` |
| `class/<id>/`, `class/<id>/students/`, `class/<id>/summary/`, `student/<id>/`, `teacher/classes/`, `coordinator/classes/` | `IsAuthenticated` | + tenant-scoped reads (`central_tenant_qs`) for central tokens; role resolution via `find_teacher`/`find_coordinator` where the legacy branch has one |
| `review/` (Unified Attendance Review), `review/remind*`, `review/chronic-absentees/` | `IsAuthenticated, HasAttendanceViewPermission` | + `DualHasAttendanceViewPermission` (gate only — see "deliberately deferred" for the underlying data resolution) |
| Biometric, holiday, staff-attendance, backfill, export, audit-logs, delete-logs, realtime-metrics, campus-stats | `IsAuthenticated` (+ `HasAttendanceViewPermission` on a few backfill/export/chronic endpoints, untouched) | Same gate classes (via `DualAuthentication` at the service level so legacy is unaffected) — **not central-repointed**, see deferred section |

## The 7-day edit window — made central-safe

The rule itself lives in `edit_attendance` (the view), **not** in
`Attendance.is_editable` (that model property is purely status+date-based
and needed no change — confirmed by reading before touching anything, per
the prompt's own hint). The view's inline role-branch (`user.is_superuser`
/`.is_teacher()`/`.is_coordinator()`/`.is_principal()`) doesn't exist in
that shape on `CentralAuthUser` — calling any of them would `AttributeError`,
not silently fall through. Fixed with a parallel `is_central` branch that
resolves the SAME tiers via `_central_role_tier()` (superadmin claim, or a
resolvable principal/coordinator/teacher via local DB match, in that
priority order) and then applies the **identical** day-counting logic
copied verbatim from the legacy teacher branch: `days_diff =
(timezone.now().date() - attendance.date).days`, `<= 7` allowed,
`> 7` → 403, `approved` status → always blocked regardless of days.
Coordinator/principal tiers: unlimited time, scoped to their
level/campus — same as legacy, just resolved via `find_coordinator`/
`find_principal` instead of `_resolve_coordinator`/`Principal.objects.get`.

**Proven**: a synthetic `Attendance` row dated 10 days ago —
teacher-tier central token → `403 "Cannot edit attendance older than 7
days. This attendance is 10 days old."`; coordinator-tier central token on
the SAME row → `200`, edit applied.

## Central-id stamping — verified in the database, not just via response codes

Every stamp below was confirmed with a direct `Attendance.all_objects.get(id=...)`
query after the HTTP call, not inferred from the 200/201 status alone.

```
POST /api/attendance/mark/ (teacher token, classroom 4, 3 students)
  -> 201, total_students=3, present_count=2, absent_count=1
  DB: central_marked_by_id == teacher token's own UUID
      central_submitted_by_id == teacher token's own UUID
      tenant_id == Tenant1's UUID
      marked_by (legacy FK) == None  [correct — no local User row for this identity]
      3 StudentAttendance rows, each tenant_id == Tenant1's UUID

POST /api/attendance/coordinator-approve/2/ (coordinator token)
  -> 200; DB: status=approved, central_finalized_by_id == coordinator token's own UUID

POST /api/attendance/reopen/2/ (coordinator token, reason required)
  -> 200; DB: status=under_review, central_reopened_by_id == coordinator token's own UUID

POST /api/attendance/submit/6/ (teacher token, draft attendance)
  -> 200; DB: central_submitted_by_id == teacher token's own UUID
POST /api/attendance/review/6/ (coordinator token, now-submitted attendance)
  -> 200; DB: central_reviewed_by_id == coordinator token's own UUID
```

## Proof on synthetic data

Environment: `postgres-attendance`/`attendance-service` built and started
for the first time this phase (first-time bring-up, matching the
established pattern for every not-yet-started service in this project —
`staff-service` was also brought up for the first time this session, since
`attendance-service` `depends_on` it). `auth-service`, VMS, HDMS already
running from prior sessions, confirmed unaffected (below).

Synthetic fixtures: 2 central-auth `Tenant`s (`C10T1` with an active `sms`
`Subscription`, `C10T2` without one) + 1 `Organization` each; 3 central
`Employee`s (teacher-shaped, coordinator-shaped, and one under the
unsubscribed tenant) minted via `generate_access_token`; matching local
`teachers.Teacher`/`coordinator.Coordinator` rows in attendance-service
(matched by email, the `find_teacher`/`find_coordinator` resolution path);
1 `Campus`/`Level`/`Grade`/`ClassRoom`/3 `Student`s to have something to
mark attendance against; 1 legacy `users.User` + raw HS256 JWT (signed
with the service's own `JWT_SECRET_KEY`) + matching local `Organization`/
`Campus`/`Level`/`Grade`/`ClassRoom`/`Teacher`/`Student` for the dual-run
proof.

**(a) Teacher marks attendance — central stamp + tenant, 201:**
```
POST /api/attendance/mark/ (teacher token) -> 201
  central_marked_by_id + central_submitted_by_id == teacher's own UUID, tenant_id stamped
```

**(b) Workflow steps stamp the correct central_*_by_id per step:**
```
submit -> central_submitted_by_id (teacher)
review -> central_reviewed_by_id (coordinator)
coordinator-approve / finalize -> central_finalized_by_id (coordinator)
reopen -> central_reopened_by_id (coordinator)
```
(all verified against the database directly, see previous section)

**(c) 7-day edit window — teacher blocked after 7 days, coordinator allowed:**
```
PUT /api/attendance/edit/<10-day-old-id>/ (teacher token)      -> 403
PUT /api/attendance/edit/<same id>/       (coordinator token)  -> 200, applied
```

**(d) Gates:**
```
POST /api/attendance/mark/ (unsubscribed-tenant token) -> 403
  {"detail":"Your organization does not have an active SMS subscription."}

POST /api/attendance/coordinator-approve/<other-tenant-attendance-id>/ (Tenant1 coordinator token)
  -> 400 {"error":"No Attendance matches the given query."}  [functionally
     "not found" — get_object_or_404 raised Http404, caught by this view's
     top-level try/except and surfaced as 400, same as every other error
     path in this view; not a 500, not a data leak]

GET /api/attendance/class/4/?start_date=...&end_date=... (Tenant1 coordinator token)
  -> 200, [2, 3]  — the other tenant's row (id 4, same classroom) is
     correctly absent from the list
```

**(e) Legacy HS256 token — unchanged:**
```
POST /api/attendance/mark/ (legacy HS256 token, org-scoped classroom/student)
  -> 201, total_students=1, present_count=1
GET /api/attendance/class/<id>/ (same legacy token)
  -> 200, marked_by=<real local User id> (legacy FK correctly populated,
     student_attendance nested list correctly populated)
```

All synthetic data (5 `Attendance`, 6 `StudentAttendance`, 4 `Student`s, 2
`Teacher`s, 1 `Coordinator`, 2 `ClassRoom`s, 2 `Grade`s, 2 `Level`s, 2
`Campus`es, 1 legacy `users.User`, 1 legacy `Organization` + its
signal-seeded `RolePermission` rows, in attendance-service; 3 `Employee`s,
2 `Tenant`s, 2 `Organization`s, 1 `Subscription`, in auth-service) deleted
after verification — confirmed via direct row-count queries (`0` across
every synthetic table) post-cleanup in both services.

## Proof VMS/HDMS/other SMS services unchanged

```
manage.py check (auth_service)       -> System check identified no issues (0 silenced)
manage.py check (attendance-service) -> System check identified no issues (2 silenced)

POST /api/auth/login-vms (nonexistent employee_code)
  -> 401 {"error": "invalid_credentials", "detail": "Employee code not found or account inactive"}

hdms-ticket-service container health -> healthy (unchanged)
vms-backend-1 container               -> running (unchanged)

GET /api/timetable/subjects/ (invalid token) -> 401 (unaffected)
GET /api/students/ (invalid token)           -> 401 (unaffected)
```

## An unrelated pre-existing drift, found but explicitly NOT fixed

`makemigrations --check --dry-run` flags a pending migration for the
vendored `teachers` app (`TeacherSubjectAssignment`) — the exact same
finding C8 and C9 both already reported and left alone (a genuine
cross-app coupling issue: the generated migration depends on a `timetable`
app not installed in `attendance-service`). Not attempted here either,
same reasoning as those two phases.

## Confirmed untouched

- `central_auth/authentication.py`, `jwks.py`, `permissions.py`,
  `tenant.py`: byte-identical to the C1-C9 template (no local `requests`
  app collision — confirmed, standard `requests`-based `jwks.py` used).
- `attendance.permissions.HasAttendanceViewPermission`: not modified — the
  dual wrapper delegates to it directly for the legacy branch.
- `Coordinator.get_for_user`, `_resolve_coordinator`,
  `Teacher.objects.get(employee_code=...)`-style legacy lookups: called
  unchanged on the legacy branch of every workflow view touched.
- `Attendance.is_editable` (the model property): read, confirmed
  status+date-only (no role awareness needed), not modified.
- `teachers.Teacher`, `coordinator.Coordinator`, `principals.Principal`
  (vendored, staff-service's own models): not modified — worked around via
  `_base_manager`/`find_*` exactly as C3/C6/C8/C9 established.
- `Attendance.created_by`/`.updated_by`/`.deleted_by`: the legacy code
  never actually sets these on create either (confirmed by reading —
  `created_by`/`updated_by` are set on `StudentAttendance`, not on
  `Attendance` itself, outside of `add_edit_history`'s own `updated_by`
  bookkeeping) — their `central_*_id` counterparts are schema-ready,
  consistent with the "some other person" residual pattern every prior
  phase has left for at least one column.
- Biometric/holiday/staff-attendance/backfill/export/audit-log models and
  views: not central-repointed, explicitly flagged above as deferred
  rather than silently left half-migrated.
- Every other SMS service, VMS, HDMS, central auth's own code: untouched.
- The legacy `OrganizationManager`/`get_current_organization()` path:
  proven working unchanged end-to-end (dual-run proof above).

## What's next

org-service (the diverged fork) is next, separately, per the plan. Also
open, carried forward: the deferred surface listed above (biometric/
holiday/staff-attendance/backfill/export/the Unified Attendance Review's
own data resolution) has no `central_*_id` columns and no dual-safe view
logic yet; `sms.*` catalog has no attendance-shaped permissions at all (no
new entries invented, per the fail-closed rule); `central_created_by_id`/
`central_updated_by_id`/`central_deleted_by_id` on `Attendance` remain
schema-ready but write-path-incomplete (mirroring the legacy code's own
gap, not a regression); `principals` was silently unregistered in
`INSTALLED_APPS` until this phase found it — worth checking whether the
same gap exists in any other still-unrepointed SMS service; and — same as
every prior phase — `Teacher`/`Coordinator`/`Principal` still have no
`tenant_id` of their own, so every `_base_manager`/`find_*` lookup in this
phase remains best-effort, not a tenant-scoped guarantee.
