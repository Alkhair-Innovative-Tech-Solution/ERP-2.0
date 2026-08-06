# Phase C6: Repoint support-service onto Central Auth — Result

Branch: `phase-c6-support-service` (not merged to `main`). Scoped to
`support-service/` only, per the prompt. Sixth of 13 — reused C1-C5's
recipe throughout; this doc records where support-service needed more than
a copy-paste.

## A required template deviation, per the "STOP and say why" rule

**support-service has a local Django app literally named `requests`**
(`INSTALLED_APPS` includes `"requests"` — the app implementing
`RequestComplaint`/`RequestComment`/`RequestStatusHistory`). Confirmed
empirically before writing any central-auth code: built the (pre-repoint)
image and ran `python -c "import requests; print(requests.__file__)"`
inside it — it printed `/app/requests/__init__.py`, **not** the
pip-installed HTTP library. Django adds the service's `BASE_DIR` (`/app`)
to the front of `sys.path`, so the local app always shadows the real
`requests` package inside this container. `central_auth/jwks.py` (the
template, unchanged in every prior phase) does `import requests` /
`requests.get(...)` to fetch the JWKS signing key — that would fail with
`AttributeError: module 'requests' has no attribute 'get'` the first time
token verification needed a JWKS fetch.

**Fix**: rewrote only `support-service/central_auth/jwks.py` to use the
stdlib `urllib.request`/`urllib.error` instead of the `requests` library —
identical fetch/cache/timeout/error-handling behavior (an `HTTPError` is a
`URLError` subclass, so the except clause still covers non-2xx responses
the same way the template's `raise_for_status()` did), zero third-party
dependency, no naming collision possible. Every other file in
`central_auth/` (`authentication.py`, `permissions.py`, `tenant.py`) and
every other service's `jwks.py` remain byte-identical to the template —
confirmed via `diff -rq` on the other three files. Renaming the local
`requests` app was considered and rejected as far more invasive than this
one file's scope (would touch `INSTALLED_APPS`, migrations, `urls.py`, and
any other service that might reference it). `requirements.txt` does **not**
list the `requests` HTTP library at all (it would never be importable
correctly here regardless) — only `cryptography` was added.

## Template reuse — otherwise confirmed unchanged

`central_auth/authentication.py`/`permissions.py`/`tenant.py` copied from
`campus-service/central_auth/` directly, byte-identical (`diff -rq`, zero
output). `SERVICE_CODE` was already `'sms'`. `support_service/dual_auth.py`
lives at the project-package level (same reasoning as C4/C5) — `requests`
and `form_builder` are two peer apps, neither "primary" (and naming it
`requests/dual_auth.py` would sit inside the collision-prone app for no
reason).

## What's in support-service — confirmed as the prompt described

