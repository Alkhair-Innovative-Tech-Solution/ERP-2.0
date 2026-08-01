# Phase B1: SMS Staff User Import Mechanism — Result

Branch: `phase-b1-user-import` (not merged to `main`). Scoped entirely to
`Auth-service-main/`. SMS untouched — this increment never connects to any
SMS database; it consumes an explicit input contract, proven here on
synthetic records per `SMS_PHASE_B_USER_IMPORT_PLAN.md` and B0's finding
that no real SMS user data exists anywhere in this environment yet.

## The input contract

`employees/sms_import.py`'s module docstring is the canonical spec —
`SMS_STAFF_RECORD_FIELDS`: `legacy_user_id`, `email`, `username`, `role`,
`password_hash`, `full_name`, `cnic`, `dob`, `gender`, `phone` (optional),
`joining_date` (optional), `is_active` (optional). Each field's real SMS
source is documented inline (e.g. `full_name`/`cnic`/`dob`/`gender` come
from the Teacher/Principal/Coordinator profile record, not `users_user`
itself — confirmed in Phase A1's identity-vs-profile split). Wiring this
to the real SMS DB later means producing an iterable of these dicts from
a query — nothing in the importer changes.

Deliberately excluded from the contract: SMS's own `campus` (stays
SMS-local per A1) and SMS's `employee_code`/`username` (central auth
generates its own via `EmployeeAssignment`, same as every other Employee
— never adopts SMS's).

## What was built

1. **`Employee.legacy_user_id`** (`employees/models.py`) — nullable,
   unique `BigIntegerField`. Migration `employees/migrations/0020_employee_legacy_user_id.py`,
   additive only. Null for every non-imported Employee (VMS/HDMS stay
   unaffected); each imported SMS employee gets its original SMS
   `users_user.id` here, for idempotent re-runs and exact FK remap later.

