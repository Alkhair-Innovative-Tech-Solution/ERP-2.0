# Phase C11: Repoint org-service onto Central Auth — Result

Branch: `phase-c11-org-service` (off `main`, not merged). Scoped to
`org-service/` only, per the prompt. The "diverged fork" service — it owns
its own `User` model AND billing (`SubscriptionPlan`/`Invoice`). Per the
prompt's explicit DO-NOT list, neither was touched: no fields removed,
no username-generation/role logic changed, no billing split. This doc
records the audit table, the `AllowAny` finding, why the dual-role
mechanism looks different here than in every prior phase, and the
synthetic proofs.

## The one thing that made this phase different from C1–C10

Every prior phase's role gating lived cleanly inside a handful of DRF
permission classes — "dual-safe" meant writing a parallel dual class per
role. org-service's role checks are **not** contained that way. Audited
across `users/views.py` (2500+ lines), `users/middleware.py`, and
`users/managers.py`: **~40 inline call sites** do `request.user.is_superadmin()`,
`request.user.role == 'org_admin'`, `request.user.is_org_admin_role()`,
etc., directly in view bodies, in `OrganizationMiddleware`'s own manual
authentication fallback, and in `OrganizationManager`/`MultiTenantUserManager`'s
`get_queryset()`. Two concrete crash classes, both confirmed live:

1. **`is_superadmin` shape mismatch.** org-service's own `User` model AND
   `ams_shared`'s `_TokenUser` both define `is_superadmin` as a **method**
   (`def is_superadmin(self): return self.role == 'superadmin'`). The
   shared `central_auth.CentralAuthUser` template defines it as a plain
   **bool claim** (`self.is_superadmin = bool(claims.get(...))`). Every
   `request.user.is_superadmin()` call site would raise `TypeError: 'bool'
   object is not callable` on a raw `CentralAuthUser`.
2. **The `is_org_admin_role()` crash the prompt named up front.**
   `CentralAuthUser` has no `.role`, `.is_org_admin_role()`,
   `.is_principal()`, `.is_coordinator()`, `.is_teacher()`, `.is_admin()`
   at all — AttributeError on every one of those call sites.

A handful of new dual permission classes would leave every one of those
~40 call sites still broken — the C3 pattern assumes role checks are
isolated in permission classes, which isn't true here. So instead of
patching call sites one at a time (including two in shared infrastructure
— the middleware and the manager — that no permission class could reach
anyway), `org_service/dual_auth.py` introduces **`OrgCentralAuthUser`**,
a `CentralAuthUser` subclass returned by `DualAuthentication` for a
central token instead of the raw class:

- `isinstance(x, CentralAuthUser)` stays `True` everywhere else (`DualServiceSubscribed`,
  `DualRequiresPermission`, `central_person_id`, `central_tenant_qs`) — nothing else needed to change.
- `.is_superadmin` becomes a `_BoolCallable` — a tiny wrapper that's both
  a bool (`__bool__`) for `CentralAuthUser`'s own inherited `has_service()`/`has_perm()`
  (`return self.is_superadmin or ...` — truthiness, unchanged) **and** callable
  (`__call__`) for org-service's own `.is_superadmin()` convention, from
  the exact same underlying flag. (Naively overwriting the attribute with
  a bound method/lambda would make it always-truthy in the `or` context
  and silently defeat subscription/permission checks for every
  non-superadmin central token — caught before it shipped.)
- `.role = None`, `.organization = None` (resolved per-request via
  `tenant_id`, see below), `.is_org_admin = False`, and
  `.is_org_admin_role()`/`.is_principal()`/`.is_coordinator()`/`.is_teacher()`/
  `.is_admin()`/`.is_student()` all return `False`.

Every existing role class in `permissions.py` (`IsSuperAdmin`, `IsOrgAdmin`,
`IsPrincipal`, `IsCoordinator`, `IsTeacher`, `IsAdmin`) therefore works
**unchanged** for a central token — imported as-is, `permissions.py` never
touched. And because `.role is None` naturally fails every `==`/`in`
comparison rather than raising, all ~40 inline call sites became dual-safe
from this one class, not 40 edits.

