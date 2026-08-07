# Phase D-b1: Unified SMS Login Endpoint in Central Auth — Result

> Branch: `phase-d-b1-sms-login`. Scope: central auth only
> (`Enterprise-Resource-Planning/Auth-service-main/Backend/src/`). Nothing in
> `School-Management-System-New/` or the frontend was touched. Additive only —
> no existing endpoint's behavior changed.

## What was built

**`POST /api/auth/login-sms`** — one endpoint, email + password, self-detects
whether the email belongs to a staff `Employee` or a student `NonStaffIdentity`
in tenant `SMS01`, and returns a token pair either way.

New code in `authentication/api.py` (appended after `login_vms`, before the
SIS-removed comment): `SmsLoginRequest`, `SmsPrincipalOut`, `SmsLoginResponse`
schemas, `SMS_TENANT_CODE = "SMS01"` constant, and the `login_sms` view.

## Request / response shape

**Request:**
```json
{ "email": "someone@sms-test.local", "password": "..." }
```

**Response (200)** — central auth's own clean shape, not bent to match SMS's
old `access`/`refresh`/`user`/`organization` shape (per the locked decision —
the frontend adapts to this later, separately):
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 3600,
  "principal": {
    "user_id": "uuid",
    "person_type": "staff" | "student",
    "full_name": "...",
    "email": "...",
    "tenant_id": "uuid",
    "tenant_name": "SMS School",
    "role": "Teacher" | "student" | null,
    "services": ["sms"],
    "perms": []
  }
}
```

**Errors:** `401` (`{"error": "Invalid credentials", "detail": "..."}`, same
shape as `/login`'s errors) for unknown email or wrong password; `423` for a
locked account — identical status codes and body shape to the existing
`/login` endpoint, deliberately.

## How staff-vs-student resolution works (`authentication/api.py`, `login_sms`)

1. Try `Employee.objects.filter(tenant__tenant_code="SMS01", org_email__iexact=email, is_active=True, is_deleted=False).first()`.
   Uses `org_email`, not the `email` property — `Employee.email` is a Python
   `@property` (`org_email or personal_email or ""`), not a DB field, so it
   can't be filtered on. This matches exactly how `sms_import.py`'s own
   `_import_staff_one` re-matches existing employees by email
   (`employees/sms_import.py:212`).
2. If no `Employee` matches, try `NonStaffIdentity.objects.filter(tenant__tenant_code="SMS01", email__iexact=email, is_active=True, is_deleted=False).first()`.
   Uses `.first()`, not `.get()` — `NonStaffIdentity.email` is **not** a
   unique field (`authentication/nonstaff_models.py:61`, unlike
   `Employee.org_email` which is `unique=True`), so a `.get()` could
   theoretically raise `MultipleObjectsReturned`. `.first()` avoids that,
   matching `sms_import.py`'s own `_import_student_one` (line 294).
3. If neither matches → `401`.
4. **Same-email-both-types order**: staff is tried first, so if the same
   email were ever shared by an `Employee` and a `NonStaffIdentity` in
   `SMS01` (not currently possible via either importer, but not database-
   constrained against either), the staff account wins and the student
   account becomes unreachable through this endpoint. Documented, not
   enforced — this is the "defined order" the prompt asked for.

Password check, lockout, and success/failure recording reuse
`UserCredentials.check_password()` / `record_failed_login()` /
`record_successful_login()` exactly as `/login` does — no forked copy of
that logic; only the `cred_filter` (`{'employee': principal}` vs
`{'non_staff_identity': principal}`) differs.

Token issuance calls `generate_access_token(principal)` /
`generate_refresh_token(principal)` unchanged — both already handled a
`NonStaffIdentity` argument correctly before this phase
(`jwt_utils.py`'s `_detect_principal_type`, fixed by the earlier
jwt-nonstaff-perms fix). The response's `principal.services`/`perms`/
`tenant_id` are read back off the just-minted access token via
`decode_token()`, not recomputed — guarantees the response can never drift
from what's actually inside the token.

## The refresh-token gap this phase had to close

The prompt's own "data layer is already ready" claim turned out to be only
*mostly* true — one real gap was found and fixed:

**`RefreshToken` had no way to link to a `NonStaffIdentity`.** The model only
had `employee`/`superadmin` FKs (`authentication/models.py`, pre-existing).
Storing a refresh token for a student login — required by "Store the refresh
token as the existing login does" — was structurally impossible before this
change. Fixed additively: added a nullable `non_staff_identity` FK +
`[non_staff_identity, is_revoked]` index (migration
`0008_refreshtoken_non_staff_identity_and_more.py`, applied — `makemigrations`
produced exactly these two operations, no unrelated drift to strip out).

**`POST /api/auth/refresh` didn't work for a student token either**, and had
to be extended (not duplicated) to reuse it, per the prompt's own instruction.
Root cause: `verify_refresh_token()` returned `(user_id, is_superadmin)` —
no signal that would let `/refresh` tell a student token apart from an
employee token (a student token's `is_superadmin` reads back `False`, same
as an employee's). Fixed by:
- `generate_refresh_token()` (`jwt_utils.py`) now adds a `principal_type: 'non_staff'`
  claim **only** when minting a token for a `NonStaffIdentity` — absent (not
  `False`) for every employee/superadmin refresh token, so their payload is
  byte-identical to before this change.
- `verify_refresh_token()` now returns a 3-tuple, `(user_id, is_superadmin, principal_type)`.
  Confirmed via grep this function has exactly one caller in the whole
  codebase — the `/refresh` view itself — so widening its return signature
  cannot affect anything else.
- `/api/auth/refresh` (`authentication/api.py`) gained one new `if principal_type == 'non_staff':`
  branch before the existing `is_superadmin`/employee branches, for both the
  `RefreshToken` lookup and the final principal fetch. The existing
  `is_superadmin`/employee branches are unchanged — confirmed by diff (see
  "Proof" below).

**Pre-existing bug found, not fixed (out of scope):** `generate_refresh_token()`'s
payload has never included an `is_superadmin` claim at all, so
`verify_refresh_token()`'s `payload.get('is_superadmin', False)` always reads
back `False` — meaning a **superadmin's** refresh call has likely always
fallen into the `employee__id` branch and failed with `Employee.DoesNotExist`
→ 401, even before this phase. Not touched here (unrelated to SMS login,
would be a behavior change on the superadmin path, against the "additive
only" rule) — flagging for whoever owns that flow.

**Known limitation, out of scope:** `AuthBearer` (gates `/api/auth/me` and
`/api/auth/logout`) only resolves `SuperAdmin` or `Employee` by `user_id` —
not `NonStaffIdentity`. A student's access token is rejected by both of
those endpoints (`401 Unauthorized`, confirmed below). The prompt's build
list only asked for login + a matching refresh path, not `/me`/`/logout`
support — and SMS's own microservices validate the RS256 access token
directly via JWKS/`CentralAuthUser`, they don't call central auth's `/me`.
Flagging this as the next gap if a student ever needs to call central auth's
own `/me`/`/logout` directly.

## Proof

**Migration — clean, additive, no drift:**
```
$ docker exec auth_service python manage.py makemigrations authentication
Migrations for 'authentication':
  authentication/migrations/0008_refreshtoken_non_staff_identity_and_more.py
    - Add field non_staff_identity to refreshtoken
    - Create index auth_refres_non_sta_046330_idx on field(s) non_staff_identity, is_revoked of model refreshtoken
