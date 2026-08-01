# Phase A2: Central Auth Non-Staff (Student) Identity — Result

Branch: `phase-a2-central-auth-student-identity` (not merged to `main`).
Scoped entirely to `Auth-service-main/`. No SMS/VMS/HDMS service touched.
No SMS data imported. No student login endpoint built.

## Locked decisions (given, not re-litigated)

- Central auth holds **identity only** (login + role + tenant) for
  everyone, including students. Profile data (roll number, class, family
  info) stays in SMS, linked by `user_id` — same "identity central, profile
  local" split VMS/HDMS already use in production.
- Destination tenant already exists: `SMS01` (Increment 4b).

## Step 1 — Analysis

### 1. How is identity/login structured today?

**Credential/token storage is already separable from `Employee`** — it
just wasn't obvious because only two types have ever used it:

- `UserCredentials` (`authentication/models.py:22-115`, pre-change) holds
  `password_hash`, `last_login`, `failed_login_attempts`, `locked_until` —
  linked via **two parallel nullable `OneToOneField`s**, `employee`
  (L35-42) or `superadmin` (L44-51), with `clean()` (L98-104) enforcing
  exactly one set. `RefreshToken` (L142-229) and `ServiceAccess`
  (`permissions/models.py:106-230`) use the identical dual-FK shape.
- `SuperAdmin` (`authentication/superadmin_models.py:13-87`) is already a
  **non-Employee identity in production**: `id`, `superadmin_code`,
  `full_name`, `email`, `phone`, `is_active`, an *optional* `organization`
  FK (L56-63). No department, no branch, no designation, no
  `employee_code`. It proves the "identity without HR shape" concept
  already works and has for as long as this service has existed.
- JWT generation (`authentication/jwt_utils.py:42-85`) is **duck-typed**,
  not type-checked: `generate_access_token(user, **kwargs)` builds its
  payload entirely from `getattr(user, ...)` — `user.id`, `user.full_name`,
  `user.email`, `user.is_active`, `getattr(user, 'superadmin_code', None)
  or getattr(user, 'employee_code', None)` for the `code` claim,
  `getattr(user, 'tenant_id', None)` for tenant scoping (L105). It does
  not `isinstance()`-check `Employee` anywhere. Any object shaped
  correctly already mints a working token.

**What is fused to `Employee`, not separable without change:**

- The login endpoint (`authentication/api.py:117-141`, pre-change) and
  `AuthBearer.authenticate()` (L88-112) hard-code exactly two lookups:
  `Employee.objects.get(employee_code=...)` then, on failure,
  `SuperAdmin.objects.get(superadmin_code=...)`. A third type is invisible
  to both until code is added — correctly out of scope here, since Step 2
  explicitly excludes building a login flow.
- Role/permission **resolution** — `EmployeeRole`,
  `EmployeePermissionOverride` (`permissions/models.py:388-490`) carry
  only a single `employee` FK, no `superadmin`/generic option.
  `get_effective_permissions()` (`permissions/rbac.py:27-62`) filters
  literally by `roles__employee_roles__employee_id=employee_id`.
  `SuperAdmin` never needed this because `has_permission()`
  (`rbac.py:103-117`) short-circuits: `isinstance(user, SuperAdmin): return
  True` (L111-112) — superadmin bypasses all checks. A student needs real,
  scoped permissions, not a blanket bypass, so this gap is real — see §3.

### 2. Where does a student identity attach?

Three options weighed, per the prompt:

- **(a) Generic `Identity`/`User`** that `Employee` and a future
  `Student`-profile both point at. Cleanest long-term, but touches every
  dual-FK site (`UserCredentials`, `RefreshToken`, `ServiceAccess`) plus
  `AuthBearer`, the login endpoint, and `EmployeeRole` all in one step —
  too large a blast radius for a single migration-safe increment, and the
  prompt explicitly allows deferring this.