## Fail-closed, per the prompt's own instruction

"Don't invent catalog perms — flag gaps (fail closed)." Checked: org-service's
role concepts (org_admin/principal/coordinator/teacher/admin) have **no**
equivalent anywhere in central auth today.
- `permissions/sms_catalog.py`'s `SMS_ROLE_TEMPLATES` defines only `"SMS
  Student"`.
- `employees/sms_import.py`'s own docstring confirms staff roles are
  imported as a `Designation.position_code` label under a shared "SMS
  Staff" department, explicitly **not** wired into the RBAC catalog
  (Role/EmployeeRole/ServiceAccess) — deferred to a "Phase B3" that, when
  it landed, only ever covered students.
- The central token carries `is_superadmin` (a separate, platform-wide
  flag) and `perms` (empty for staff, since B3 never wired them) — no
  `role` claim shaped like org-service's own `ROLE_CHOICES` at all.

So: **a central token can satisfy `IsSuperAdmin` in org-service and
nothing else**, until a future phase builds an SMS staff-RBAC catalog.
Every `IsOrgAdmin`/`IsPrincipal`/`IsCoordinator`/`IsTeacher`/`IsAdmin`
gate fails closed (403, not a crash) for a non-superadmin central token —
confirmed in the proof below. `DualRequiresPermission` (the `sms.*`
codename wrapper, C1-C10 shape) is defined for parity but not wired into
any org-service view this phase — org-service's gates are role-based, not
permission-codename-based, and no catalog codename maps to its admin-tier
concepts.

## Audit table

| Field | Model | Category | Treatment |
|---|---|---|---|
| `SubscriptionPlan.created_by` | billing | audit person-FK | `central_created_by_id` (additive, nullable) |
| `Organization.created_by` | Organization | audit person-FK | `central_created_by_id` (additive, nullable) |
| `Invoice.approved_by` | billing | audit person-FK | `central_approved_by_id` (additive, nullable) |
| `Organization` (the row itself) | Organization | — | `tenant_id` (1:1, unique — see below) + `central_org_id` |
| `User` (the whole model: role, is_org_admin, username generation, save()) | User fork | **fork — LEAVE** | untouched, confirmed byte-identical |
| `RolePermission` (model + `get_role_permissions`/`toggle_permission` business logic) | role logic | **LEAVE** | untouched — see "what was NOT changed" below |
| `SubscriptionPlan`/`Invoice` (the models + CRUD logic) | billing | **LEAVE (structure)** | untouched — only the 2 audit-FK columns above added |
| `User.organization`, `User.campus`, `Invoice.organization`/`.plan`, `Organization.plan` | domain/other-model FKs | not a central-auth person concern | untouched |

**`Organization.tenant_id` is a 1:1 mapping, not a per-row scoping value**
— unlike every other SMS service's `tenant_id` (many rows, one tenant),
here ONE Organization row conceptually **is** the same real-world org as
ONE central-auth Tenant. Marked `unique=True` for that reason. `_get_org()`
(`users/views.py`) resolves a central token's Organization by matching this
field against the token's own `tenant_id` claim — this is the single
highest-leverage fix in this phase: `_get_org()` is already called from
~12 places across `views.py` (permission checks, dashboard, staff list,
toggle-active, switch-role, invoice endpoints), so fixing it once fixed
all of them.

