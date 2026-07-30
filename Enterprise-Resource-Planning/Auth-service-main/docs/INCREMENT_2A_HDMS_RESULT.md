# Increment 2a: HDMS in Central Auth — Result

HDMS now sits on the exact same catalog-driven multi-tenant model VMS uses
(Increment 0). `HdmsRole` — the hardcoded role model — is gone; HDMS
permissions and roles are data. Verified live against a running instance
(commands below).

**Done:** HDMS permissions + 4 default role templates exist in the catalog;
the test tenant (VMST — reused, see "Decisions" below) has an active `hdms`
Subscription and a test employee with a catalog HDMS role who logs in and
gets a token with `services:["vms","hdms"]` and `perms` scoped to their
role; `HdmsRole` and every reference to it are gone; test suite is at the
same pass/fail baseline as Increment 0 (no new failures).

## What was built

### Step 1 — HDMS catalog
- New `permissions/hdms_catalog.py`, structured identically to
  `vms_catalog.py`: 6 namespaced permissions (`hdms.ticket.create`,
  `hdms.ticket.view_own`, `hdms.ticket.view_all`, `hdms.ticket.assign`,
  `hdms.ticket.close`, `hdms.user.manage`) and 4 default role templates
  (`HDMS Admin`, `HDMS Moderator`, `HDMS Assignee`, `HDMS Requestor`,
  tenant=null, `is_template=True`).
- New management command `seed_hdms_catalog` (global catalog only, no
  tenant) — mirrors `seed_vms_catalog`.
- Permissions were **derived, not invented**: the old `HdmsRole.save()` set
  4 booleans per role_type (`can_view_all_tickets`, `can_assign_tickets`,
  `can_close_tickets`, `can_manage_users`) — those map 1:1 to
  `hdms.ticket.view_all` / `hdms.ticket.assign` / `hdms.ticket.close` /
  `hdms.user.manage`. `hdms.ticket.create` / `hdms.ticket.view_own` aren't
  boolean fields on the old model (no role type had them as flags) but are
  the explicit baseline every role had via `ServiceAccess` alone — most
  clearly stated in the old model's own docstring: *"Requestor: Can only
  create tickets and view own tickets."* Without making these two explicit
  catalog permissions, Requestor would end up with zero permissions in the
  new system, which isn't what the old behavior was.

### Step 2 — Provision + seed
- New command `seed_hdms_increment2`: **reuses the VMST tenant** from
  Increment 0 rather than creating a second one — see "Decisions" below.
  Creates (idempotently): an active `hdms` Subscription for VMST, a new
  `HDMS` department/`HDMS Assignee` designation under the existing VMST
  branch, one HDMS test employee, and assigns them the catalog `HDMS
  Assignee` role via `assign_employee_hdms_role()`.
- Depends on `seed_vms_increment0` having run first (needs the VMST
  org/branch to exist); errors clearly if it hasn't.

### Step 3 — Login path
- `login_hdms` (`authentication/api.py`) rewritten to mirror `login_vms`
  exactly: enforcement order is credentials → **tenant subscribed to
  `hdms`** (new — the old endpoint never checked this) → `ServiceAccess`
  active → catalog role assigned via `get_employee_hdms_role_type()`.
  SuperAdmin still bypasses via the separate `/api/auth/login` endpoint.
- `jwt_utils.py` needed **zero changes** — `_build_authz_claims()` was
  already fully generic in Increment 0 (reads whichever services the
  tenant is subscribed to and the employee's effective permissions from
  `rbac.py`, not anything VMS-specific), so `hdms` claims come through
  automatically. Same for `rbac.get_effective_permissions()` — proved live
  with zero code changes, same as VMS's catalog roles did in Increment 0.
- Response `user.permissions` dict (4 booleans) kept for API back-compat,
  now derived from `rbac.get_effective_permissions()` instead of the
  deleted model's fields — same technique used in `permissions/utils.py`'s
  `get_hdms_role()`.
