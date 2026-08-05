# Fix: student tokens got empty `perms` (jwt_utils) — Result

Branch: `fix-jwt-nonstaff-perms` (not merged to `main`). Scoped to central
auth's token-building path only, per the prompt — no SMS services, no
VMS/HDMS behavior, no employee path touched.

## Root cause (one line)

`generate_access_token()`'s permission-claim builder (`_build_authz_claims`)
called `get_effective_permissions(str(user.id))` / `get_perm_version(str(user.id))`
without ever passing `principal_type`, so both silently defaulted to
`'employee'` for **every** caller — including a `NonStaffIdentity` (student)
token, which can never match an `employee`-shaped lookup, so `perms` came
out `[]` regardless of what SMS role was actually assigned via Phase B3's
generalized RBAC (`assign_sms_role`). Found while proving Phase C4's
"student token submits an assignment, gated by `sms.assignment.upload`"
test case — a real, correctly-assigned `EmployeeRole` row existed, but the
token still carried zero permissions.

## The change

`Auth-service-main/Backend/src/authentication/jwt_utils.py`:

1. Added `_detect_principal_type(user)` — `isinstance(user, NonStaffIdentity)`
   → `'non_staff'`, else `'employee'`. Robust (type-based), not the
   `hasattr(user, 'employee_code')` check the existing employee/superadmin
   detection already used elsewhere in the function — that check is left
   completely untouched, exactly where and how it was.
2. `_build_authz_claims(user, is_superadmin)` → `_build_authz_claims(user, is_superadmin, principal_type='employee')`.
   Its two RBAC calls now pass `principal_type=principal_type` through.
   Passing the explicit default (`'employee'`) for an Employee caller is a
   no-op — identical in effect to the old no-argument call — so this is the
   change that fixes students without touching employees.
3. `generate_access_token()` gained one `elif principal_type == 'non_staff':`
   branch, parallel to the existing `if hasattr(user, 'employee_code'):`
   block, adding `identity_code`/`person_type` claims for a student token —
   the non-staff-shaped equivalent of `employee_code`/`employee_id`,
   requested explicitly in the brief ("mirror the employee claim shape,
   minus employee-only fields... use `identity_code`/`person_type` where
   appropriate").

`permissions/rbac.py`'s `get_effective_permissions`/`get_perm_version`
themselves were **not touched** — they were already generic from B3
(`principal_type: str = "employee"` parameter existed, validated via
`_validate_principal_type`); the bug was purely that the token builder
never passed the non-default value.

## Proof: employee token is byte-identical before/after

Compared the *exact same* real employee (`VMST-B1-G-26-H-0002`) before vs
after the fix, JSON-diffed with only the inherently-random `jti`/`iat`/`exp`
claims stripped:

```
{
  "code": "VMST-B1-G-26-H-0002", "email": "", "employee_code": "VMST-B1-G-26-H-0002",
  "employee_id": "VMST-0002", "full_name": "Increment2a HDMS TestUser",
  "is_active": true, "is_superadmin": false, "perm_version": 1,
  "perms": ["hdms.ticket.close", "hdms.ticket.create", "hdms.ticket.view_own"],
  "services": ["vms", "hdms"], "sub": "...", "tenant_id": "...",
  "token_type": "access", "user_id": "..."
}
```
`diff before after` → **zero output** (byte-identical). Verified both ways:
checked out the pre-fix file (`git show <base-commit>:...jwt_utils.py`),
generated a token for the same employee, diffed against a fresh post-fix
generation for the same employee — identical.

Also checked the **superadmin path** (not explicitly required but a stated
safety concern — "Superadmin path unchanged"): a real `SuperAdmin` row's
token still shows `perms: ["*"]`, `tenant_id: null`, all three services,
and gets neither `employee_code`/`employee_id` nor the new
`identity_code`/`person_type` claims — unaffected, exactly as before (the
`is_superadmin` branch in `_build_authz_claims` returns before
`principal_type` is ever used for anything beyond the payload's own
identity_code/person_type block, which SuperAdmin doesn't qualify for
either way).

## Proof: student token now carries correct `sms.*` perms

Synthetic `NonStaffIdentity` (student), assigned the `SMS Student` role
template (`permissions.sms_catalog.assign_sms_role`, tenant = `SMS School`)
— confirmed via direct DB read that the `EmployeeRole` row and its 5
permissions were correctly persisted (this part already worked pre-fix,
per Phase C4's finding — the bug was purely in the token builder, not the
RBAC assignment):

```
Before fix: perms: []
After fix:  perms: ["sms.assignment.upload", "sms.assignment.view",
                    "sms.fee.pay", "sms.fee.view", "sms.result.view"]
            identity_code: "FIXTEST-STU-01"
            person_type: "student"
            (employee_code/employee_id: absent, correctly — this branch is
            mutually exclusive with the employee one)
```

Synthetic `NonStaffIdentity` and its `EmployeeRole` deleted after
verification.

## Proof VMS/HDMS unchanged

```
manage.py check (auth_service) -> System check identified no issues (0 silenced)
POST /api/auth/login-vms (real employee_code, wrong password)
  -> 401 {"error": "invalid_credentials", "detail": "Incorrect password"}
  (endpoint round-trips correctly; seeded password unknown to this session,
  same limitation noted in every prior phase's equivalent check)
```

Central-auth suite: `5 failed, 66 passed, 25 errors` — identical to Phase
C4's end-of-phase baseline, same pre-existing causes, no new failures or
errors introduced by this fix.

## Confirmed untouched

- `permissions/rbac.py` (`get_effective_permissions`, `get_perm_version`,
  `_validate_principal_type`) — not modified, per the explicit rule.
- The existing `hasattr(user, 'employee_code')` employee-detection block —
  same lines, same position, unmodified.
- The `is_superadmin` short-circuit in `_build_authz_claims` — same shape,
  now takes an extra unused-in-that-branch parameter but the branch itself
  is unchanged.
- No SMS service, VMS, or HDMS code touched.

## What's next

This was flagged as a likely-systemic issue in Phase C4's doc ("This
likely affects every prior phase's 'student gets a real (non-superadmin)
`sms.*` permission' claims too") — now fixed at the source, so any future
phase minting a student token (or re-running C1–C4's synthetic proofs) will
get correct `perms` without needing a superadmin-flagged workaround.