`central_org_id`: central auth models `Tenant` → `Organization` as a
separate 1:many relation (`Tenant.organizations.first()`, per
`employees/sms_import.py`'s `_get_sms_org()`) — this field is schema-ready
for stamping the matching central `Organization` id, but `tenant_id` above
is what's actually used for matching/filtering.

## The `AllowAny` finding

The prompt named `views.py:130` (`UserLoginView`) specifically — confirmed
correctly public by design (the login endpoint). But grepping the whole
file found **11 more** `@permission_classes([AllowAny])` endpoints, not
mentioned by name in the prompt: `check_password_change_required`,
`first_login_change_password`, `send_password_change_otp`,
`verify_password_change_otp`, `change_password_with_otp`,
`student_direct_password_change`, `send_forgot_password_otp`,
`verify_forgot_password_otp`, `reset_password_with_otp`. All are
password-reset/OTP flows operating **exclusively on the local User fork's
own password** (`User.set_password()`, `PasswordChangeOTP`) — inherently
unauthenticated by design (a forgot-password flow can't require being
logged in), gated by email+OTP possession instead of a token, and entirely
outside central-auth's concern (no `request.user` check anywhere in these
bodies). Confirmed correctly public, no fix needed, no interaction with
central-auth at all — same "check it, confirm it's actually safe" finding
shape as C7's `AllowAny` endpoint.

## Two bugs found live (not by reading), fixed for both token types

**1. `OrganizationListCreateView` had no `permission_classes` at all.**
Its sibling `OrganizationDetailView` right below it gates on
`(IsSuperAdmin | IsAdmin)`; `OrganizationListCreateView` inherited the bare
`[IsAuthenticated]` default. `get_queryset()`'s own role-branching already
implied superadmin/admin-only (anyone else got `.none()`), so this was a
genuine gap — reachable by **any** authenticated user, and
`perform_create()`'s `created_by_id=user.id` fallback for a non-superadmin
caller would have crashed on a central token (UUID into an integer FK
column) had it not been caught here. Fixed to match the Detail view's
existing gate — this is a pre-existing gap affecting legacy too, not
central-auth-specific, so fixed for both.

**2. `OrganizationMiddleware` only knew about `ServiceJWTAuthentication`.**
This middleware runs its own manual authentication (DRF's
`authentication_classes` chain hasn't executed yet at middleware time —
`request.user` is still Django's `AnonymousUser`). It directly instantiated
`ServiceJWTAuthentication()` with no fallback. A central-auth (RS256)
token would fail HS256 decoding, get swallowed by the existing broad
`except`, and leave the thread-local context vars (`get_current_user()`/
`get_current_organization()`) unset for the **entire request** — making
every `OrganizationManager`-backed `.objects` query blind for central-auth,
the same C5-class hazard as every prior phase's queryset, just
manifesting through middleware instead of a manager directly. Fixed:
routes on the token's own `alg` header (same technique as
`DualAuthentication`), and — new in this phase — resolves `.organization`
via the same `tenant_id` match `_get_org()` uses, so `OrganizationManager.get_queryset()`'s
existing `if org: return queryset.filter(organization=org)` branch (and
`RolePermission.objects`, `MultiTenantUserManager`) now work correctly
for a central token too, without touching `RolePermission`'s own code at
all.

## Endpoint → gate map (touched this phase)