- **Verified live**: login returns `services: ["vms", "hdms"]` (VMST holds
  both subscriptions now) and `perms: ["hdms.ticket.close",
  "hdms.ticket.create", "hdms.ticket.view_own"]` for the Assignee test
  user. Suspended the tenant's `hdms` Subscription → `login-hdms` returns
  `403 tenant_not_subscribed`; reactivated → `200` again.

### Step 4 — Removed `HdmsRole`
Deleted the model (migration `0014_delete_hdmsrole.py`) and every call
site:
- `permissions/api.py` — `grant_hdms_access`, `check_employee_hdms_access`,
  `list_hdms_users` rewritten to use `assign_employee_hdms_role()` /
  `get_employee_hdms_role_type()` instead of `HdmsRole.objects.create` /
  `hasattr(service_access, 'hdms_role')`.
- `permissions/utils.py` — `get_hdms_role()` rewritten catalog-driven
  (mirrors `get_vms_role()`), booleans derived from
  `rbac.get_effective_permissions()`.
- `permissions/admin.py` — `HdmsRoleAdmin` removed entirely (no
  replacement registered — mirrors Increment 0, which never added a
  `VmsRoleAdmin` either; the generic `RoleAdmin`/`EmployeeRoleAdmin` cover
  catalog-driven roles for every service).
- `audit/signals.py` — `log_hdms_role_change` (a `post_save` signal on
  `HdmsRole`) removed, not replaced. Same reasoning as `admin.py`: VMS's
  catalog `EmployeeRole` never had an equivalent audit signal in Increment
  0, so removing HDMS's keeps the two symmetric rather than leaving HDMS
  with a hook VMS never had.
- `authentication/api.py` — unused `HdmsRole` import dropped (the login
  rewrite in Step 3 already replaced its only real usage).
- `permissions/tests.py` — the two tests that asserted directly on
  `service_access.hdms_role.*` rewritten to assert on
  `get_employee_hdms_role_type()` / `get_hdms_role()` instead. (Both tests
  still error at fixture setup — pre-existing, see "Test results" below —
  but they no longer reference a model that doesn't exist, which would
  have broken *collection* of the whole file, not just these two tests.)
- `scripts/test_auth_system.py` — ad-hoc manual script, `HdmsRole.objects.get_or_create(...)` replaced with `assign_employee_hdms_role(...)`.
- `permissions/models.py` — one stale docstring line on `ServiceAccess`
  ("Admin grants HDMS access → Must also assign HdmsRole") corrected to
  reference the catalog.
- Old migration `permissions/migrations/0001_initial.py` (which originally
  created `HdmsRole`) is untouched — historical record, same as VMS left
  its old `0004_..._vmsrole_..._field.py` alone in Increment 0.