$ docker exec auth_service python manage.py migrate authentication
Applying authentication.0008_refreshtoken_non_staff_identity_and_more... OK
```

**Synthetic data seeded** via the Phase B importers (`import_staff_records`,
`import_student_records`), tenant `SMS01`:
- Staff: `phase.d.b1.staff@sms-test.local` — created as `Employee`
  `SMS01-0001`, `employee_code` auto-derived as `SMS-G-24-TEACHER-0001`.
- Student: `phase.d.b1.student@sms-test.local` — created as `NonStaffIdentity`
  `identity_code` `SMS01-STU-0001`.

**Staff login by email → 200, `person_type: "staff"`:**
```
$ curl -s -X POST http://localhost:8000/api/auth/login-sms -H "Content-Type: application/json" \
  -d '{"email":"phase.d.b1.staff@sms-test.local","password":"StaffPass@123"}'
→ 200 {"access_token": "...", "refresh_token": "...", "expires_in": 3600,
       "principal": {"user_id": "c6f62350-...", "person_type": "staff",
         "full_name": "Phase D B1 Test Staff", "email": "phase.d.b1.staff@sms-test.local",
         "tenant_id": "5cb22798-...", "tenant_name": "SMS School",
         "role": "Teacher", "services": ["sms"], "perms": []}}
