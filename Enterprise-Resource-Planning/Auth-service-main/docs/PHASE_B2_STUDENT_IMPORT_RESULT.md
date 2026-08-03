# Phase B2: SMS Student Import (NonStaffIdentity) — Result

Branch: `phase-b2-student-import` (off `phase-b1-user-import`, not merged
to `main`). Scoped entirely to `Auth-service-main/`. SMS untouched — same
as B1, this increment never connects to any SMS database.

## The student input contract

`employees/sms_import.py`'s module docstring documents
`SMS_STUDENT_RECORD_FIELDS`: `legacy_user_id`, `email`, `username`,
`password_hash`, `full_name` (all required), `role` and `is_active`
(optional, default `'student'`/`True`). Deliberately smaller than the
staff contract — no `cnic`/`dob`/`gender`/`phone`/department, because
`NonStaffIdentity` has none of those fields by design (A2). `username`
maps to SMS's `Student.student_id` per Phase A1's finding that a
student's login identifier lives on the profile record, not `User`
itself — kept for reference only, never stored as the central
`identity_code` (central auth generates its own, same principle as staff
never inheriting SMS's `employee_code`).

## How B1's mechanism was shared, not duplicated

Refactored `employees/sms_import.py` into two shared pieces plus two thin
per-type functions:

- **`_run_batch(records, tenant_code, required_fields, import_one_fn)`** —
  the per-record validation → `transaction.atomic()` → created/updated/
  errors counting loop. Previously inlined in `import_staff_records`; now
  used by both `import_staff_records` and `import_student_records`,
  parametrized only by which required-fields tuple and which
  per-record import function to call.
- **`_upsert_credentials(password_hash, **link_kwargs)`** — the
  get-or-create-`UserCredentials` + direct (never re-hashed)
  `password_hash` write. Called as `_upsert_credentials(hash,
  employee=employee)` for staff and `_upsert_credentials(hash,
  non_staff_identity=identity)` for students — same function, different
  keyword arg, exactly mirroring `UserCredentials`'s own existing
  dual-FK pattern (established back in A2).
- **`_import_staff_one`** and **`_import_student_one`** are the only
  per-type code — staff's does the Designation/EmployeeAssignment dance
  students don't need at all; student's is roughly a third the length
  because there's no HR chain to build.

`import_staff_records` (B1, now a two-line wrapper around `_run_batch`)
and `import_sms_staff` (the CLI) were **not rewritten** — only the shared
internals moved. Proved this with a live regression check before touching
anything student-specific (see below).

## Code-generation collision — checked, does not apply here (by design)

B1 hit a real bug: `Employee.save()`'s `employee_id` auto-generation is
global and string-lexicographic, not org-scoped, causing collisions once
multiple org prefixes exist. `NonStaffIdentity.identity_code` has **no
auto-generation of its own at all** (A2 deliberately left it a plain
unique `CharField` — no `EmployeeAssignment`-style chain to hang a bug
off of), so there's no shared/legacy method to inherit a collision from.
Since I'm the only code that has ever written to this field, I generated
it correctly-scoped from the start: `_next_student_identity_code(org)`
filters `NonStaffIdentity.objects.filter(identity_code__startswith=
f"{org.org_code}-STU-")` before computing the next number — the same
scoping discipline B1 had to retrofit as a workaround, applied here from
day one instead. Confirmed no collisions across all 25 synthetic
records — sequential `SMS01-STU-0001` through `SMS01-STU-0025`, zero
duplicates on any unique field (integrity check below).

## Proof: small batch (5), verified by hand

```
Import done: 5 created, 0 updated, 0 errors.

--- legacy_user_id 80001 ---
identity_code: SMS01-STU-0001   tenant: SMS01   person_type: student   role: student
email match: True
has department/branch/designation/employee_code? False False
check_password(original plaintext): True
check_password(wrong password): False
creds.employee: None   creds.superadmin: None   (only non_staff_identity is set)
```

All 5: identical result shape (`identity_code` SMS01-STU-0001 through
-0005), `legacy_user_id` set, `person_type='student'`,
`check_password()` against the **original SMS-side plaintext** returned
`True` for every one and `False` for a wrong password on every one — same
credential-carry-over proof as B1, this time with zero HR fields anywhere
on the identity.

## Proof: idempotency + larger batch (20)

```
Re-run same 5:     Import done: 0 created, 5 updated, 0 errors.
20 more records:   Import done: 20 created, 0 updated, 0 errors.  (clean first try — no
                    fixture bugs this time, unlike B1's CNIC-length miss, since students
                    need no cnic/dob/gender at all)
Re-run both again: 0 created, 5 updated  +  0 created, 20 updated

Final integrity check (25 total synthetic NonStaffIdentity):
  distinct identity_code:    25
  distinct legacy_user_id:   25
  distinct email:            25
  all person_type='student': True
```

No duplicates on any unique key, across three separate import runs.

## Proof B1 staff-import still works after the refactor

Ran a one-record staff regression check through `import_sms_staff` before
building anything student-specific, to prove the shared-code extraction
didn't break the existing path:

```
Import done: 1 created, 0 updated, 0 errors.
employee_id: SMS01-0001   employee_code: SMS-G-26-TEACHER-0001
check_password: True
```

Cleaned up immediately after confirming.

## Synthetic data: cleaned up

All 25 synthetic `NonStaffIdentity`/`UserCredentials` rows deleted after
verification — `NonStaffIdentity.objects.count()` back to 0. Unlike B1,
there was no reusable structure to keep (no Department/Designation
equivalent for students — nothing was created besides the identities
themselves). Temp JSON fixture files deleted from the container host,
never written into the repo.

## Proof VMS/HDMS/staff-import unchanged

```
manage.py check   -> System check identified no issues (0 silenced)

POST /api/auth/login-vms (VMST-B1-G-26-V-0001)  -> vms_role: receptionist
POST /api/auth/login-hdms (VMST-B1-G-26-H-0002) -> role: assignee
```

Both byte-identical to every prior increment's baseline.

Full suite: `permissions/ authentication/ employees/` → `5 failed, 64
passed, 25 errors` — **identical count to B1's confirmed baseline**, same
pre-existing `dept_sector` fixture cause throughout, nothing new.
`permissions/`/`authentication/` alone unaffected as always.

## Confirmed untouched

- SMS: no connection made, no code touched.
- VMS, HDMS: logins, `Employee` (non-imported rows), `ServiceAccess`,
  `Role` — unmodified.
- B1's `import_sms_staff` behavior: unchanged (regression-proved above);
  only its internals were refactored to share code, its public function
  signature and CLI are identical.
- `Employee.save()`'s buggy `employee_id` generation: still not touched —
  irrelevant here anyway since students never create an `Employee` row.

## What's next

Not done here, per the plan: **B3** — wiring imported identities (both
staff `Employee`s via `Designation` and now student `NonStaffIdentity`s
via `.role`) into real `Role`/`EmployeeRole`/`ServiceAccess`, including
the A2-deferred "how does a non-employee resolve permissions" question —
and eventually wiring both `import_sms_staff` and `import_sms_students`
to the real SMS DB once real data exists.
