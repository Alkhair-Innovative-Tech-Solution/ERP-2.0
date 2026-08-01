# Cleanup: Remove Legacy `sis` Service — Result

`sis` ("School Information System") — a legacy test product, confirmed
unused by the owner and unrelated to the current SMS ("School Management
System") product — has been removed from central auth's live code paths
and data. Historical migrations and the shared `Service`/`ServiceAccess`
models were left untouched. Everything is on one branch as one set of
changes, revertible with `git revert`.

Branch: `cleanup-remove-sis` (not merged to `main`).

## Reference inventory (produced before any change)

| # | File:line | Classification | Action |
|---|---|---|---|
| 1 | `authentication/api.py:540-624` | (a) Live code path | Removed — `SisLoginResponse` schema + `login_sis()` + `/login-sis` route |
| 2 | `permissions/api.py:8` (docstring) | (a) Live code path | Removed the `sis-role` line from the module docstring |
| 3 | `permissions/api.py:24` (import) | (a) Live code path | Removed `get_sis_role` from the import list |
| 4 | `permissions/api.py:56-60` | (a) Live code path | Removed — `SisRoleResponse` schema |
| 5 | `permissions/api.py:125-126` | (a) Live code path, **shared function** | Removed only the `elif service == 'sis'` branch inside `check_service_access()` — hdms/vms branches and the function itself untouched |
| 6 | `permissions/api.py:148-169` | (a) Live code path | Removed — `get_sis_role_info()` + `/sis-role` route |
| 7 | `permissions/utils.py:18,97,143` (docstrings) | (a) Live code path | Updated `'sis' \| 'hdms'` mentions to `'hdms' \| 'vms'` |
| 8 | `permissions/utils.py:77-94` | (a) Live code path | Removed — `get_sis_role()` function |
| 9 | `permissions/utils.py:145-148` | (a) Live code path, **shared function** | Removed only the `elif service_name == 'sis'` branch inside `get_employee_permissions()` — hdms/vms branches and the function itself untouched |
| 10 | `permissions/migrations/0001_initial.py:27` | (b) Historical migration | **Untouched** |
| 11 | `permissions/migrations/0004_service_vmsrole_dynamic_service_field.py:34,39` | (b) Historical migration | **Untouched** |
| 12 | `permissions_service` row (`code='sis'`) + `ServiceAccess(service='sis')` rows | (d) Data row | Removed via new migration `0015` (see below) |
| 13-18 | `migrate_credentials.py`, `final_check.py`, `debug_service_access.py`, `debug_user.py`, `check_superadmin_state.py`, `scripts/test_auth_system.py` | (c) One-off/debug scripts | **Listed, not touched** — awaiting confirmation, see below |

**Nothing load-bearing for anything other than `sis` was found.** The two
"shared function" rows (5 and 9) are the only places `sis`-specific code
lived *inside* a function also used by hdms/vms — in both cases it was a
single, cleanly separable `elif` branch, not intertwined logic. `login_sis`
itself (row 1) sits in the same file as, and right after, the VMS login
endpoint and right before nothing shared with superadmin login
(`/api/auth/login`, a completely separate function elsewhere in the file)
— "near" only in file position, confirmed by reading it end-to-end before
deleting: it duplicates the Employee/SuperAdmin credential-check logic
inline rather than calling into the superadmin login path, so removing it
cannot affect superadmin login. `has_service_access`, `get_service_accesses`,
and `create_audit_log` in `permissions/utils.py` are generic/service-agnostic
(take `service_name` as a parameter) and were not touched.

### A different "sis" — found, confirmed out of scope, not touched

`migrate_employees.py`, `inspect_sis_schema.py`, `verify_hashes.py`,
`identify_missing_records.py`, `migrate_campuses_to_branches.py`, and
`run_full_migration.py` also contain "sis"/"SIS" — but as a variable-name
leftover from a historical, already-completed one-time Employee/Branch/
Campus data import (`inspect_sis_schema.py`'s `SIS_DB_CONFIG` literally
connects to `database: 'sms_iak_db'` — SMS's own database).
This is unrelated to the `permissions.Service`/`ServiceAccess` registry
entry being removed here — none of these six files reference `Service`,
`ServiceAccess`, or `service='sis'` gating at all. Confirms the user's own
note that SIS was used before SMS — data was in fact migrated from it once
— but that's a separate, already-finished historical concern from the
still-registered-but-unused `sis` login/permission service being cleaned
up in this task. Not part of the inventory above, not modified.

## What was removed from live code

- `authentication/api.py`: the entire `/login-sis` endpoint block, replaced
  with a one-line comment pointing at this doc.
- `permissions/api.py`: `SisRoleResponse` schema, `get_sis_role` import,
  the `/sis-role` endpoint, and the `sis` branch inside
  `check_service_access()`.
- `permissions/utils.py`: `get_sis_role()` function, the `sis` branch
  inside `get_employee_permissions()`, and three stale docstring mentions.

## New migration (data only)

`permissions/migrations/0015_remove_sis_service_data.py` — `RunPython`,
deletes `ServiceAccess.objects.filter(service='sis')` then
`Service.objects.filter(code='sis')`. Reversible (`restore_sis` re-creates
the `Service` row on `migrate permissions 0014`; `ServiceAccess` rows
can't be reconstructed by a reverse migration, but there were zero at
removal time — confirmed live before writing the migration, see below —
so nothing is actually lost). Depends on `0014_delete_hdmsrole` (the
latest existing migration); does not touch `0001` or `0004`.

**Verified live**:
```
Before: ServiceAccess.objects.filter(service='sis').count() -> 0
        Service.objects.filter(code='sis').exists() -> True
After migrate:  Service.objects.all() codes -> ['hdms', 'sms', 'vms']  ('sis' gone)
```

## Scripts — confirmed and resolved

Listed for confirmation first (not touched at proposal time), then
resolved on explicit go-ahead:

| Script | Lines | Resolution |
|---|---|---|
| `migrate_credentials.py` | 349 | **Deleted** (`git rm`) — completed historical SIS→Auth Service credential ETL. |
| `final_check.py` | 59 | **Deleted** — hardcoded Windows path (`d:/ERP/auth-service/src`), already non-functional in this deployment. |
| `debug_service_access.py` | 42 | **Deleted** — same, hardcoded Windows path. |
| `check_superadmin_state.py` | 33 | **Deleted** — same, hardcoded Windows path. |
| `debug_user.py` | 33 | **Kept, edited** — removed the hardcoded `service='sis'` `ServiceAccess` check (and its now-unused `ServiceAccess` import); the employee/credentials-existence check it also does is still generically useful. |
| `scripts/test_auth_system.py` | 171 | **Kept, edited** — removed STEP 3/5's `sis` checks and STEP 4's `sis` grant; STEP 3 now checks HDMS default-denial instead (matching what STEP 4/5 actually exercise). HDMS flow untouched. |

Before deleting the 4 whole files, confirmed via
`grep -rln "final_check\|debug_service_access\|check_superadmin_state\|migrate_credentials"`
that nothing else in the codebase imports them.

## Proof nothing else broke

```
manage.py check                    -> System check identified no issues (0 silenced)

POST /api/auth/login (superadmin, S-26-0001)
  -> 200, token services: [hdms, sms, vms]   (sis correctly absent — was
     present implicitly before via Service.objects.filter(is_active=True)
     in superadmin's claim-building; removing the row removes it from the
     list too, which is the intended effect, not a regression)

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

Byte-identical VMS/HDMS token shapes and values to every prior increment's
verified run. SMS registry data from the prior increment (Increment 4b)
also confirmed intact post-removal: `Tenant SMS01`, `Subscription(SMS01,
sms, active)` both still present — the `sis` cleanup did not disturb them.
(No SMS login endpoint exists in central auth yet — SMS users still live
in SMS's own separate database per
`School-Management-System-New/docs/SMS_USER_MIGRATION_ANALYSIS.md` — so
"log in as an SMS test user" isn't yet a testable path; verified via the
registry data instead.)

Full suite: `docker exec auth_service python -m pytest permissions/
authentication/ -q` → `63 passed, 2 failed, 10 errors` — identical count
to every prior increment's baseline, same pre-existing unrelated cause
(`conftest.py`'s `sample_department` fixture passing a `dept_sector` kwarg
the current `Department` model doesn't have).

## Confirmed untouched

- `Service`/`ServiceAccess` **models**: no field, no Meta, no method changed.
- `permissions/migrations/0001_initial.py`, `0004_service_vmsrole_dynamic_service_field.py`: unmodified.
- VMS, HDMS, SMS backends: nothing outside `Auth-service-main/` was touched.
- `hdms`, `vms`, `sms` `Service` rows and their `Subscription`s: unmodified.

## Post-script-cleanup re-verification

After deleting the 4 scripts and editing the remaining 2, re-ran the same
checks to confirm the deletions themselves didn't break anything (they
aren't imported by the live app, so this was expected to be a no-op, and
was):

```
manage.py check                    -> System check identified no issues (0 silenced)
pytest permissions/ authentication/ -> 63 passed, 2 failed, 10 errors  (same baseline)
```