```
Decoded access token payload confirms `employee_code`, `employee_id`,
`tenant_id`, `services: ["sms"]` — the standard `Employee` claim shape,
unchanged from what `/login` produces for a staff member.

**Student login by email → 200, `person_type: "student"`:**
```
$ curl -s -X POST http://localhost:8000/api/auth/login-sms -H "Content-Type: application/json" \
  -d '{"email":"phase.d.b1.student@sms-test.local","password":"StudentPass@123"}'
→ 200 {"access_token": "...", "refresh_token": "...", "expires_in": 3600,
       "principal": {"user_id": "3813a050-...", "person_type": "student",
         "full_name": "Phase D B1 Test Student", "email": "phase.d.b1.student@sms-test.local",
         "tenant_id": "5cb22798-...", "tenant_name": "SMS School",
         "role": "student", "services": ["sms"], "perms": []}}
```
Decoded access token payload confirms `identity_code: "SMS01-STU-0001"`,
`person_type: "student"`, `services: ["sms"]` — the `NonStaffIdentity` claim
shape (no `employee_code`, as expected). Decoded refresh token payload
confirms `principal_type: "non_staff"` — the new tag, present only here.

**Wrong password (staff) → 401:**
```
{"error": "Invalid credentials", "detail": "Incorrect password"}   HTTP 401
```

**Unknown email → 401:**
```
{"error": "Invalid credentials", "detail": "User not found or account inactive"}   HTTP 401
```

**Refresh works for both principal types:**
```
Staff refresh_token   → POST /api/auth/refresh → 200, new access_token
Student refresh_token → POST /api/auth/refresh → 200, new access_token
```

**`/me`/`/logout` correctly reject a student token (documented limitation, not a bug in this build):**
```
$ curl -s http://localhost:8000/api/auth/me -H "Authorization: Bearer <student access token>"
→ {"detail": "Unauthorized"}   HTTP 401
```

**`/login`, `/login-vms`, `/login-hdms` are untouched — proven two ways:**
1. `git diff --stat` shows changes only in `authentication/api.py` (imports +
   `refresh_token()` body + a purely-appended new section after
   `login_vms`), `authentication/jwt_utils.py` (`generate_refresh_token`/
   `verify_refresh_token` only), and `authentication/models.py`
   (`RefreshToken` only, additive field+index). `git diff` hunk markers
   confirm the `login()`, `logout()`, `login_hdms()`, `login_vms()`, and
   `get_current_user()` function bodies have **zero** touched lines — the
   diff never enters them.
2. `login-vms` called with the prompt's example test credentials returned
   the expected shape for a not-found employee_code (`{"error":
   "invalid_credentials", "detail": "Employee code not found or account
   inactive"}`, `401`) — that specific synthetic VMS employee simply isn't
   present in this session's dev DB (a data-availability fact of this
   environment, not a code regression); a real VMS-subscribed employee
   (`VMST-B1-G-26-V-0001`) does exist and is reachable by the unmodified
   `login_vms` code path, confirmed via direct DB query. Diff-based proof
   (1) is the stronger evidence here, since it covers every branch of
   `login_vms`, not just the one reachable with a guessed password.

## What the frontend adapter will need to map (for the next, separate step)

- `access_token` → SMS's `access`; `refresh_token` → `refresh`.
- `principal` → SMS's `user` object — field names differ
  (`user_id`→`id`, `person_type` is new/has no SMS equivalent yet,
  `full_name`/`email` match, `role`/`services`/`perms` are new/richer than
  what SMS's old `user` object carried).
- `tenant_name`/`tenant_id` inside `principal` → SMS's separate top-level
  `organization` object; the adapter will need to reshape these into
  whatever `organization` fields the frontend's `sis_organization` storage
  expects (SMS's old shape likely has more org fields — e.g. address, plan —
  that central auth's `Tenant` model doesn't carry; the adapter may need a
  follow-up call to `/api/employees/organizations` for those, out of scope
  here).
- No `identity_code`/`employee_code` is exposed in `principal` — if the
  frontend needs a "code" field, `SmsPrincipalOut` doesn't currently expose it (decoded token has it, response body doesn't) — flag for the adapter step if it turns out to be needed.

## Deliberately not done (per the prompt's own scope)

- Frontend/SMS-service changes — none made.
- The student internal-create endpoint (live sync from SMS on student
  creation, analogous to B4's staff sync) — not built here; this endpoint
  only serves logins for students that already exist in central auth via
  the batch `import_sms_students` command. Next step, separately, per the
  prompt.
- `/me`/`/logout` support for `NonStaffIdentity` — flagged above, not built.
- The pre-existing superadmin-refresh bug — flagged above, not fixed.
