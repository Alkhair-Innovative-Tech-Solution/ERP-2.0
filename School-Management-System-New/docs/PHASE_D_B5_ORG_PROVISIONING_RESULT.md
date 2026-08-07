# Phase D-b5: Central-Auth Equivalent for org-service's auth-8001 Calls — Result

> Branch: `phase-d-b5-org-provisioning`. Additive, dual-write, flag-gated on
> the same `SYNC_TO_CENTRAL_AUTH` switch B4/D-b2 use. auth-8001 calls all
> still fire — nothing removed. Synthetic data only, cleaned up after.

## Investigation — the org-admin shape

**Question 1: does org-admin fit `sms-staff`/`import_staff_records` as-is?**
No — checked what `OrganizationCreateSerializer` actually collects
(`org-service/users/serializers.py:56-69`): `admin_email`, `admin_password`,
`admin_full_name` only. `import_staff_records`'s `STAFF_REQUIRED_FIELDS`
requires `cnic`, `dob`, `gender` too — none of which an org-admin signup
ever asks for. And these aren't just the import function's own opinion:
`Employee.cnic` is `unique=True` with no default, `Employee.dob` is a
non-nullable `DateField()` with no default — the *model itself* can't
accept an org-admin's `Employee` row without values for all three,
regardless of which function creates it.

**Chosen approach: reuse anyway, with clearly-marked sentinel values** —
not a new endpoint. `services/central_auth_sync_service.py` (new,
org-service) builds a placeholder `cnic` deterministically from the
org-service `User.id` (`00000-{id:07d}-0` — unique per admin since that id
is a unique auto-increment integer, and obviously synthetic to anyone
reading the data), a fixed sentinel `dob` (`1900-01-01`), and `gender='other'`
(the closest "not applicable" option `Employee.GENDER_CHOICES` has). This
satisfies the prompt's explicit "prefer reuse" instruction — genuinely
reuses `POST /api/internal/sms-staff` and `import_staff_records` unchanged,
zero new central-auth code for org-admin identity itself.

**Real tradeoff, flagged not hidden:** these `Employee` rows will carry
synthetic HR fields indefinitely unless a later phase gives org-admin its
own leaner identity shape (org-admin isn't really an "HR employee" the way
a teacher is — it's an account with a role, forced through an HR-shaped
model because that's what exists today). Noted here for whoever designs
that later, not silently patched over.

**`legacy_user_id` for org-admin:** org-service's own `User.id` (the local
row `User.objects.create_user(...)` already creates) — same "repurpose a
local service's own PK as the idempotency key, since there's no literal
auth-8001 `users_user.id` involved in this specific creation path" pattern
already used for the central-auth-branch student sync in D-b2/D-b3.

## Investigation — the org-sync target

**Question 2: where does org name/active-status live centrally?** Checked
central auth's `Organization` model (`employees/models.py:73-99`) —
existed, under `Tenant`, but had **no idempotency key at all** (no
`legacy_org_id`-style field, unlike `Employee`/`NonStaffIdentity`, both of
which already have `legacy_user_id`) and **no `is_active` field at all**
(only `SoftDeleteModel`'s `is_deleted` — a different concept: deletion, not
temporary suspension for non-payment, which is what org-service's
`is_active` actually means). Every sibling model in this hierarchy that
needs an active flag already has its own (`Tenant.is_active`,
`Employee.is_active`, `NonStaffIdentity.is_active`) — `Organization` was
the one missing it.

**Chosen approach: the minimal addition the prompt anticipated** — added
both fields via one additive migration
(`0021_organization_is_active_organization_legacy_org_id.py`, confirmed
clean: `makemigrations` produced exactly these two `AddField` operations,
nothing else), plus a new thin endpoint,
**`POST /api/internal/sms-org-sync`** (`employees/internal_api.py`),
mirroring `sms-staff`/`sms-student`'s exact secret-check/fail-closed shape.
Matches/creates an `Organization` by `legacy_org_id`; both `name` and
`is_active` are optional in the request, so a partial update (e.g. just
`is_active` on invoice approval) never clobbers the other field with null.