2. **`employees/sms_import.py`** — `import_staff_records(records,
   tenant_code="SMS01")`. For each record: matches an existing `Employee`
   by `legacy_user_id` first, then by `org_email` (case-insensitive);
   upserts identity fields, creates an `EmployeeAssignment` (get-or-create,
   so idempotent) against a `Designation` derived from `role` under a
   shared "SMS Staff" `Department` (organization-level, no
   Institution/Branch needed — `Department.clean()` allows attaching
   directly to `Organization`); creates/updates `UserCredentials`,
   writing `password_hash` **directly to the field** (never through
   `set_password()`, which would re-hash a value that's already a hash).
   Each record is one `transaction.atomic()` block — one bad record can't
   corrupt the batch or block the rest.

3. **`employees/management/commands/import_sms_staff.py`** — thin CLI:
   `--json-file <path>` reads a JSON array matching the contract and
   calls the importer. No fake data anywhere in this file or in
   `sms_import.py` — the only synthetic data in this whole change lives
   in ephemeral files I generated in `/tmp` for the proof runs, deleted
   afterward (see below), never committed.

## Role → catalog mapping (deliberately NOT full RBAC)

Step 3 says "map the SMS role to the catalog role." I mapped it to a
`Designation` (`role='teacher'` → `Designation(position_name='Teacher')`
under the shared SMS Staff `Department`) — **not** into the
`Role`/`EmployeeRole`/`ServiceAccess` permission-catalog machinery
(`permissions/vms_catalog.py`'s pattern). Reasons:

- The overarching `SMS_PHASE_B_USER_IMPORT_PLAN.md` explicitly assigns
  full RBAC wiring to **B3** ("Attach each imported identity's SMS role
  ... so a migrated user would resolve the *same* permissions") as its
  own separate increment — building it now would be premature and
  duplicate work once B3's actual SMS permission requirements are known.
- Central auth already has a real place for "what role does this person
  hold" that isn't the permission catalog: `Designation`, exactly the
  field VMS/HDMS employees use too (`seed_vms_increment0.py` creates a
  `Designation` per test employee the same way). Reusing it means B1
  needed zero new fields beyond `legacy_user_id`.
- `Employee.employee_code` is generated FROM the
  `EmployeeAssignment`→`Designation` chain, so this also gives every
  imported identity a real, working `employee_code` — checked below.
- Nothing here blocks B3 — `EmployeeRole`/`ServiceAccess` rows can be
  added on top of an already-imported `Employee` without touching
  anything built in this step.

## Pre-existing bug found — worked around, not fixed

`Employee.save()`'s `employee_id` auto-generation
(`employees/models.py:447-456`, unmodified) computes the next number via
`Employee.all_objects.all().order_by('employee_id').last()` — **globally
across every organization, string-lexicographic, not numeric and not
scoped per-org**. The very first synthetic batch run hit this directly:
every SMS01 employee after the first collided on `employee_id=SMS01-0003`,
because `'SMS01-...' < 'VMST-...'` alphabetically (`S` < `V`), so the
lookup kept returning the pre-existing VMS test employee as "last" and
reusing its number, no matter how many SMS01 rows already existed.

Not fixed — `Employee.save()` is shared by every org including VMS/HDMS,
and touching it wasn't authorized by this increment ("Prove VMS/HDMS
unchanged" is a hard requirement, and a correctness fix to shared ID
generation logic is exactly the kind of change that needs its own
scoped, reviewed step). Worked around entirely inside
`employees/sms_import.py`: for new employees, the importer pre-computes
`employee_id` itself, scoped correctly by `Employee.all_objects.filter
(employee_id__startswith=f"{org.org_code}-")`, and sets it before
`.save()` — `Employee.save()` only auto-generates when `employee_id` is
falsy, so the buggy global path never triggers for imported records. VMS/
HDMS employee creation is untouched and still hits the (still-buggy, but
pre-existing and out of scope) global path exactly as before.

## Proof: small batch (5), verified by hand

Generated via `django.contrib.auth.hashers.make_password` directly (the
exact function SMS's `UserCreationService` uses — B0 confirmed both sides
share it), so the carried-over hash is authentically SMS-shaped, not a
central-auth-native one:

```
Import done: 5 created, 0 updated, 0 errors.

--- legacy_user_id 90001 ---
employee_id: SMS01-0001   employee_code: SMS-G-26-TEACHER-0001
email match: True   tenant: SMS01
designation (role): Teacher  (expected teacher)
check_password(original plaintext): True
check_password(wrong password): False

--- legacy_user_id 90002 ---
employee_id: SMS01-0002   employee_code: SMS-G-26-PRINCIPAL-0002
designation: Principal  check_password(original): True

--- legacy_user_id 90003 ---
employee_id: SMS01-0003   employee_code: SMS-G-26-COORDINATO-0003
designation: Coordinator  check_password(original): True

--- legacy_user_id 90004 ---
employee_id: SMS01-0004   employee_code: SMS-G-26-TEACHER-0004
designation: Teacher  check_password(original): True

--- legacy_user_id 90005 ---
employee_id: SMS01-0005   employee_code: SMS-G-26-ACCOUNTS_O-0005
designation: Accounts Officer  check_password(original): True
```

All 5: correct identity, `legacy_user_id` set, role attached via
`Designation`, and — the step the whole plan calls "the single riskiest
step" — `check_password()` against the **original SMS-side plaintext**
returned `True` for every one, and `False` for a wrong password on every
one. The carried-over hash is not just present, it actually authenticates.

(Cosmetic note: `position_code` truncates role names to 10 chars, e.g.
`COORDINATO` in `employee_code` — harmless, `Designation.position_code`
has `max_length=10`; not worth a workaround for this step.)

## Proof: idempotency + larger batch (20)

```
Re-run same 5:  Import done: 0 created, 5 updated, 0 errors. (count stayed 5)

20 more records — first attempt: 4 created, 16 errors (my own test-data
bug: generated CNICs exceeded Employee.cnic's max_length=15 for
two-digit indices — the importer correctly rejected each bad record
individually via its per-record transaction.atomic() and kept going,
rather than crashing the whole batch). Fixed the fixture's CNIC format,
re-ran: 16 created, 4 updated, 0 errors.

Re-run both files again: 0 created, 5 updated + 0 created, 20 updated.

Final integrity check (25 total synthetic Employees):
  distinct employee_id:      25
  distinct employee_code:    25
  distinct legacy_user_id:   25
  distinct org_email:        25
```

No duplicates on any unique key, across three separate import runs.

## A migrated synthetic user can authenticate

`check_password()` verified above for every one of the 5 (and spot-checked
across the 20). **No login endpoint exists yet for this identity path** —
`/api/auth/login` works for any `Employee` by `employee_code` in
principle (the imported ones have real, valid `employee_code`s, e.g.
`SMS-G-26-TEACHER-0001`), but I didn't exercise it live since B1's scope
is the import mechanism, not a login flow, and doing so would have meant
keeping synthetic accounts around past the proof. Confirmed instead via
direct `UserCredentials.check_password()` calls, which is what the
"Done" criteria and Test section both ask for.

## Synthetic data: cleaned up

All 25 synthetic `Employee`/`UserCredentials`/`EmployeeAssignment` rows
deleted after verification — none left in the database.

**Kept**: the "SMS Staff" `Department` and its 8 role `Designation`s
(Teacher, Principal, Coordinator, Admin, Org Admin, Accounts Officer,
Admissions Counselor, Compliance Officer) — this is reusable central-auth
structure, not test data, exactly analogous to `seed_vms_increment0.py`
leaving its Department/Designation in place permanently. The real import
run (whenever real SMS data is available) will reuse these same rows via
`get_or_create` rather than creating duplicates.

Temp JSON fixture files (`/tmp/b1_synthetic_5.json`,
`/tmp/b1_synthetic_20.json`) deleted from the container host — never
written into the repo.

## Proof VMS/HDMS unchanged

```
manage.py check   -> System check identified no issues (0 silenced)

POST /api/auth/login-vms (VMST-B1-G-26-V-0001)
  vms_role: receptionist, employee_code: VMST-B1-G-26-V-0001

POST /api/auth/login-hdms (VMST-B1-G-26-H-0002)
  role: assignee, employee_code: VMST-B1-G-26-H-0002
```

Both byte-identical to every prior increment's baseline.

Full suite (first time `employees/` was included alongside
`permissions/`/`authentication/` in this session's checks):
`5 failed, 64 passed, 25 errors`. All 5 failures + all 25 errors traced —
every one is the same pre-existing `dept_sector` fixture bug already
documented in every prior increment's result doc (`conftest.py`'s
`sample_department` fixture passes a `dept_sector` kwarg the current
`Department` model doesn't have) — confirmed via traceback
(`TypeError: Department() got unexpected keyword arguments: 'dept_sector'`),
not caused by `legacy_user_id` or `sms_import.py`. `permissions/` +
`authentication/` alone: `63 passed, 2 failed, 10 errors` — identical
count to the established baseline.

## Confirmed untouched

- SMS: no connection made, no code touched, nothing read or written.
- VMS, HDMS: logins, `Employee`, `ServiceAccess`, `Role` — unmodified.
- `Employee.save()`'s buggy `employee_id` generation: left as-is (see
  "Pre-existing bug" above) — flagging for a dedicated fix if wanted, out
  of scope here.

## What's next

Not done here, per the plan: **B2** (students → `NonStaffIdentity`, same
mechanism), **B3** (wire imported identities into real
`Role`/`EmployeeRole`/`ServiceAccess` — the `Designation` mapping built
here gives B3 exactly the signal it needs to know which catalog role each
identity should get), and wiring `import_sms_staff` to the real SMS DB
once real data exists.
