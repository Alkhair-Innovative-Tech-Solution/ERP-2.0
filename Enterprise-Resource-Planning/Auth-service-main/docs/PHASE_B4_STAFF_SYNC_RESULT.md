# Phase B4: Repoint Staff-Creation Sync at Central Auth (Dual-Write) — Result

Branch: `phase-b4-repoint-staff-sync` (not merged to `main`). Scoped to
`staff-service/` plus a thin central-auth receiving endpoint, per the
prompt. `org-service` was found to have its own separate auth-8001 sync
path (`org-service/users/serializers.py`, `views.py`) — confirmed
out of scope (different service) and **not touched**.

## 1. Full inventory of staff→auth creation points

| # | Location | Type | Routes through `UserCreationService`? |
|---|---|---|---|
| 1 | `teachers/signals.py::create_teacher_user` (post_save) | Live signal | Yes — `create_user_from_entity(instance, 'teacher')` |
| 2 | `principals/signals.py::create_principal_user` (post_save) | Live signal | Yes — `create_user_from_entity(instance, 'principal')` |
| 3 | `coordinator/signals.py::create_coordinator_user` + `on_assigned_levels_changed` (post_save/m2m_changed) | Live signal | Yes (already touched in Phase A3 for the FK, not for sync) |
| 4 | `teachers/management/commands/populate_teachers_from_csv.py` | Batch command | Yes — calls `create_user_from_entity` directly |
| 5 | `services/user_creation_service.py::create_users_for_existing_entities()` | Batch utility | Yes — internally calls `create_user_from_entity` per entity |
| 6 | `teachers/management/commands/sync_staff_to_auth.py` | Batch command | **No** — fully separate implementation (own `_sync_to_auth()`, own raw-SQL local-user creation, own staff-fetch) |
| 7 | `teachers/services/teacher_csv_import.py::_ensure_teacher_user_account()` | CSV import path | **No** — separate again, and **found to not even sync to auth-8001 before this change** (no `AUTH_SERVICE_URL` call anywhere in this file) |
| 8 | `coordinator/management/commands/create_campus6_coordinators.py` | One-off script | Not separate — just calls `Coordinator.objects.create(...)`, which fires #3 |
| — | `org-service/users/serializers.py`, `org-service/users/views.py` | Different service | Out of scope — confirmed present, not touched, flagged here per the prompt's own inventory list |

**Consolidation finding**: entries #1–5 already funnel through exactly
ONE shared function — `UserCreationService.create_user_from_entity()`.
This meant Step 3 ("consolidate the signals if trivial") needed **zero**
changes to any signal file — the dual-write only had to be added in one
place to cover five call sites at once. Only #6 and #7 needed their own
separate integration, since they never shared code with #1–5 to begin
with.

## 2. The dual-write, and where the shared helper lives

New file: `staff-service/services/central_auth_sync_service.py` — two
functions:

- **`sync_staff_to_central_auth(**plain_fields)`** — the actual HTTP call.
  Takes plain values matching central auth's `SMS_STAFF_RECORD_FIELDS`
  contract (Phase B1) exactly. This is the ONE place the payload is built
  and the request is sent — both the entity-based call sites and the
  raw-SQL-based batch command (#6, which never had Django model objects
  to work with) call this same function with values from their own data
  source. No-ops immediately (`return False, "disabled..."`) unless
  `SYNC_TO_CENTRAL_AUTH=true`.
- **`sync_staff_entity_to_central_auth(user, entity, entity_type)`** —
  convenience wrapper for the common case (a `users.User` + a
  Teacher/Principal/Coordinator profile object), extracts
  cnic/dob/gender/joining_date/contact_number via `getattr` and delegates
  to the function above.

**Wired into exactly 3 places** (matching the 3 independent
implementations found in the inventory):

1. `services/user_creation_service.py::create_user_from_entity()` — one
   call, right after the existing `_sync_user_to_auth(user, entity)`
   line. Covers inventory items #1–5.
2. `teachers/services/teacher_csv_import.py::_ensure_teacher_user_account()`
   — added both the missing auth-8001-equivalent gap gets addressed for
   free (this path now reaches central auth at least, even though
   auth-8001 itself still isn't touched here — flagged as a pre-existing,
   separate gap, not created by this change) and the central-auth
   dual-write.
