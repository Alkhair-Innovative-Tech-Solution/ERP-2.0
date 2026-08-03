# Phase B3 (BUILD): Generic RBAC via Option A — Result

Branch: `phase-b3-generic-rbac` (not merged to `main`). Scoped entirely to
`Auth-service-main/`. Built exactly the approved Option A from
`PHASE_B3_GENERIC_RBAC_ANALYSIS.md` — no reconsideration of approach.

## What was built

### 1. The 3 RBAC tables gained a `non_staff` arm

`permissions/models.py`, mirroring `UserCredentials`'
employee/superadmin/non_staff exactly-one-of shape (A2):

- **`ServiceAccess`** — added `non_staff` FK to `NonStaffIdentity`
  (nullable). `employee` was already nullable here (pre-existing
  employee/superadmin dual-FK). `clean()` widened from 2-way
  (employee/superadmin) to 3-way (employee/superadmin/non_staff),
  exactly-one-of.
- **`EmployeeRole`** — added `non_staff` FK (nullable). `employee` was
  **not** nullable before this change — widened to `null=True, blank=True`
  (additive/nullable-widening, no data loss: every existing row keeps its
  `employee` set, nothing backfilled). `clean()` now enforces exactly one
  of `{employee, non_staff}`, and the existing duplicate-role-at-scope
  check now also matches on `non_staff`.
- **`EmployeePermissionOverride`** — same treatment as `EmployeeRole`:
  `employee` widened to nullable, `non_staff` added, `clean()` widened.

One migration, `permissions/migrations/0016_employeepermissionoverride_non_staff_and_more.py`
— 3 `AddField` + 2 `AlterField` (nullable-widening only, no column drops,
no backfill).

### 2. `get_effective_permissions` generalized, with a backward-compatible default

`permissions/rbac.py` — every function that took an `employee_id` now
takes `(principal_id, principal_type="employee")`. The default means
**every pre-B3 call site that passes a single positional id keeps
resolving exactly as an employee** — nothing else in the codebase needed
to change. Confirmed by grepping every call site
(`authentication/jwt_utils.py:118-119`, `authentication/api.py:426`,
`permissions/utils.py:67`, `permissions/rbac_api.py:349` +
6 `clear_permission_cache` calls, and `permissions/test_rbac_engine.py`'s
9 direct calls) — all pass exactly one positional argument, all
unaffected.

The query generalization uses the fact that the new FK field is named
`non_staff` and the existing one `employee` — so `principal_type` doubles
directly as the Django ORM lookup field prefix
(`f"roles__employee_roles__{principal_type}_id"`), no per-type branching
logic to keep in sync:

```python
role_lookup = f"roles__employee_roles__{principal_type}_id"
override_lookup = f"{principal_type}_id"
```

`get_scoped_permissions` got the same treatment (third positional param,
default `"employee"`, so its one existing 2-arg call site is untouched).
`has_permission()` now detects principal type from the `user` object
itself (`isinstance(user, NonStaffIdentity)`) before calling the generic
functions — this is the one real behavior addition, since previously it
only ever saw `Employee`/`SuperAdmin` objects.

**Backward-compatible entry, concretely**: `get_effective_permissions(str(employee.id))`
— the exact call every existing caller makes — is untouched syntactically
and produces identical output, because `principal_type` defaults to
`"employee"` and the resulting query string is byte-identical to the
pre-B3 hardcoded query.

### 3. Cache key is now principal-scoped

```
_CACHE_KEY = "perms:{}:{}"            # perms:{principal_type}:{principal_id}
_PERM_VERSION_KEY = "permver:{}:{}"   # permver:{principal_type}:{principal_id}
```

