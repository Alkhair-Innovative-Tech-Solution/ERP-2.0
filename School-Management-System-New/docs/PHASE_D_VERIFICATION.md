# Phase D Verification — Answers to the D0 Audit's Open Questions

> ANALYSIS ONLY. No code, config, or migration was changed to produce this report.
> Scope: cross-checks both `School-Management-System-New/` (SMS) and
> `Enterprise-Resource-Planning/Auth-service-main/Backend/src/` (central auth).
> Follows on from `School-Management-System-New/docs/PHASE_D0_RETIRE_AUDIT.md`.

## Q1 — Does central auth already have an SMS-usable login endpoint?

**Verdict: No — not as-is. Central auth's `/api/auth/login` is structurally close (JWT
issuance, employee lookup, credential check) but the request/response contract does not
match what the SMS frontend sends or expects, and it has no student path at all. A new
SMS-facing login endpoint (or an adapter in front of the existing one) has to be built.**

### Can an SMS staff user log in via `/api/auth/login` today?

Mechanically, yes an imported SMS `Employee` row *can* authenticate against
`/api/auth/login` — but only if the caller already knows the row's central
`employee_code`, which SMS users never see:

- `employee_code` **is populated** for imported staff. `_import_staff_one`
  (`Enterprise-Resource-Planning/Auth-service-main/Backend/src/employees/sms_import.py:209-258`)
  creates an `EmployeeAssignment` with `is_primary=True`
  (`sms_import.py:249-254`), and `EmployeeAssignment.save()`
  (`employees/models.py:499-534`) auto-derives and writes
  `Employee.employee_code` as part of that save (`employees/models.py:522-527`,
  format `{prefix}-{shift}-{year}-{role}-{seq}`, e.g. `SMS-G-24-TEACHER-0001`).
  So the field is not blank/broken for imported rows.
- But that code is **central auth's own generated identifier**, never shown to or
  known by the SMS user — SMS users authenticate with **email + password**
  (`School-Management-System-New/frontend/src/lib/api.ts:307-317` sends
  `{ email: emailOrCode, password }`), and central auth's `LoginRequest` schema
  requires `employee_code`
  (`Enterprise-Resource-Planning/Auth-service-main/Backend/src/authentication/api.py:35-37`).
  There is no email→employee_code lookup anywhere in central auth's login path
  (`authentication/api.py:117-141` looks up `Employee.objects.get(employee_code=...)`
  only). An SMS user typing their email/password today gets a Ninja 422 schema-validation
  error, not a 401 — the request never reaches the credential check.

### Can a student (`NonStaffIdentity`) log in anywhere in central auth?

**Confirmed: no.** `authentication/api.py` (the entire `auth_router` — `/login`,
`/login-hdms`, `/login-vms`, `/refresh`, `/me`) has **zero** references to
`NonStaffIdentity` (`grep -n "NonStaffIdentity" authentication/api.py` → no matches).
Every login endpoint looks up `Employee` or `SuperAdmin` only
(`authentication/api.py:117-141, 364-370, 467-474`). `NonStaffIdentity` exists as a
model (`authentication/nonstaff_models.py`) and `jwt_utils.generate_access_token()`
already knows how to mint a token *for* one if handed the object
(`authentication/jwt_utils.py:87-94`, `_detect_principal_type`), but nothing in the
API layer ever constructs that path — there is no HTTP entry point that authenticates
a student and calls `generate_access_token(non_staff_identity)`.

### Frontend expectation vs central auth's actual `/login` — mismatch table

| Aspect | SMS frontend expects (`frontend/src/lib/api.ts:307-330`) | Central auth `/api/auth/login` provides (`authentication/api.py:35-210`) | Mismatch |
|---|---|---|---|
| Request identifier field | `email` (JSON key, holds email or code) | `employee_code` (required, Ninja `LoginRequest` schema) | **Field name + semantics differ** — SMS has no employee_code to send |
| Request body | `{ email, password }` | `{ employee_code, password }` | Different key |
| Success response — tokens | `data.access`, `data.refresh` | `access_token`, `refresh_token` | **Different field names** |
| Success response — principal | `data.user` (object) | `employee` (object) | **Different field name**, and shape differs (central's `employee` dict has `employee_id`/`department`/`designation`, not whatever shape SMS's `sis_user` expects) |
| Success response — org context | `data.organization` (object, stored to `sis_organization`) | *(field does not exist)* | **Missing entirely** — central auth's `LoginResponse` schema has no organization field (`authentication/api.py:46-50`) |
| Student login | Same endpoint/flow serves students (SMS has one combined login) | No student path exists (see above) | **Entire capability missing** |
| Refresh | `AUTH_REFRESH` → `POST /api/auth/refresh` with presumably `{refresh}` | `POST /api/auth/refresh` expects `{refresh_token}` (`authentication/api.py:53-54, 247-248`), returns `{access_token, expires_in}` (no new refresh token) | Field-name mismatch, same class as login |