Three person role-FKs (closest to C3's shape) — `RequestComplaint.teacher`/
`.coordinator`/`.principal`, all real FKs to vendored staff-service models
— but simple `IsAuthenticated`-only permissions (like C4/C5, no DRF
role-gate classes). Role determination is inline in every view/serializer
function body via `request.user.is_teacher()`/`.is_coordinator()`/
`.is_principal()`/`.is_superuser` — none of which exist in that shape on
`CentralAuthUser` (no role/principal_type claim yet — same gap flagged
since B3/C1-C5).

## Field audit (the recipe's step 2) — exhaustive

| Field | Model | Person or domain? | Treatment |
|---|---|---|---|
| `RequestComplaint.organization` | RequestComplaint | — (Org FK) | mixin (`tenant_id` + `central_org_id`) |
| `RequestComplaint.teacher` | RequestComplaint | **person** (real FK → `teachers.Teacher`) | separate `central_teacher_id` (UUID) |
| `RequestComplaint.coordinator` | RequestComplaint | **person** (real FK → `coordinator.Coordinator`) | separate `central_coordinator_id` (UUID) |
| `RequestComplaint.principal` | RequestComplaint | **person** (real FK → `principals.Principal`) | separate `central_principal_id` (UUID) |
| `RequestComplaint.approved_by` | RequestComplaint | role-label `CharField` ('coordinator'/'principal'), **not an identity** | left as-is |
| `RequestComment.organization` | RequestComment | — (Org FK) | mixin |
| `RequestComment.user_type` | RequestComment | role-label `CharField` ('teacher'/'coordinator'), **not an identity** | left as-is — audited, no author FK/id exists on this model at all |
| `RequestStatusHistory.organization` | RequestStatusHistory | — (Org FK) | mixin |
| `RequestStatusHistory.changed_by` | RequestStatusHistory | role-label `CharField`, **not an identity** | left as-is |
| `FormTemplate.organization` | FormTemplate | — (Org FK) | mixin |
| `FormTemplate.target_model` | FormTemplate | **domain** — a CharField naming another model (e.g. `'students.Student'`), confirmed NOT an id | left as-is |

Two additive migrations (`requests/migrations/0003_requestcomment_central_org_id_and_more`,
`form_builder/migrations/0003_formtemplate_central_org_id_formtemplate_tenant_id`),
applied clean. `CentralAuthFieldsMixin` defined once in `requests/models.py`,
imported into `form_builder/models.py` (`from requests.models import
CentralAuthFieldsMixin` — this cross-app import correctly resolves to the
**local Django app** `requests`, not the shadowed HTTP library; the
collision only affects bare top-level `import requests` for the HTTP
client, not Django's own app-module resolution).

**Confirmed, not merely assumed**: audited `RequestComment` and
`RequestStatusHistory` specifically for a "raised_by"/"created_by"/author
id per the prompt's explicit instruction — neither model has one. Both
only carry a role-label `CharField` (`user_type` / `changed_by`), which is
not a person reference at all — no central-auth column was added for
either beyond the Organization mixin, and this is called out explicitly
in-code (comments in `requests/models.py`) so a future reader doesn't
wonder why they're "missing".

## The C5-class hazard, checked for up front — confirmed present, fixed cheaply

Per the prompt's explicit instruction to re-check for C5's `all_objects`
lesson: **`RequestComplaint`, `RequestComment`, `RequestStatusHistory`,
and `FormTemplate` all lacked `all_objects`** (only `objects =
OrganizationManager()`). Added `all_objects = models.Manager()` to each —
not a schema change (confirmed via `makemigrations --check --dry-run` →
"No changes detected" both before and after).

**Also checked for the second named hazard** (a signal handler opening a
second DB connection, per the `staff-service`/`assign_teacher` deadlock
found in C5): grepped `teachers/signals.py`, `coordinator/`, `principals/`
(the vendored apps this service also uses) for `psycopg2.connect`/raw
cross-connection patterns triggered by anything `requests/views.py` does.
The specific `_sync_class_teacher_to_campus_db` handler C5 found is keyed
off `Teacher.assigned_classrooms` (a classroom-assignment M2M) — this
service never touches that field or the `assign_teacher`/`unassign_teacher`
endpoints (those live in campus-service, not here). No equivalent hazard
found in support-service's own call paths — the only M2M this service
touches is `Teacher.assigned_coordinators` (queried, not signal-connected
to any cross-DB sync in `teachers/signals.py`).

## The `PrimaryKeyRelatedField` blind spot — found in one place, form_builder

Per the prompt's explicit note to re-check this (found in C3/C4/C5):
`requests/serializers.py` deliberately excludes `teacher`/`coordinator`/
`principal`/`organization` from every serializer's `fields` (they're set
programmatically in `.create()`, never exposed as a `PrimaryKeyRelatedField`
at all) — so **no fix was needed there**, confirmed by reading, not
assumed. `form_builder/serializers.py`'s `FormTemplateSerializer` uses
`fields = '__all__'`, which **does** auto-derive a `PrimaryKeyRelatedField`
for `organization` (`Organization.objects` — also `OrganizationManager`-
backed, conveniently already had `all_objects`). Fixed with the same
`__init__`-override pattern as C3/C4/C5.

**Found one level deeper, not in a prior phase**: `RequestComplaintDetailSerializer.comments`/
`.status_history` are `RequestCommentSerializer(many=True, read_only=True)`/
`RequestStatusHistorySerializer(many=True, read_only=True)` — DRF's nested-serializer
shorthand for a reverse FK accessor (`obj.comments`/`obj.status_history`).
Reverse FK accessors use the target model's **default manager**
(`RequestComment.objects`/`RequestStatusHistory.objects`, both
`OrganizationManager`-backed) under the hood — same blind spot, silently
empty for a central-auth request, exact same class of gap C4 found with
`Submission`/`result.subject_marks`. Fixed by converting both fields to
`SerializerMethodField`s that explicitly query `.all_objects.filter(request=obj)`
for a dual-safe read — proven end-to-end below (a comment created via a
central-auth token immediately appeared in that same token's follow-up
detail-view read).

## Endpoint → permission map

Central auth's catalog (`permissions.sms_catalog.SMS_PERMISSIONS`, Phase B3)
has no support/complaint/form-shaped permission at all.

| `sms.*` codename | Exists? | Wired to |
|---|---|---|
| `sms.support.view` | **Flagged — not in the catalog** | `get_my_requests`, `get_request_detail`, `get_coordinator_requests`, `get_coordinator_dashboard_stats`, `get_principal_requests` |
| `sms.support.create` | **Flagged — not in the catalog** | `create_request`, `add_comment` |
| `sms.support.manage` | **Flagged — not in the catalog** | `update_request_status`, `forward_to_principal`, `approve_request`, `reject_request`, `confirm_completion` |
| `sms.form.manage` | **Flagged — not in the catalog** | `FormTemplateViewSet` create/update/partial_update/destroy |

Fail-closed: every non-superadmin central-auth token 403s on every
endpoint in this service today. `FormTemplateViewSet` list/retrieve keep
their legacy `IsAuthenticated`-only gate (no perm needed at all, matching
the "endpoints requiring no special perm should work" pattern) plus
`DualServiceSubscribed` on the central-auth path.

**Also found and fixed**: `FormTemplateViewSet`'s legacy write gate is
`IsAdminUser` (checks `request.user.is_staff`) — `CentralAuthUser` has no
`.is_staff` attribute at all (`IsAdminUser` would raise `AttributeError`
on it, not just deny). `get_permissions()` now branches: legacy keeps
`IsAdminUser` byte-for-byte; central-auth uses `DualRequiresPermission('sms.form.manage')`
instead.

## `request.user.is_teacher()`/`.is_coordinator()`/`.is_principal()`/`.is_superuser` — made dual-safe

All four read/called directly across `requests/views.py` (12 view
functions) and twice more inside `requests/serializers.py`
(`RequestComplaintCreateSerializer.create()`, `RequestCommentCreateSerializer.create()`).
None exist on `CentralAuthUser`. Fixed with dual-safe function equivalents
(`user_is_teacher`/`user_is_coordinator`/`user_is_principal`/
`user_is_superuser`, `support_service/dual_auth.py`) — legacy branch calls
the original method/attribute unchanged; central-auth branch resolves via
a local `Teacher`/`Coordinator`/`Principal` DB match (email or
employee_code), the same mechanism C3 (result-service) established, since
support-service vendors all three models too (Dockerfile-copied from
staff-service, confirmed).

**Also found and fixed, same root cause as C4's teacher-assigned-coordinators
gap**: `Coordinator.get_for_user(user)` (a classmethod on the vendored
`Coordinator` model, called 8 times) internally uses `Coordinator.objects`
— empty for a central-auth request. Its own `user.username` access is
already defensively wrapped in `try/except Exception: pass` (falls through
to the email branch, no crash), but the underlying manager blind spot
still means it always returns `None` for a central-auth token, correct
match or not. Fixed via a `get_coordinator(user)` wrapper in
`dual_auth.py`: legacy delegates to the **original classmethod unchanged**
(preserving its exact employee_code-then-email lookup order, not
reimplemented); central-auth uses `Coordinator._base_manager` instead.

**Also found, same as C4's `teacher.assigned_coordinators` gap**:
`RequestComplaintCreateSerializer.create()`'s `teacher.assigned_coordinators.exists()`/
`.first()` — the forward M2M's related manager is `Coordinator.objects`-backed
under the hood, same blind spot. Fixed via the identical
`teacher_assigned_coordinators()` through-table helper C4 built, ported
unchanged in shape.

**Also found**: `Principal.objects.get(campus=coordinator.campus, is_currently_active=True)`
in `forward_to_principal` (finding the active principal for a campus, not
about the acting user's own identity) — same blind spot, fixed with a
dedicated `find_principal_for_campus(campus, user)` helper.

## Central-id stamping — what's populated, what's flagged

`central_teacher_id` is populated on create: the acting teacher **is**
`request.user`, so `central_person_id(user)` is exactly right, proven
below. `central_coordinator_id`/`central_principal_id` are **not**
populated by any write path in this phase — the assigned coordinator (at
create time) and the assigned principal (at forward-to-principal time) are
always a *different* person than `request.user`, and there is no
local→central identity mapping available for "some other person" in this
service (same class of gap flagged in C3's `Result.central_coordinator_id`/
C4's `SubjectTeacherAssignment.central_teacher_id`/C5's
`central_assigned_coordinator_id`/`central_class_teacher_id`) — the schema
columns exist, ready for a future phase that adds such a mapping.

## Proof on synthetic data

Environment: stack survived from C5 (after Docker Desktop itself restarted
mid-session — separate infra hiccup, confirmed all 27 containers came back
healthy before proceeding); `postgres-support`/`support-service` built and
started for the first time this phase.

Synthetic fixtures: 4 `Employee`s (teacher-shaped, minted with `perms=['*']`
via `generate_access_token`'s kwarg passthrough — `is_superadmin=False` so
the tenant_id/central_teacher_id-stamping branch actually runs, same
technique as C5's "wildcard" token, more thorough than relying on the
superadmin bypass alone; coordinator-shaped, superadmin-flagged; plain,
no perms; one under the VMS tenant, not sms-subscribed) in central auth,
plus a local `Teacher`+`Coordinator` pair (with the M2M assignment between
them) in support-service's own vendored tables.

```
POST /api/requests/create/ (wildcard-perms teacher token,
  {"category":"facility","subject":"C6 Test Request",...})
  -> 201 Created, request_id: 1
  DB: tenant_id = <SMS01 tenant>, central_teacher_id = <this token's own
      UUID>, central_coordinator_id = NULL (flagged gap above),
      organization_id = NULL, teacher_id/coordinator_id = local FKs (unchanged shape)

GET /api/requests/my-requests/ (same token)          -> 200, the request above
GET /api/requests/1/ (same token)                    -> 200, full detail,
      status_history correctly shows the initial "submitted" entry

POST /api/requests/1/comment/ (same token, {"comment":"any update?"})
  -> 201 Created
GET /api/requests/1/ (same token, re-fetched)         -> 200, comments now
      shows the new comment — proves the reverse-accessor SerializerMethodField
      fix works both for write and read

GET /api/requests/coordinator/requests/ (superadmin-flagged coordinator token)
  -> 200, shows the same request (coordinator correctly resolved via
     get_coordinator's local DB match)
GET /api/requests/coordinator/dashboard-stats/ (same token)
  -> 200 {"total_requests":1,"submitted":1,...}

POST /api/requests/create/ (plain token, no sms.support.create)
  -> 403 "Missing required permission: sms.support.create."
POST /api/requests/create/ (VMS-tenant employee token — no sms subscription)
  -> 403 "Your organization does not have an active SMS subscription."
```

**Tenant isolation** (`RequestComplaint`, second row tagged directly to the
VMS tenant, same local teacher/coordinator FKs on purpose — proves the
isolation is on `tenant_id`, not the local FK match):
```
RequestComplaint(tenant_id=SMS01) + RequestComplaint(tenant_id=VMS_TENANT)
GET /api/requests/my-requests/ (SMS01 teacher token) -> count: 1 (only the SMS01 row)
```

**Legacy dual-run still works** — raw HS256 token (`ams_shared.jwt.validator`
shape, `role='teacher'`, matching the synthetic teacher's email). Needed
the synthetic `Teacher`/`Coordinator` rows to actually have an
`organization` set to match the legacy token's `org_id` claim (they didn't,
by default, since they were created directly via `_base_manager` for the
central-auth proof) — a **test-fixture gap, not a code bug**: legacy's
`OrganizationManager`-scoped queries correctly require a matching
`organization`, exactly as designed:
```
POST /api/requests/create/ (legacy token, org_id=5, matching teacher/coordinator
  now both tagged organization_id=5)
  -> 201 Created, request_id: 3
  DB: organization_id = NULL, tenant_id = NULL, central_teacher_id = NULL
  (organization was never auto-populated here even before this phase — the
  original RequestComplaintCreateSerializer.create() never set it, a
  pre-existing gap confirmed by reading the original code, not something
  this phase introduced or fixed — legacy behavior preserved exactly)
```

All synthetic data (4 Employees, 1 Teacher, 1 Coordinator, 1 synthetic
Organization, 3 RequestComplaints + their comments/status-history) deleted
after verification.

## Proof VMS/HDMS unchanged

```
manage.py check (auth_service)   -> System check identified no issues (0 silenced)
manage.py check (ams_support)    -> System check identified no issues (2 silenced)
POST /api/auth/login-vms (real employee_code, wrong password)
  -> 401 {"error": "invalid_credentials", "detail": "Incorrect password"}
  (endpoint round-trips correctly; seeded password unknown to this session,
  same limitation noted in every prior phase's equivalent check)
```

Central-auth suite: `5 failed, 66 passed, 25 errors` — identical to C5's
baseline, same pre-existing causes, no new failures or errors.
support-service has no exercised test suite (`manage.py test requests
form_builder` finds zero tests — `form_builder/tests.py` exists on disk
but is empty/boilerplate — consistent with every SMS service checked so
far).

## Confirmed untouched

- `central_auth/authentication.py`, `permissions.py`, `tenant.py`:
  byte-identical to the C1-C5 source (`jwks.py` is the one documented,
  justified exception — see above).
- `ams_shared/jwt/validator.py`, `users/middleware.py`, `users/permissions.py`
  (shared across services): not modified.
- `teachers.Teacher`, `coordinator.Coordinator`, `principals.Principal`,
  and their signal handlers (staff-service): not modified — `Coordinator.get_for_user`
  is called unchanged on the legacy path; `teacher_assigned_coordinators()`
  queries the M2M through-table directly rather than patching the model.
- Every other SMS service, VMS, HDMS, central auth's own code: untouched.
- The legacy local-`User`/session/org path: proven working unchanged
  (dual-run proof above, including the pre-existing `organization`-never-stamped
  gap left exactly as found).

## What's next

C7 is next, separately, per the 13-service plan. Also open, carried
forward: `sms.support.*`/`sms.form.manage` need a future catalog step;
`central_coordinator_id`/`central_principal_id` remain schema-only (no
endpoint today can supply the assigned person's central UUID, only their
local int/FK id — same residual pattern as C3/C4/C5's equivalent columns);
and — same as every prior phase — `Teacher`/`Coordinator`/`Principal`
still have no `tenant_id` of their own, so `find_teacher`/`find_coordinator`/
`find_principal`/`find_principal_for_campus` remain best-effort
`_base_manager` queries, not tenant-scoped guarantees.