**Not wired: the org-creation-time `payment_status='pending'` sync**
(`views.py`'s `OrganizationListCreateView.create()`, the first of the
three `sync-org` call sites). Central auth's `Organization` has no
`payment_status` concept and this phase didn't add one (out of scope —
`payment_status` is billing state, `is_active` already covers "can this
org's users actually log in," which is the auth-relevant question). The
org-creation-time central write is instead handled by the *serializer's*
own `create()` (Part 1's `sync_org_to_central_auth(legacy_org_id=org.id,
name=org.name, is_active=org.is_active)` call), so the org still lands in
central at creation time — just not carrying a field central has no
concept of.

## Question 3 — the RBAC catalog gap

Confirmed exactly as the prompt anticipated: `permissions/sms_catalog.py`'s
`SMS_ROLE_TYPE_TO_NAME` only maps `'student'` — no `'org_admin'` entry, and
`_get_or_create_role_designation()` (reused from B1, unaffected) only
creates an HR *designation* ("Org Admin"), not an RBAC *role* grant
(`EmployeeRole`/`Role`/`Permission`). **This does not block login** —
proven below, an org-admin logs in successfully with `perms: []`. It does
mean an org-admin's central-issued token carries no permissions until SMS
gets a staff RBAC catalog (a separate, larger gap already known from C11,
restated here because this phase makes it concretely reachable for the
first time via a real org-admin login).

## What was built

**Part 1** — `org-service/services/central_auth_sync_service.py` (new,
mirrors staff-service's B4 file and student-service's D-b2 file):
`sync_org_admin_to_central_auth()` (posts to `sms-staff`, role='org_admin')
and `sync_org_to_central_auth()` (posts to the new `sms-org-sync`). Wired
into `OrganizationCreateSerializer.create()` right after the existing
auth-8001 call — both fire unconditionally in sequence (dual-write, same
"local write already committed, sync failure never rolls anything back"
shape as B4).

**Part 2** — `sync_org_to_central_auth()` wired into the other two live
`sync-org` call sites: `OrganizationDetailView.perform_update()` (org
name/active edits) and the invoice-approve view (org activation on
payment). Both gated the same way the existing auth-8001 calls already
are (`if len(sync_payload) > 1` / unconditional on activation).

**Central auth**: migration `0021_...` (2 additive fields on
`Organization`), new `POST /api/internal/sms-org-sync` endpoint.

**Config**: added `SYNC_TO_CENTRAL_AUTH`/`CENTRAL_AUTH_URL`/`SMS_INTERNAL_SECRET`
to `org-service`'s `docker-compose.yml` block (didn't exist there before —
only the JWKS-related `CENTRAL_AUTH_SERVICE_URL` did), same defaults as
staff/student-service. Added `extra_hosts: host-gateway` too (same
D-b3 belt-and-suspenders reasoning). No Dockerfile change needed — unlike
student-service in D-b2, org-service's own directory copy happens *before*
its vendored `auth-service/services/` copy, and there's no filename
collision (`central_auth_sync_service.py` doesn't exist in the vendored
app), so the merge is safe either way.

**Not touched, flagged as a further gap:** `org-cron`'s
`mark_overdue_invoices`/`generate_recurring_invoices` management commands
also call auth-8001's `/api/internal/sync-org/` (per the D0 audit) but
were never named in this prompt's three call sites and weren't touched
here — a real, additional dual-write gap for whoever picks up org-cron
specifically.

## Proof — Part 1, live, flag ON

```
>>> OrganizationCreateSerializer(data={
        'name': 'D-b5 Test Organization', 'admin_email': 'd.b5.orgadmin@sms-test.local',
        'admin_password': 'DB5OrgAdmin@123', 'admin_full_name': 'D B5 Test OrgAdmin',
        'code_prefix': 'DB5TST'}).save()
[WARN] Could not reach auth-service ...              ← auth-8001 not running, expected/unrelated
[CENTRAL-AUTH-SYNC] d.b5.orgadmin@sms-test.local -> {"created": 1, "updated": 0, "errors": []}
[CENTRAL-AUTH-SYNC] org 3 -> {"created": true, "updated": false}
org created: 3 D-b5 Test Organization True
```
Then logged in via `/api/auth/login-sms`:
```
→ 200 {"principal": {"person_type": "staff", "full_name": "D B5 Test OrgAdmin",
        "role": "Org Admin", "services": ["sms"], "perms": []}}