(Previously `"rbac:emp:{}:permissions"` / `"rbac:emp:{}:perm_version"`.)
A student and an employee now can never collide in cache even in the
(already-impossible, since they're separate UUID spaces) event their ids
matched. Redis TTL is 5 minutes (`CACHE_TTL`), so the rename cost exactly
one cold-cache read per already-cached principal after deploy — no data
loss, no migration needed (it's a cache, not a table).

`clear_permission_cache`, `get_perm_version`, `bump_perm_version` all
took the same `(principal_id, principal_type="employee")` treatment.

**One real test regression from the rename, fixed**:
`permissions/test_rbac_engine.py` imported the private `_CACHE_KEY`
constant directly and called `_CACHE_KEY.format(str(employee.id))` —
a single-placeholder format call that raised `IndexError` against the
new 2-placeholder string. Updated both occurrences (2 tests:
`test_assign_role_clears_cache`, `test_create_override_clears_cache`) to
`_CACHE_KEY.format("employee", str(employee.id))` — this is the test
correctly tracking an intentional, approved behavior change (the cache
key shape), not a weakened check. Confirmed: `permissions/test_rbac_engine.py`
+ `test_rbac_foundation.py` → `63 passed` after the fix (0 failures).

### 4. `permissions/signals.py` cache-invalidation — both arms now covered

The `Role.permissions` M2M-changed handler previously only walked
`EmployeeRole.objects.filter(role=instance,...)` and called
`clear_permission_cache(str(er.employee_id))` unconditionally — would
have silently broken (cleared a cache key for `"None"`) the moment any
`EmployeeRole` row had `non_staff` set instead of `employee`. Now checks
which arm is populated and calls `clear_permission_cache` with the
correct `principal_type`.

### 5. `permissions/sms_catalog.py` — new, mirrors `vms_catalog.py`

5 `sms.*` permissions (assignment upload/view, fee pay/view, result
view), one "SMS Student" role template, and — the actual proof of Option
A — `assign_sms_role(principal, role_type, tenant=None)` and
`get_sms_role_type(principal)` that work for **either** an `Employee` or
a `NonStaffIdentity`, branching only on `isinstance(principal,
NonStaffIdentity)` to pick which FK kwarg to use. Same catalog, same
functions, same underlying `EmployeeRole` row shape — not a parallel
student system.

## Step 3 gate — proof Employee/VMS/HDMS resolution is byte-for-byte unchanged

Per the explicit ordering rule ("do not proceed until this is green"),
this was proven **before** touching anything student-related, via a real
before/after diff (not just an argument): `git stash`'d the B3 model/rbac/
signals changes to run the literal pre-change code against the
already-migrated DB (safe — the old code doesn't reference the new
nullable columns, so it runs identically regardless of schema), captured
`get_effective_permissions()` for every real employee in the system,
`git stash pop`'d back to the new code, captured again, diffed:

```
Captured (OLD code):
  VMST-B1-G-26-V-0001 -> ['vms.visit.checkout', 'vms.visit.create', 'vms.visit.view_own', 'vms.visitor.create', 'vms.visitor.view']
  VMST-B1-G-26-H-0002 -> ['hdms.ticket.close', 'hdms.ticket.create', 'hdms.ticket.view_own']

Captured (NEW code): identical values for both.

before == after: True
Byte-identical for all 2 employees checked.
```

Live login proof, same VMS/HDMS test accounts used throughout every prior
increment:

```
POST /api/auth/login-vms  (VMST-B1-G-26-V-0001) -> vms_role: receptionist, employee_code: VMST-B1-G-26-V-0001
POST /api/auth/login-hdms (VMST-B1-G-26-H-0002) -> role: assignee, permissions: {can_view_all_tickets: False, can_assign_tickets: False, can_close_tickets: True, can_manage_users: False}
```

Byte-identical to every prior increment's baseline. Only then did Step 4
(student path) begin.

## Proof: a student resolves correct permissions through the shared path

Created one synthetic `NonStaffIdentity` (`SMS01-STU-B3TEST`, tenant
`SMS01`), seeded the SMS catalog, assigned the "SMS Student" role via
`assign_sms_role()`:

```
Catalog permissions: 5 new / 5 total
Catalog role templates: 1 new
Assigned SMS Student role to SMS01-STU-B3TEST

get_sms_role_type -> student
get_effective_permissions(non_staff) -> ['sms.assignment.upload', 'sms.assignment.view', 'sms.fee.pay', 'sms.fee.view', 'sms.result.view']
Matches expected template: True

has_permission(student, sms.assignment.upload): True
has_permission(student, sms.fee.pay): True
has_permission(student, vms.visit.create) [should be False]: False
```

Then proved both override directions, the same formula
`(role_permissions ∪ allowed) − denied` that's always governed
`get_effective_permissions`, now exercised for a non-employee principal
for the first time:

```
ALLOW override (sms.transport.view, not in the role): has_permission -> True
DENY override (sms.fee.pay, IS in the role): has_permission -> False (blocked correctly)
Unaffected role permission (sms.assignment.upload): has_permission -> True (still intact)

final effective perms: ['sms.assignment.upload', 'sms.assignment.view', 'sms.fee.view', 'sms.result.view', 'sms.transport.view']
```
(`sms.fee.pay` correctly absent — denied; `sms.transport.view` correctly
present — allowed extra; everything else from the role untouched.)

This is the exact same `EmployeeRole`/`EmployeePermissionOverride`/
`get_effective_permissions` code path an employee uses — no
student-specific branch anywhere except the one `isinstance` check in
`has_permission()` and `sms_catalog.py`'s two helpers that pick which FK
kwarg to populate.

## Synthetic data: cleaned up

Deleted after verification: the `NonStaffIdentity` test student, its
`UserCredentials`, its `EmployeeRole` assignment, both
`EmployeePermissionOverride` rows. `NonStaffIdentity.objects.count()` back
to 0.

**Kept**, same precedent as B1's "SMS Staff" Department/Designations: the
`sms_catalog.py` seed content itself — 6 `Permission` rows (5 original +
`sms.transport.view` added during the override test) and 2 `Role` rows
(the global "SMS Student" template + its SMS01-tenant instantiation).
This is reusable catalog infrastructure, not test data — the real import/
role-assignment flow (B1/B2's importers, once wired to real SMS data)
will reuse these same rows via the catalog's own `get_or_create` idempotency,
not recreate them.

## Final verification

```
manage.py check   -> System check identified no issues (0 silenced)
pytest permissions/ authentication/ -> 63 passed, 2 failed, 10 errors
```

Identical count to the baseline established in every prior increment's
result doc — same pre-existing causes (`TestGrantHdmsAccessAPI`/
`TestCheckHdmsAccessAPI`'s known issue, unrelated `dept_sector` fixture
family). No new failures.

## Confirmed untouched / explicitly deferred (per the analysis)

- `AuthBearer.authenticate()` / the login endpoint — still only
  recognizes `Employee`/`SuperAdmin`. No student login flow built here;
  the whole proof above uses direct calls, matching how B1/B2 proved
  their mechanisms.
- `permissions/rbac_api.py` — the admin REST API for role/override CRUD
  is untouched; every one of its `get_effective_permissions`/
  `clear_permission_cache` calls is a single-positional-arg call and
  keeps working via the backward-compatible default, but it still only
  accepts `employee_id` as input. Generalizing the HTTP surface (so an
  admin UI could grant a student a role) is a separate, later change.
- No student-specific role table was created at any point — the one
  model set (`EmployeeRole`/`EmployeePermissionOverride`/`ServiceAccess`)
  now serves both principal types, per Option A.

## What's next

Not done here: **B4** (repoint `sync_staff_to_auth` at central auth) and
**Phase C** (repoint the 13 SMS services off their local `User` FK, one
at a time) — both separate, later steps per the plan.