3. `teachers/management/commands/sync_staff_to_auth.py` — extended the
   existing per-row raw-SQL query (which already fetched
   campus_id/contact_number) to also select `cnic, dob, gender,
   joining_date`, fetches the **real** local password hash (not a blind
   `DEFAULT_PASSWORD` assumption — an existing local user may already have
   a changed password), and calls `sync_staff_to_central_auth()` after the
   existing `_sync_to_auth()` call.

### Central auth's receiving side

New: `Auth-service-main/.../employees/internal_api.py` —
`POST /api/internal/sms-staff`, gated by an `X-Internal-Secret` header
(same convention SMS's own auth-8001 already uses for its
`/api/internal/create-user/` endpoint). The handler does exactly one
thing: `import_staff_records([record], tenant_code="SMS01")` — **the
literal Phase B1 function**, called with a one-record list. Batch (B1's
own command) and live (this endpoint) are the same create/upsert code
reached two different ways, not two implementations.

**Fails closed**: if `SMS_INTERNAL_SECRET` isn't configured, every
request is rejected regardless of what secret is sent — there's no way to
accidentally leave this endpoint open.

### Network topology finding

Central auth's container (`auth_service`) is on Docker network
`erp_network`; SMS's `staff-service`/`ams_staff` is on
`school-management-system-new_default` — **different networks**,
confirmed via `docker inspect`. Rather than joining networks (a real
infra change, exactly the kind of thing the rules say not to do silently)
the SMS-side helper targets `http://host.docker.internal:8000` by
default — central auth's port 8000 is already published to the host
(`docker-compose.override.yml`), and `host.docker.internal` is reachable
from SMS containers without any network reconfiguration. Confirmed live
(`curl` from inside `ams_staff` reached central auth and got a proper
`401` before the secret was wired in — proving connectivity, not just a
timeout). `CENTRAL_AUTH_URL` is an env var, overridable per environment.

### Config additions (gitignored `.env` files, not in the diff)

- `Enterprise-Resource-Planning/.env`: added `SMS_INTERNAL_SECRET` (dev
  value).
- `School-Management-System-New/.env` (**new file**): same
  `SMS_INTERNAL_SECRET` value (must match), plus a comment documenting
  that `SYNC_TO_CENTRAL_AUTH` is deliberately left unset here so it
  defaults to `false` — enable per-run/per-environment via
  `SYNC_TO_CENTRAL_AUTH=true docker compose up -d staff-service`, not by
  baking it into a committed default.
- `staff-service`'s `docker-compose.yml` environment block gained
  `SYNC_TO_CENTRAL_AUTH` (default `false`), `CENTRAL_AUTH_URL`, and
  `SMS_INTERNAL_SECRET` — all `${VAR:-default}` substitutions, additive.

## 3. The "12345" / first-login enforcement — honest status

**SMS's own side (auth-8001): enforcement exists and is real**, confirmed
by reading `auth-service/users/views.py:145-159` — on login, if
`has_changed_default_password` is `False`, the endpoint does **not**
return a normal session token; it returns `requires_password_change:
True` (with a direct-OTP path for students, an email-verification path
for staff) and blocks normal access until the password is changed. This
isn't a stored-but-ignored flag — it's a real branch in the login
response.