| Endpoint | Legacy gate | Central gate |
|---|---|---|
| `POST /auth/login/` + 9 OTP/password endpoints | `AllowAny` | unchanged — see finding above |
| `GET/POST /organizations/` | `IsAuthenticated, (IsSuperAdmin\|IsAdmin)` (gate added this phase) | + `DualServiceSubscribed`; only superadmin passes (IsAdmin fails closed) |
| `GET/PATCH/DELETE /organizations/<id>/` | same combo (pre-existing) | + `DualServiceSubscribed`; superadmin only |
| `GET /organizations/my-dashboard/` | `IsAuthenticated` | + `DualServiceSubscribed` (via settings default); resolves via `_get_org()`'s new tenant_id branch |
| `GET/POST /plans/`, `GET/PATCH/DELETE /plans/<id>/` | `IsAuthenticated, (IsSuperAdmin\|IsAdmin)` | + `DualServiceSubscribed`; superadmin only (SubscriptionPlan.objects itself was never blind — plain manager, not org-scoped) |
| `GET /invoices/`, `GET /invoices/<id>/` | role-branched (superadmin/admin/org_admin) | superadmin sees all; non-superadmin fails closed to empty (not a crash) |
| `POST /invoices/<id>/upload-receipt/`, `/approve/`, `/reject/` | role-checked inline | fails closed (`.role is None` never matches) — org_admin/admin-equivalent not resolvable for central yet |
| `users/org-staff/`, `toggle-active`, `switch-role`, `permissions/*` | `IsOrgAdmin`/superadmin-gated, mutates the User fork | fails closed for central (User-fork mutation correctly stays out of central-auth's reach — no fork wiring attempted) |

`DEFAULT_PERMISSION_CLASSES` gained `DualServiceSubscribed` (no-op for
legacy, gates central tokens on the `sms` service claim) — covers every
endpoint that relies on the bare default; the handful with explicit
`permission_classes` (DRF replaces, not appends, the default list) got it
added by hand where touched above.

## `AUTH_SERVICE_URL` naming collision — confirmed, worked around

org-service **already** has an `AUTH_SERVICE_URL` env var, read directly
via `os.environ.get('AUTH_SERVICE_URL', 'http://auth-service:8001')` in
several places in `views.py`/`serializers.py` — pointing at a **third,
separate legacy Python service** (org/user-sync on :8001), unrelated to
either SMS's central-auth repoint or the Enterprise-Resource-Planning
Auth-service-main. `central_auth/jwks.py` (unchanged, copied as-is from
every prior phase) reads `settings.AUTH_SERVICE_URL` — a **Django
setting**, not the raw env var. Used a distinct env var name,
`CENTRAL_AUTH_SERVICE_URL`, feeding `settings.AUTH_SERVICE_URL` in
`settings.py` — the pre-existing raw `AUTH_SERVICE_URL` env var and every
call site that reads it directly are completely untouched.

## Pre-existing, confirmed, NOT fixed (out of scope)

- **The legacy `is_org_admin_role()` crash the prompt flagged as "known".**
  `get_role_permissions`/`toggle_permission` call
  `request.user.is_superadmin() or request.user.is_org_admin_role()` —
  `ams_shared._TokenUser` (the LEGACY user object) has no
  `is_org_admin_role()` at all. Confirmed still present and unrelated to
  this phase — every legacy non-superadmin request to these two endpoints
  was already broken before Phase C11. Not fixed (out of scope per "if
  hit, handle on central path, note it" — the central path was made safe
  by `OrgCentralAuthUser`, which does define `is_org_admin_role()`; the
  legacy gap is unrelated and pre-dates this phase).
- **`Invoice.id`'s AutoField vs `DEFAULT_AUTO_FIELD=BigAutoField` drift.**
  `makemigrations` proposed an unrelated `AlterField` changing `Invoice.id`'s
  underlying column type — a pre-existing mismatch between migration
  history and settings, unrelated to central-auth. Deliberately excluded
  from the additive migration in this phase; still shows up on
  `makemigrations --check` (expected, confirmed, not a regression).
- **Org creation via central-auth doesn't stamp `tenant_id`.** There's no
  source of truth in this service for "which central-auth tenant does
  this brand-new org belong to" at creation time (the creating
  superadmin's own tenant isn't necessarily the new org's tenant, and
  `OrganizationCreateSerializer` has no field to carry a target tenant
  explicitly) — `central_created_by_id` is stamped, `tenant_id` stays
  NULL. Flagged for a future dedicated provisioning-flow phase.
- **User fork + billing structure: confirmed completely untouched.** No
  field removed/renamed on `User`, no change to `save()`'s username
  generation, no change to `RolePermission`'s model or its two endpoints'
  business logic, no change to `SubscriptionPlan`/`Invoice`'s shape beyond
  the 2 additive audit-FK columns. The org-CREATE flow still spawns a
  local admin `User` row (`role='org_admin'`) and syncs it to the legacy
  auth-service webhook exactly as before — a central-auth superadmin
  triggering org-CREATE reuses this unchanged, doesn't replace it.

## Proof on synthetic data

Environment: `org-service` built and started for the first time this
phase (first-time bring-up, matching the pattern for every not-yet-started
service in this project).