### What this tells us D must build

A new SMS-facing login surface is required — not a client-side tweak. At minimum it
needs to: (a) accept email+password (or resolve email→employee_code server-side), (b)
return `access`/`refresh`/`user`/`organization` in the shape the existing frontend
already parses (or the frontend must change instead — a product decision, not something
this pass decides), and (c) support a student identity path that does not exist today.

---

## Q2 — Is the staff dual-write to central auth actually ON and working?

**Verdict: Off everywhere visible in this repo, by design (explicit flag, defaults
false, never flipped). Even if flipped on, the default network target would not be
reachable from this environment without an additional compose change.**

### Where `SYNC_TO_CENTRAL_AUTH` is set

- Full-repo search for an actual assignment (`SYNC_TO_CENTRAL_AUTH=`) across every
  `*.env*`, `*.yml`, `*.yaml`, `*.sh` under `ERP-2.0/` found **one hit**, and it is a
  comment, not an assignment:
  `School-Management-System-New/docker-compose.yml:443` —
  `# Off by default — set SYNC_TO_CENTRAL_AUTH=true in the environment`.
- The only place the variable is actually *consumed* is
  `docker-compose.yml:445` — `SYNC_TO_CENTRAL_AUTH: ${SYNC_TO_CENTRAL_AUTH:-false}` —
  which falls back to the literal string `false` because the shell/`.env` never sets it
  (confirmed: `School-Management-System-New/.env` has no `SYNC_TO_CENTRAL_AUTH` line at
  all — `grep` for it returns nothing).
- The consuming code checks it as a case-insensitive string equality gate:
  `School-Management-System-New/microservices/staff-service/services/central_auth_sync_service.py:42-43` —
  `if os.getenv('SYNC_TO_CENTRAL_AUTH', 'false').lower() != 'true': return False, "disabled (...)"`.
- **Effective value in every environment visible to this repo (dev compose, `.env`): `false`.**
  There is no staging/prod compose or env file in this repo tree that overrides it —
  Q5 flags whether a real deployment sets it differently, since that's outside what code
  can answer.

### Would a sync call succeed if the flag were flipped on?

Traced the two things `sync_staff_to_central_auth()` needs
(`staff-service/services/central_auth_sync_service.py:26-80`):

1. **Shared secret** — `SMS_INTERNAL_SECRET`.
   - SMS side: `School-Management-System-New/.env:1` =
     `dev-only-sms-internal-secret-b4-not-for-prod`.
   - Central-auth side: `Enterprise-Resource-Planning/.env:38` = the **same** value
     `dev-only-sms-internal-secret-b4-not-for-prod`.
   - Central auth's receiver reads it via `config('SMS_INTERNAL_SECRET', default='')`
     (`employees/internal_api.py:21`) and fails closed if unset/mismatched
     (`internal_api.py:54-56`). **Secrets match in this dev environment** — the
     signature check itself would pass.