**Central auth's side: no equivalent field or check exists.**
`Employee`/`UserCredentials` have no `has_changed_default_password`-style
field. **This is not yet a live gap**, though, because central auth has
no SMS-staff login endpoint at all (deferred since Phase A2/B1/B2/B3 —
consistent with every prior phase's scope). Flagging this explicitly as
an open item for whenever a central-auth SMS staff login flow is built,
rather than adding an unrequested field now to paper over a check that
has nothing to enforce yet.

The dual-write itself carries the state honestly: `is_active` is passed
through in both integration paths, and the actual password *hash*
carried over is whatever SMS's local `User.password` currently is — if
SMS's own enforcement above has already forced a real password change by
the time B1/Phase C data flows, that real hash (not "12345"'s) is what
central auth gets. No permanent "12345" is silently manufactured or
hidden by this change.

## 4. Proof: flag OFF → only auth-8001

Created a synthetic coordinator (`b4.flagoff.coord@sms-test.invalid`)
with `SYNC_TO_CENTRAL_AUTH=false` (the default):

```
[AUTH-SYNC] User b4.flagoff.coord@sms-test.invalid created in auth-service (status 201).
(no [CENTRAL-AUTH-SYNC] line at all — sync_staff_to_central_auth no-op'd silently)
```

Confirmed directly: `Employee.objects.filter(org_email__iexact='b4.flagoff.coord@...').exists()` → `False` in central auth.

## 5. Proof: flag ON → both sides, all 3 entry points

Restarted `staff-service` with `SYNC_TO_CENTRAL_AUTH=true`.

**Live signal path** (Teacher creation → `UserCreationService`):
```
[AUTH-SYNC] User b4.flagon.teacher@sms-test.invalid created in auth-service (status 201).
[CENTRAL-AUTH-SYNC] b4.flagon.teacher@sms-test.invalid -> {"created": 1, "updated": 0, "errors": []}

Central auth: legacy_user_id=8, employee_code=SMS-G-26-TEACHER-0001, tenant=SMS01
check_password('12345') [the real DEFAULT_PASSWORD]: True
check_password('wrong'): False
```

**Batch command path** (`sync_staff_to_auth.py --type coordinator`, run
against the coordinator created earlier during the flag-off test — proving
the batch tool independently catches anything the live path missed):
```
[AUTH]  coordinator ... → already exists in auth
[CENTRAL-AUTH-SYNC] b4.flagoff.coord@sms-test.invalid -> {"created": 1, "updated": 0, "errors": []}
[CENTRAL-AUTH] coordinator ... → {"created": 1, "updated": 0, "errors": []}

Central auth: legacy_user_id=7, employee_code=SMS-G-26-COORDINATO-0002, tenant=SMS01
```

**CSV-import path** (`_ensure_teacher_user_account`, called directly —
the path that previously never synced anywhere):
```
[AUTH-SYNC] User b4.csvpath.teacher@sms-test.invalid created in auth-service (status 201).
[CENTRAL-AUTH-SYNC] b4.csvpath.teacher@sms-test.invalid -> {"created": 1, "updated": 0, "errors": []}

Central auth: legacy_user_id=9, employee_code=SMS-G-26-TEACHER-0003
```

All 3 confirmed independently — same shared `sync_staff_to_central_auth()`
function, three different entry points, central auth's `import_staff_records()`
untouched from B1.

## Proof VMS/HDMS unchanged

```
manage.py check   -> System check identified no issues (0 silenced)
POST /api/auth/login-vms  (VMST-B1-G-26-V-0001) -> vms_role: receptionist
POST /api/auth/login-hdms (VMST-B1-G-26-H-0002) -> role: assignee
```

Byte-identical to every prior increment's baseline.

## Final verification

```
central auth: pytest permissions/ authentication/ employees/ -> 5 failed, 64 passed, 25 errors
              (identical to B3's confirmed baseline — same pre-existing dept_sector-fixture cause)
staff-service: no test suite exists (confirmed in Phase A3 already; manage.py check clean)
```

## Synthetic data: cleaned up

All test Teachers/Coordinators/Users/Campus/Level deleted from
`staff_db`, all matching rows deleted from SMS's own `auth_db`
(auth-8001), all matching `Employee`/`UserCredentials`/
`EmployeeAssignment` rows deleted from central auth. `staff-service`
restarted back to its default `SYNC_TO_CENTRAL_AUTH=false` state after
the proof — the flag is OFF in the running environment right now, exactly
as it should be until deliberately turned on per-deployment.

## Confirmed untouched

- `org-service`'s own auth-8001 sync path (`serializers.py`, `views.py`)
  — found, confirmed different service, not modified.
- SMS's own `auth_db`/auth-8001 login and user tables — unchanged, still
  the only thing SMS actually authenticates against.
- VMS, HDMS — unmodified, proved above.
- Central auth's B1 import logic (`employees/sms_import.py`) — reused
  as-is via `import_staff_records()`, not duplicated or modified.

## What's next

Not done here: **Phase C** — repointing the 13 SMS services onto
central-auth JWKS-verified tokens, one service at a time (the "long
stretch" per the plan). Also open, flagged above: central auth gaining
its own first-login-enforcement equivalent, whenever an actual
central-auth SMS staff login endpoint gets built.