Synthetic fixtures: 3 `Employee`s (superadmin-flagged central token, a
non-superadmin "org-admin-shaped" central token with no catalog role at
all, a VMS-only-tenant token with no `sms` service), 2 `Organization` rows
(`tenant_id` = SMS01 tenant and a different synthetic tenant respectively
— `org.created`-style signals auto-created a matching `Invoice` and 552
default `RolePermission` rows per org, confirming those signals are
unaffected).

```
(a) GET /api/organizations/ (central superadmin token)         -> 200, both orgs (superadmin sees all)
    GET /api/organizations/1/ (central superadmin token)       -> 200
(b) GET /api/organizations/ (central org-admin-shaped, non-superadmin) -> 403 (fail-closed, no catalog mapping)
(c) (IsSuperAdmin | IsOrgAdmin)-combo: superadmin branch passes (200 above),
    non-matching branch correctly denies (403 above) — same combo, both outcomes proven
(d) GET /api/organizations/ (VMS-only tenant token, no sms subscription) -> 403
    GET /api/organizations/my-dashboard/ (central org-admin-shaped, SMS01 tenant)
      -> 200, org id=1 (SMS01) — the OTHER tenant's org (id=2) correctly absent
(e) GET /api/organizations/ (legacy HS256 superadmin token)     -> 200, both orgs — unchanged
    GET /api/organizations/ (legacy HS256 teacher token)        -> 403 — unchanged
    GET /api/organizations/my-dashboard/ (legacy teacher, org_id=1 claim) -> 200 — unchanged
    GET /api/invoices/ (legacy superadmin token)                -> 200, both invoices — billing works on legacy
    GET /api/plans/ (legacy superadmin token)                   -> 200 — billing works on legacy

Central-path billing (bonus, not required by the test but proven anyway):
    GET /api/invoices/ (central superadmin token)               -> 200, both invoices
    GET /api/invoices/ (central org-admin-shaped, non-superadmin) -> 200, empty (fail-closed, no crash)
    GET /api/plans/ (central superadmin token)                  -> 200
```

All synthetic data (2 `Organization`, 2 auto-created `Invoice`, 552
auto-created `RolePermission`, 3 `Employee`s) deleted after verification —
confirmed via direct row-count queries (`0`) post-cleanup.

## Proof VMS/HDMS unchanged

```
manage.py check (auth_service)  -> System check identified no issues (0 silenced)
manage.py check (org-service)   -> System check identified no issues (0 silenced)
pytest (auth_service)           -> 5 failed, 66 passed, 25 errors — identical to every prior phase's baseline
POST /api/auth/login-vms (nonexistent employee_code)
  -> 401 {"error": "invalid_credentials", "detail": "Employee code not found or account inactive"}
```

## Confirmed untouched

- `central_auth/authentication.py`, `jwks.py`, `permissions.py`:
  byte-identical to the C1-C10 template.
- `users/permissions.py`: not modified at all — every role class works
  unchanged for both token types via the `OrgCentralAuthUser` adapter.
- `users/models.py`'s `User`, `RolePermission`: untouched beyond the 3
  additive nullable columns on `SubscriptionPlan`/`Organization`/`Invoice`.
- `get_role_permissions`/`toggle_permission`'s business logic: untouched
  (their pre-existing legacy crash risk is unrelated, see above).
- The legacy `ServiceJWTAuthentication`/`_TokenUser` path: proven working
  unchanged end-to-end (dual-run proof above).
- Every other SMS service, VMS, HDMS, central auth's own code: untouched.

## What's next

Per this phase's own closing instruction: staff-service (last of the 13,
with the `assign_teacher` hang fix) is next, separately. Also carried
forward as documented gaps above: an SMS staff-RBAC catalog (so
org_admin/principal/coordinator/teacher become resolvable for central
tokens, not just superadmin) is Phase D-adjacent work; org creation via
central-auth needs a real tenant-provisioning design before `tenant_id`
can be stamped at creation time; the pre-existing `is_org_admin_role()`
legacy crash and the `Invoice.id` migration drift are both flagged but
untouched, out of scope for this phase.