- **(b) `person_type`/`is_student` flag + nullable HR fields on `Employee`
  itself.** Rejected outright, not just deprioritized: `EmployeeAssignment`
  (which drives `Employee.employee_code` generation, `models.py:490-522`)
  has **non-nullable** `department` and `designation` FKs
  (`models.py:469-470`). A student has neither. Loosening those
  constraints to accommodate a student would weaken guarantees VMS/HDMS
  employee data relies on today — directly violates "no department/branch/
  designation."
- **(c) A separate lightweight identity that reuses the same
  credential/token machinery.** This is, in effect, exactly what
  `SuperAdmin` already is and has been proven safe as. Recommended and
  **confirmed by the user** before any build.

**Recommendation: (c).** Built as `NonStaffIdentity`
(`authentication/nonstaff_models.py`), deliberately generalized beyond
"student" in name only (SMS's own role catalog also has `donor`, per the
Phase A1 reconciliation doc) but scoped to exactly the `student` case in
content — `person_type` is a single-choice field today, extending it later
is a one-line addition, not a schema change.

### 3. How do role & permissions attach for a non-employee?

Today, attachment is 100% keyed to `Employee`: `ServiceAccess.employee`,
`EmployeeRole.employee`, `EmployeePermissionOverride.employee`
(`permissions/models.py:123-130, 391-395, 442-446`). None of these have a
`non_staff_identity` arm. Generalizing all three (plus
`get_effective_permissions()`'s query) to a third FK is real, non-trivial
work — and premature: no SMS-side login flow exists yet to define what
permissions a student actually needs, so building the plumbing now would
be guessing at a shape.

**Scoped out of this step, by design.** `NonStaffIdentity.role` is a
plain `CharField` (`nonstaff_models.py`, field `role`) — an attribute the
identity *carries*, not a live RBAC resolution path. This satisfies Step
2's literal ask ("credentials + role + tenant, no HR fields") without
pretending permission enforcement exists yet. The next phase that builds
an actual SMS student login endpoint will need to either (i) extend
`ServiceAccess`/`EmployeeRole`/`EmployeePermissionOverride` with a third FK
arm, or (ii) build a parallel role-assignment model — a decision to make
once real SMS student permission requirements are known, not guessed now.

## Step 2 — What was built (the migration-safe minimum)

Two files changed, one migration, both purely additive:

1. **`authentication/nonstaff_models.py`** (new file, mirrors
   `superadmin_models.py`'s shape) — `NonStaffIdentity(SoftDeleteModel)`:
   `id` (UUID pk), `tenant` (FK to `employees.Tenant`, `on_delete=PROTECT`,
   **required** — unlike `Employee.tenant`, there's no HR chain to derive
   it from), `person_type` (choices, `default='student'`), `identity_code`
   (unique, the login identifier — analogous to `employee_code`/
   `superadmin_code`), `full_name`, `email` (optional), `role` (free-form,
   see §3), `is_active`. No department, branch, designation, or
   employee_code field exists on this model at all.

2. **`authentication/models.py`** — added `UserCredentials.non_staff_identity`
   as a third nullable `OneToOneField` alongside the existing `employee`/
   `superadmin` fields, and widened `clean()` from a 2-way to a 3-way
   exactly-one check (still raises `ValidationError` if zero or more than
   one is set — verified live, see below). Updated `__str__` to handle the
   third case. `RefreshToken`, `ServiceAccess`, `EmployeeRole` — **not
   touched**, per §3's scoping decision (no login flow to serve yet).

3. **`authentication/migrations/0006_nonstaffidentity_usercredentials_non_staff_identity.py`**
   — `CreateModel(NonStaffIdentity)` + `AddField(usercredentials,
   non_staff_identity, null=True, blank=True)`. Two operations, both
   additive; nothing altered or dropped on any existing table.

## Proof: non-employee identity can be stored

```
docker exec auth_service python manage.py shell -c "..."

--- Created ---
NonStaffIdentity id: 87e98f31-727f-46b5-b783-48957c4076c2
tenant: SMS01
person_type: student
identity_code: SMS01-STU-0001
full_name: Phase A2 Test Student
role: student
is_active: True
has department/branch/designation/employee_code fields? False False

--- Credentials ---
credentials id: a4b962de-0b93-425a-990c-be2847cbe27b
password check (correct): True
password check (wrong): False
employee: None
superadmin: None
non_staff_identity: Phase A2 Test Student (SMS01-STU-0001)

--- Reverse lookup via related_name ---
tenant.non_staff_identities.count(): 1
```

Three-way validation confirmed both directions:

```
OK zero-linked rejected: ['Must link to either an Employee, SuperAdmin, or NonStaffIdentity']
OK double-linked rejected: ['Cannot link to more than one of Employee, SuperAdmin, NonStaffIdentity', ...]
```

Test row deleted after the proof — this step imports no real SMS data, per
the rules.

## Proof VMS/HDMS/superadmin unchanged

```
manage.py migrate  -> Applying authentication.0006_..._non_staff_identity... OK
manage.py check    -> System check identified no issues (0 silenced)

POST /api/auth/login-vms (VMST-B1-G-26-V-0001)
  tenant_id: 5aa5b29a-6a94-4349-ab57-81d48f27fe5c
  services: [vms, hdms]
  perms: [vms.visit.checkout, vms.visit.create, vms.visit.view_own, vms.visitor.create, vms.visitor.view]
  perm_version: 1
  role: receptionist

POST /api/auth/login-hdms (VMST-B1-G-26-H-0002)
  tenant_id: 5aa5b29a-6a94-4349-ab57-81d48f27fe5c
  services: [vms, hdms]
  perms: [hdms.ticket.close, hdms.ticket.create, hdms.ticket.view_own]
  perm_version: 1
  role: assignee
```

Byte-identical to every prior increment's verified run (same tenant_id,
same perms lists, same roles — see `CLEANUP_SIS_REMOVAL_RESULT.md` for the
baseline these are compared against).

Superadmin: `/api/auth/login` was hit with a guessed password and
correctly returned `401 Invalid credentials / Incorrect password` — not a
regression, just a wrong guess (the real credential wasn't looked up to
avoid risking a lockout on a shared dev account). `authentication/api.py`
was not modified in this step (confirmed — the login/`AuthBearer` code is
untouched), and the 401 response proves the endpoint still executes
cleanly through credential lookup and password verification.

Full suite: `docker exec auth_service python -m pytest permissions/
authentication/ -q` → `63 passed, 2 failed, 10 errors` — identical count
and identical pre-existing cause (`conftest.py`'s `sample_department`
fixture) to every prior increment's baseline. No new failures.

## Confirmed untouched

- `Employee`, `EmployeeAssignment`, `Department`, `Designation`, `Branch`,
  `Institution`, `Organization`, `Tenant` models: no field, no Meta, no
  method changed.
- `authentication/api.py`, `authentication/jwt_utils.py`,
  `authentication/superadmin_models.py`: unmodified.
- `permissions/models.py` (`ServiceAccess`, `EmployeeRole`,
  `EmployeePermissionOverride`, `Role`, `Subscription`): unmodified.
- VMS, HDMS, SMS backends: nothing outside `Auth-service-main/` was
  touched.

## What's next (not this step)

- No student login endpoint exists yet — `AuthBearer`/`/api/auth/login`
  still only recognize `Employee`/`SuperAdmin`.
- No role/permission catalog wiring for `NonStaffIdentity` — `role` is
  currently a label, not an enforced permission set (§3).
- No SMS data imported — `NonStaffIdentity` table is empty in normal
  operation until Phase B explicitly populates it.

These are intentionally deferred — this step's only job was making
central auth *capable* of holding a non-employee identity, not wiring one
up end-to-end.