**Verified**: `grep -rn HdmsRole --include="*.py" .` outside
`/migrations/` returns only comments/docstrings explaining the history
(e.g. "replaces HdmsRole lookup") and the `HdmsRoleResponse` Ninja schema
class name in `api.py` (a response-shape class, unrelated to the deleted
model — left as-is, renaming it would be a needless diff for something
that isn't actually a reference to `HdmsRole`).

## HDMS permission / role table

| Permission | HDMS Admin | HDMS Moderator | HDMS Assignee | HDMS Requestor |
|---|---|---|---|---|
| `hdms.ticket.create` | ✓ | ✓ | ✓ | ✓ |
| `hdms.ticket.view_own` | ✓ | ✓ | ✓ | ✓ |
| `hdms.ticket.view_all` | ✓ | ✓ | | |
| `hdms.ticket.assign` | ✓ | ✓ | | |
| `hdms.ticket.close` | ✓ | ✓ | ✓ | |
| `hdms.user.manage` | ✓ | | | |

(Matches the old `HdmsRole.save()` grants exactly — Admin had all 4
booleans, Moderator had 3 (no `can_manage_users`), Assignee had only
`can_close_tickets`, Requestor had none.)

## Reused vs changed vs removed

| | |
|---|---|
| **Reused unchanged** | `rbac.py` (zero changes needed), `jwt_utils.py` (zero changes needed), `Subscription.tenant_has_active()`, `Role`/`EmployeeRole` catalog models, RS256 signing, account lockout, audit app (minus the one removed signal) |
| **Extended** | `login_hdms` (added tenant-subscription gate + catalog role lookup), `permissions/utils.py` (`get_hdms_role` catalog-driven) |
| **New** | `hdms_catalog.py`, `seed_hdms_catalog`, `seed_hdms_increment2` |
| **Removed** | `HdmsRole` model + all call sites (api.py, admin.py, utils.py, authentication/api.py, audit/signals.py) + fixed test/script references |

## Decisions worth flagging

- **Reused the VMST tenant rather than creating a second one.** The prompt
  left this as "your call, state it." A `Subscription` is already
  tenant×service, so one tenant holding both `vms` and `hdms`
  subscriptions is exactly the real-world case this model is for (a
  customer subscribing to multiple ERP services) — proved live: the test
  employee's token now carries `services: ["vms", "hdms"]`. Creating a
  second tenant would have tested tenant *creation* again (already proved
  in Increment 0) rather than the actual new thing here (a second service
  on the same catalog/subscription spine). `seed_hdms_increment2` depends
  on `seed_vms_increment0` having run first as a result.
- **`hdms.ticket.create` / `hdms.ticket.view_own` are new catalog entries
  with no old `HdmsRole` boolean behind them.** Flagged above under Step
  1 — necessary so Requestor isn't left with zero permissions; derived
  from the old model's own docstring, not invented from scratch.
- **HDMS backend services (ticket/communication/file apps) are untouched**
  — out of scope per the prompt. They still can't consume `hdms.*`
  permissions or `tenant_id` from the token yet; that's the Increment-2b-
  style follow-up (VMS's Increment 1 equivalent), not done here.

## Test results

```
docker exec auth_service python -m pytest permissions/ authentication/ -q
# 63 passed, 2 failed, 10 errors
```
Same 12 failures/errors as Increment 0's baseline, same root cause
(`conftest.py`'s `sample_employee`/`sample_department` fixtures pass a
`dept_sector` kwarg that doesn't exist on the current `Department` model —
pre-existing, unrelated to this work, confirmed by re-running the exact
same failing tests and inspecting the traceback). Nothing new broke.

## How to run / test

```bash
# From Enterprise-Resource-Planning/Auth-service-main/ (auth-service must
# already be up with Increment 0's seed data — VMST tenant/employee)
docker exec auth_service python manage.py seed_hdms_catalog
docker exec auth_service python manage.py seed_hdms_increment2

# Login (issues token with services:["vms","hdms"] + hdms.* perms)
curl -X POST http://localhost:8000/api/auth/login-hdms \
  -H "Content-Type: application/json" \
  -d '{"employee_code":"<printed by seed_hdms_increment2>","password":"HdmsUser@123"}'

# Prove the subscription gate
docker exec auth_service python manage.py shell -c "
from permissions.models import Subscription
s = Subscription.objects.get(tenant__tenant_code='VMST', service__code='hdms')
s.status = 'suspended'; s.save()"
curl -X POST http://localhost:8000/api/auth/login-hdms \
  -H "Content-Type: application/json" \
  -d '{"employee_code":"<code>","password":"HdmsUser@123"}'
# -> 403 {"error": "tenant_not_subscribed", ...}

# Confirm HdmsRole is gone
grep -rn HdmsRole --include="*.py" . | grep -v /migrations/
# -> only comments/docstrings, no live references

# Test suite
docker exec auth_service python -m pytest permissions/ authentication/ -q
```

Login credentials seeded by `seed_hdms_increment2`: printed on run, e.g.
`VMST-B1-G-26-H-0002` / `HdmsUser@123` (employee_code is auto-generated —
check the command's own output, don't hardcode it).