```
`employee_code` in the decoded token: `SMS-G-26-ORG_ADMIN-0001`. `perms: []`
confirms the flagged catalog gap without blocking login, exactly as
predicted.

## Proof — Part 2, direct endpoint

```
$ curl -X POST .../sms-org-sync -H "X-Internal-Secret: <correct>" -d '{"legacy_org_id":88801,"name":"D-b5 Test Org","is_active":false}'
→ 200 {"created": true, "updated": false}
$ curl ... -H "X-Internal-Secret: wrong" -d '{"legacy_org_id":88802,...}'
→ 401 {"error": "Invalid or missing internal secret"}
$ curl -X POST .../sms-org-sync -H "X-Internal-Secret: <correct>" -d '{"legacy_org_id":88801,"is_active":true}'
→ 200 {"created": false, "updated": true}     ← idempotent, partial update
```
Verified in the DB after: `name` stayed `"D-b5 Test Org"` (untouched by the
`is_active`-only second call — partial-update semantics confirmed),
`is_active` flipped to `True`, `org_code` correctly derived (`SO88801`),
`tenant` correctly `SMS01`.

## Proof — flag OFF

```
>>> OrganizationCreateSerializer(data={... 'admin_email': 'd.b5.flagoff@sms-test.local' ...}).save()
[WARN] Could not reach auth-service ...    ← same as always, unrelated
LOCAL CREATE SUCCEEDED: 4 D-b5 FlagOff Organization
```
No `[CENTRAL-AUTH-SYNC]` line at all. Confirmed on central auth:
`Employee.objects.filter(org_email__iexact='d.b5.flagoff@sms-test.local').exists()` → `False`.

## Proof — unreachable-safe

Stopped `auth_service`, flag ON, created another org:
```
[CENTRAL-AUTH-SYNC] Could not reach central auth: <urlopen error [Errno 101] Network is unreachable>
[CENTRAL-AUTH-SYNC] Could not reach central auth: <urlopen error [Errno 101] Network is unreachable>
LOCAL CREATE SUCCEEDED: 5 D-b5 Unreachable Organization
```
Both the org-admin sync and the org sync failed independently and were
each caught/logged — the local org creation completed successfully either
way. Restarted `auth_service` afterward.

## VMS/HDMS unchanged

No file under `Enterprise-Resource-Planning/` other than `employees/models.py`
(the additive migration) and `employees/internal_api.py` (the new endpoint,
purely additive — `sms-staff`/`sms-student` untouched) was touched.
`authentication/api.py`/`jwt_utils.py` — home of `/login`, `/login-vms`,
`/login-hdms`, `/refresh`, and all token-claim logic — were never opened
this phase. Live-checked anyway:
```
$ curl -X POST .../login-vms -d '{"employee_code":"VMST-B1-G-26-V-0006","password":"VmsUser@123"}'
→ 401 {"error": "invalid_credentials", "detail": "Employee code not found or account inactive"}
```
Same result as every prior phase's identical check — that specific
synthetic VMS employee still isn't present in this dev DB (pre-existing,
already documented, not a regression).

## Cleanup

Central auth: the org-admin `Employee` plus its `UserCredentials`/
`RefreshToken` rows, and both `Organization` rows created during testing
(`legacy_org_id` 88801 and 3). org-service: all 3 synthetic local
`Organization` rows (3, 4, 5) and their admin `User` rows. `org-service`
recreated with `SYNC_TO_CENTRAL_AUTH` back at its default (`false`)
afterward.

## What's next

D-b6 (attendance-service's direct `auth_db` reads → token-based check) is
next, per the prompt, then the actual retirement steps. Also still open:
`org-cron`'s own sync-org calls (flagged above), and the org-admin
synthetic-HR-field tradeoff (flagged above) for whenever org-admin gets a
proper identity shape of its own.