2. **Reachability of `CENTRAL_AUTH_URL`.**
   - SMS side default: `http://host.docker.internal:8000`
     (`School-Management-System-New/docker-compose.yml:446`, and reused as the default
     for `CENTRAL_AUTH_SERVICE_URL`/`AUTH_SERVICE_URL` on ~10 other services at lines
     359, 413, 489, 550, 608, 641, 667, 746, 770, 804, 836 — same fallback host:port
     throughout).
   - Central auth's Django container only `expose`s port 8000 to its own Docker
     network by default (`Enterprise-Resource-Planning/Auth-service-main/docker-compose.yml:20-22`,
     `expose: - "8000"` — not `ports:`, so not published to the host by the base
     compose file alone). A host port publish only exists in
     `Auth-service-main/docker-compose.override.yml:6` and
     `docker-compose.dev.yml:12` (`"8000:8000"`) — files that must be explicitly
     active for the mapping to exist.
   - Even with that port published, `host.docker.internal` only auto-resolves inside
     containers on Docker Desktop (Mac/Windows). This host is native Linux (per this
     session's environment). Native Linux Docker requires an explicit
     `extra_hosts: ["host.docker.internal:host-gateway"]` entry to resolve that name —
     `grep` for `extra_hosts` or `host.docker.internal` as a mapped host (not just as
     an env default string) in `School-Management-System-New/docker-compose.yml`
     found **no such entry**.
   - SMS's compose also has no top-level `networks:` block joining `erp_network`
     (the network central auth's compose creates/uses), so container-name resolution
     (`http://auth-service:8000`) isn't an alternate path either without that.

**Conclusion: staff sync is flag-gated off everywhere in this repo, and is flag-only —
never demonstrated live. If someone flips `SYNC_TO_CENTRAL_AUTH=true` on this exact dev
setup without also fixing host reachability (publish the port + add `extra_hosts`, or
join `erp_network`), the sync calls will fail at the connection stage, not the auth
stage — and since `sync_staff_to_central_auth()` swallows all exceptions and just logs
+ returns `(False, message)` (`central_auth_sync_service.py:69-80`), that failure is
silent from the caller's perspective.**

---

## Q3 — What does central auth need to receive a NEW student login? (the student gap)

**Confirmed: no central-auth path creates a student login on student creation, and no
student login endpoint exists.** What exists is a one-off, manually-triggered batch
import — not a live sync, and not paired with any way to actually log a student in.

- **No live/internal student-sync endpoint.** `employees/internal_api.py` (the file
  that holds the one existing internal endpoint, `POST /api/internal/sms-staff`) has
  **zero** references to `NonStaffIdentity` — there is no `POST /api/internal/sms-student`
  or equivalent. Compare to staff, which has exactly this
  (`employees/internal_api.py:49-64`, receiving live pushes from SMS's
  `sync_staff_entity_to_central_auth`).
- **What does exist: a manual CLI import.**
  `employees/management/commands/import_sms_students.py:1-45` — a Django management
  command that reads a JSON file (`--json-file`) of pre-exported student records and
  calls `import_student_records()` (`employees/sms_import.py:280-311`). This is a
  batch/offline tool: someone has to produce the JSON file and run the command by hand;
  nothing in SMS calls this automatically when a student is created (unlike staff,
  where `UserCreationService`/CSV import/`sync_staff_to_auth` all call the live sync
  function on every create — `staff-service/services/user_creation_service.py:125-130`,
  `staff-service/teachers/services/teacher_csv_import.py:258-260`).
- **No student login endpoint at all**, live or otherwise (established under Q1 —
  `authentication/api.py` has zero `NonStaffIdentity` references across every route).
- **Credentials CAN be created for a `NonStaffIdentity`** — `_upsert_credentials()`
  supports `non_staff_identity=identity` as a link kwarg
  (`employees/sms_import.py:132-141, 308`), and the `UserCredentials` model/migration
  already supports linking to either an `Employee` or a `NonStaffIdentity`
  (migration `0006_nonstaffidentity_usercredentials_non_staff_identity.py`). So the
  data model is ready for login — only the HTTP layer (an internal create endpoint for
  live sync, and a public login endpoint) is missing.

**What's missing, concretely:**
1. A live internal endpoint analogous to B4's `POST /api/internal/sms-staff` —
   e.g. `POST /api/internal/sms-student` — wired to `import_student_records()` (which
   already exists and already does the right upsert), called from SMS's student-service
   the same way staff-service calls its counterpart. This part is nearly free: the
   underlying `import_student_records()` function and its `_upsert_credentials` wiring
   already work; only the receiving router + the SMS-side caller are absent.
2. A student login endpoint in `authentication/api.py` (or a combined endpoint that
   tries `Employee` then falls back to `NonStaffIdentity`) — genuinely new code, since
   `jwt_utils.generate_access_token()` already handles a `NonStaffIdentity` argument
   correctly (`jwt_utils.py:87-94`) but nothing calls it with one.

---

## Q4 — What still talks to auth-8001? (go/no-go checklist)

All four D0-flagged dependencies are re-confirmed **still present**, with fresh
`file:line` citations (no code changed since D0; minor line-number drift below vs D0
is from unrelated C-phase edits to the same files, not from any removal):

| # | Dependency | Still present? | Evidence |
|---|---|---|---|
| 1 | Frontend login + refresh → auth-8001 (via nginx) | **Yes** | `School-Management-System-New/frontend/src/lib/api.ts:307-317` (`loginWithEmailPassword`, hits `AUTH_LOGIN` = `/api/auth/login/`); nginx routes that exact path to auth-8001: `School-Management-System-New/nginx/nginx.conf:125` (`location = /api/auth/login/`) `:128` (`set $svc "auth-service:8001"`) — plus 16 more `auth-service:8001` routes in the same file (lines 55, 134–215, 453) covering refresh/other auth-prefixed paths |
| 2 | `org-service` org-admin provisioning → `/internal/create-user/` | **Yes** | `School-Management-System-New/microservices/org-service/users/serializers.py:159` — `f'{auth_url}/api/internal/create-user/'` |
| 3 | `org-cron` → `/internal/sync-org/` | **Yes** | Three call sites in `School-Management-System-New/microservices/org-service/users/views.py:1664, 1727, 2528` — all `f'{auth_url}/api/internal/sync-org/'`; the `org-cron` service that schedules these is still defined at `School-Management-System-New/docker-compose.yml:368-372` |
| 4 | `attendance-service` direct `auth_db` reads | **Yes** | `School-Management-System-New/microservices/attendance-service/attendance/permissions.py:44-67` — `HasAttendanceViewPermission.has_permission()` opens a raw `psycopg2.connect()` to `AUTH_DB_HOST`/`auth_db` per-request and queries `users_role_permission` directly, failing closed (`except Exception: return False`) on any connection error |

None of these are handled by the C1–C13 central-auth repoints — those added a
*parallel* RS256 path per service, they did not touch or remove any of these four
auth-8001 dependencies. This checklist is the accurate "still to migrate" list.

---

## Q5 — Human-only questions

Code cannot answer these; listing them plainly for a human to resolve:

1. **Is `SYNC_TO_CENTRAL_AUTH=true` in any REAL deployment** (staging/prod), as
   opposed to just this dev repo/environment? This repo has no staging/prod compose
   or env file to inspect — Q2's "off everywhere" finding is scoped to what's checked
   into this repo, not to what might be set out-of-band on a real server.
2. **Does any EXTERNAL client** (a mobile app, a partner integration, a support/ops
   script) call `auth-service:8001` or `org-service:8002` directly, bypassing nginx?
   D0 and this pass only traced references inside this repo's own source tree;
   an external caller with hardcoded URLs would be invisible to a code audit.
3. **Is there a real target host/port** central auth is actually reachable at from SMS's
   production network (as opposed to the dev-only `host.docker.internal:8000`
   fallback documented in Q2) — this is infra/deployment topology, not something in
   version control here.
4. Anything else genuinely outside this repo's source (DNS, secrets vaults, firewall
   rules, load balancer config) that could affect whether the dependencies in Q1–Q4
   actually resolve in a live environment.

---

## What Phase D must BUILD before it can REMOVE

In dependency order — each item gates the removal(s) noted in Q4:

1. **SMS-shaped login endpoint in central auth** (Q1) — accept the SMS frontend's
   existing request shape (or get the frontend's cooperation to change it) and return
   `access`/`refresh`/`user`/`organization`; must cover both staff (email→employee_code
   resolution) and students. This alone gates removal of dependency #1 (Q4).
2. **Student identity pipeline** (Q3) — a live internal create endpoint
   (`POST /api/internal/sms-student` or equivalent) plus wiring it into central auth's
   new login endpoint from step 1. Without this, step 1 can only ever cover staff.
3. **Turn staff sync on for real** (Q2) — flip `SYNC_TO_CENTRAL_AUTH=true` AND fix the
   network path (publish central auth's port, and either add
   `extra_hosts: host-gateway` or join `erp_network`) so the existing (already-written)
   staff dual-write actually succeeds instead of silently failing. Needed before staff
   logins can rely on central auth having up-to-date credentials.
4. **Frontend repoint target** — once steps 1–3 work, point
   `loginWithEmailPassword()`/`AUTH_LOGIN`/`AUTH_REFRESH` at central auth (directly or
   via nginx) instead of auth-8001. Gates removal of dependency #1.
5. **Org provisioning equivalent** — a central-auth-side replacement for
   `/internal/create-user/` and `/internal/sync-org/` (Q4 #2, #3) so org-service and
   org-cron have somewhere to write instead of auth-8001.
6. **Attendance rebuild** — replace `attendance-service`'s direct `auth_db`
   `psycopg2` read (Q4 #4) with a central-auth-backed permission check (e.g. via the
   RS256 token's own `perms` claim, already present per C-phase work, instead of a
   cross-database query) — the only item of the four that can plausibly be solved
   without a new central-auth endpoint, since the data it needs may already be on the
   token.

Only once 1–6 are done does removing auth-8001, org-service's legacy sync calls, and
attendance-service's `auth_db` credentials become safe. This pass does not design any
of these builds in detail — that's the next increment, informed by the above.
