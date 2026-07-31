# SMS User Migration — Analysis (No Code)

Read-only analysis of what it would take to move SMS's `User` identities onto
central auth (`Enterprise-Resource-Planning/Auth-service-main/`), the same
place VMS/HDMS now authenticate against. **No code was written.** Every
claim below cites `file:line`. SMS repo root for all paths:
`School-Management-System-New/microservices/`.

## Headline finding (read this first)

SMS is not "13 services with a foreign key to one shared `users.User`
table." It is **at least three independently-evolved copies of the
`users` app**, each with its own database, kept loosely in sync (or not)
by HTTP calls and manual management commands:

1. **`auth-service/users/`** — the "real" auth service (own DB `auth_db`).
2. **`org-service/users/`** — a *second, independently diverged* `users`
   app with its own DB (`org_db`), different fields (has `Invoice`/billing,
   lacks `payment_status`/`student_id_pattern`) — see §5.
3. **A third copy, physically duplicated by `COPY` in the Dockerfile of 11
   other services** (attendance, campus, content, fees, notification,
   result, staff, student, subject, support, timetable), each building
   `auth-service/users/`'s source into its own image, migrating it against
   its **own separate Postgres database** (`student_db`, `staff_db`,
   `campus_db`, etc.). Confirmed for all 11 in §2.

This means "move `User` to central auth" isn't one migration — it's
**at least 13 separate databases that each currently believe they own a
`users_user` table**, kept approximately in sync by one manual command
(`sync_staff_to_auth`, staff only) and inline HTTP calls at
creation-time (students). This is the single fact that should shape every
later increment; see §7 for the proposed order.

---

## 1. User identity inventory

| Model | File:line | Link to `User` | Nullable? | Notes |
|---|---|---|---|---|
| `User(AbstractUser)` | `auth-service/users/models.py:93` | — (is the identity) | — | `role` CharField, 11 choices (`ROLE_CHOICES` at `:99-111`); `organization` FK (`:118`); `campus` FK (`:121`); `USERNAME_FIELD='username'` (`:149`) |
| `Organization` | `auth-service/users/models.py:61` | — | — | Django default AutoField PK (not UUID); holds `plan`, `max_users/students/campuses`, `payment_status`, `code_prefix`/`code_pattern` (username-generation config) |
| `Student.user` | `student-service/students/models.py:99` | `OneToOneField('users.User', ..., related_name='student_profile')` | Yes, `SET_NULL` | A `Student` row can exist with `user=None` |
| `Teacher.user` | `staff-service/teachers/models.py:70` | `OneToOneField(User, ..., related_name='teacher_profile')` | Yes, `SET_NULL` | Same pattern |
| `Principal.user` | `staff-service/principals/models.py:68` | `OneToOneField(User, ..., related_name='principal_profile')` | Yes, `SET_NULL` | Same pattern |
| `Coordinator` | `staff-service/coordinator/models.py:47-64` | **No FK field at all** | N/A | Linked to `User` only by convention: `Coordinator.employee_code == User.username` (string match, no DB constraint) — see `staff-service/coordinator/models.py:298,307`, `signals.py:21,50,70,215` |

**How many distinct identity tables/links: 5** (`User` itself, plus 4
profile models — Student/Teacher/Principal have a real nullable OneToOne;
Coordinator has none, just a string convention).

`User.employee_code` (`auth-service/users/models.py:135-143`) is a computed
property, not a field — it reads `teacher_profile.employee_code` or
`principal_profile.employee_code` if present, else falls back to
`self.username`. This property is itself evidence of the looseness: it
`hasattr()`-probes for reverse OneToOne accessors rather than the model
guaranteeing every user has a profile.

Username-prefix generation (`IDGenerator`, `auth-service/utils/id_generator.py`,
called from `auth-service/users/models.py:196-209`) runs inside `User.save()`
and is role-conditional (`superadmin`→`S...`, `admin`→ admin code,
`org_admin`→`OA...`); other roles get no auto-generated username at all —
consistent with staff/students getting their `username` set externally
(employee_code / student_id) before the `User` row is even created via the
internal API (see §3).

---

## 2. FK blast radius (cross-service references)

Two distinct kinds of coupling exist; both matter for a migration, in
different ways.

### 2a. Physical schema duplication (Dockerfile `COPY`, not a real FK)

Every one of these services builds a copy of `auth-service/users/`
(and others) directly into its own image and runs its own migrations
against its own database. Confirmed via `grep "^COPY microservices/" */Dockerfile`:

| Service | Copies `users/` | Copies `campus/` | Copies `teachers/`,`principals/`,`coordinator/` | Copies `students/` | Own DB |
|---|---|---|---|---|---|
| attendance-service | ✓ | ✓ | ✓ | ✓ | `attendance_db` (implied, not directly read) |
| campus-service | ✓ | — (is campus) | ✓ | — | `campus_db` |
| content-service | ✓ | ✓ | ✓ | — | (own) |
| fees-service | ✓ | ✓ | ✓ | — | (own) |
| notification-service | ✓ | ✓ | — | — | (own) |
| result-service | ✓ | ✓ | ✓ | ✓ | (own) |
| staff-service | ✓ | ✓ | — (is staff) | ✓ | `staff_db` |
| student-service | ✓ | ✓ | ✓ | — (is student) | `student_db` |
| subject-service | ✓ | ✓ | ✓ | — | (own) |
| support-service | ✓ | ✓ | ✓ | — | (own) |
| timetable-service | ✓ | ✓ | ✓ | ✓ | (own) |
| **org-service** | **✗ — has its own diverged fork instead** | ✓ | — | — | `org_db` |
| **ai-service** | ✗ — copies nothing | — | — | — | `ai_db` (+ reads `student_db` directly, `ai-service/.../settings.py` `STUDENT_DB_*` vars) |
| auth-service | — (is users) | — | — | — | `auth_db` |

Source: `grep -n "^COPY microservices/" <service>/Dockerfile` for all 14,
run in full during this analysis (all 14 Dockerfiles inspected).

**Consequence**: a schema change to `User`/`Organization` in
`auth-service/users/models.py` does **not** propagate anywhere until every
one of these 11 services' images is rebuilt (picks up the new source) *and*
migrated (applies the new migration against its *own* database). There is
no single migration to run. `org-service`'s fork won't pick up the change
at all — it would need the equivalent edit made twice, by hand, in two
places that have already partly diverged (see §5).

### 2b. Declared ForeignKey/OneToOneField → `users.User` / `users.Organization` / `campus.Campus`

(Within each service's own copy of the model, pointing at its own copy of
the referenced table — i.e. these are "real" Django FKs, but each one is
scoped to that service's own database, not a shared one.)

| Service | Model | Field | Points at | File:line |
|---|---|---|---|---|
| campus-service | `Campus` | `organization` | `users.Organization` | `campus-service/campus/models.py:31` |
| campus-service | `ClassLevel`/`Grade`/`Classroom` | `organization` | `users.Organization` | `campus-service/classes/models.py:38,140,280` |
| auth-service | `Organization` | `created_by` | `users.User` | `auth-service/users/models.py:78` |
| auth-service | `User` | `campus` | `campus.Campus` | `auth-service/users/models.py:121` |
| auth-service | `SubscriptionPlan` | `created_by` | `User` (same app) | `auth-service/users/models.py:32` |
| fees-service | `FeeType`/`FeeStructure`/`StudentFee` | `organization` | `users.Organization` | `fees-service/fees/models.py:31,45,84` |
| fees-service | `FeeStructure` | `campus` | `campus.Campus` | `fees-service/fees/models.py:47` |
| fees-service | (payment record) | `received_by` | `users.User` | `fees-service/fees/models.py:139` |
| org-service | `Organization` (own fork) | `created_by` | `users.User` (own fork) | `org-service/users/models.py:76` |
| org-service | (unnamed) | `campus` | `campus.Campus` | `org-service/users/models.py:161` |
| staff-service | `Coordinator` | `organization` | `users.Organization` | `staff-service/coordinator/models.py:52` |
| staff-service | `Principal` | `organization` | `users.Organization` | `staff-service/principals/models.py:71` |
| staff-service | `Teacher` | `organization` | `users.Organization` | `staff-service/teachers/models.py:73` |
| staff-service | `TeacherSubjectAssignment` | `organization` | `users.Organization` | `staff-service/teachers/models.py:567` |
| attendance-service | `BiometricMapping` | `user` | `users.User` | `attendance-service/attendance/models.py:737` |
| student-service | `FormOption`/`Student` | `organization` | `users.Organization` | `student-service/students/models.py:33,109` |
| student-service | `Student` (×2 fields) | `campus` | `campus.Campus` | `student-service/students/models.py:242,810` |
| student-service | `Student` | `user` | `users.User` | `student-service/students/models.py:99` |
| staff-service | `Teacher`/`Principal` | `user` | `User` | `staff-service/teachers/models.py:70`, `principals/models.py:68` |

This table is not exhaustive of *every* field in every service (14 services
× dozens of models each) — it is every `ForeignKey`/`OneToOneField`
matching `users.User`, `users.Organization`, or `campus.Campus` found by
`grep -rn "ForeignKey(\s*['\"]\?users\.\|OneToOneField(\s*['\"]\?users\.\|...campus\." --include="*.py"` across the tree, plus the
three directly-imported-class cases (`Teacher.user`, `Principal.user`,
`fees `received_by``) found separately because they import `User`/`Campus`
as a Python class rather than a lazy `'app.Model'` string and so don't
match that grep pattern. **Unknown / not fully verified**: whether every
service has additional `organization`/`campus` FKs on models not yet
grepped by name (e.g. result-service, timetable-service, subject-service
internals were not individually read line-by-line) — the Dockerfile
`COPY` table in §2a is the more reliable signal of blast radius per
service, since it shows *the models are physically present* whether or not
every consuming field was enumerated.

---

## 3. The existing sync path — `sync_staff_to_auth`

Full trace, `staff-service/teachers/management/commands/sync_staff_to_auth.py`:

1. **Manual command**, not a signal or cron job: `python manage.py sync_staff_to_auth [--type all|principal|teacher|coordinator] [--dry-run]` (`:120-126`). Nothing calls it automatically.
2. Reads staff-service's **own local** `principals_principal` / `teachers_teacher` / `coordinator_coordinator` tables via raw SQL (`:43-80`), explicitly to bypass the org-scoped manager ("no thread-local user in management commands", `:44`).
3. Skips any record with no `employee_code` (`:140-143`).
4. For each record, **two separate writes**:
   - a. `_local_user_exists()` (`:83-89`, checks staff-service's *own* `users_user` copy by email-or-username) → if missing, `_create_local_user()` (`:92-114`) inserts directly into staff-service's own `users_user` table with `password = make_password("12345")` (`:12`, `:110`), via `user.save_base(raw=True)` to skip signals (`:111`).
   - b. `_sync_to_auth()` (`:15-40`) — HTTP POST to `{AUTH_SERVICE_URL}/api/internal/create-user/`, **also** with `password: "12345"` (`:12,18`), header `X-Internal-Secret: {INTERNAL_SERVICE_SECRET}` (`:29`). Treats HTTP 409 (already exists) as success (`:36-37`).
5. Matching key on both sides is `email` or `username` (`= employee_code`) — no stronger identity guarantee than string equality.

**Receiving end**, `auth-service/users/views.py:2490` (`internal_create_user`):
- Auth check: `secret = request.headers.get('X-Internal-Secret', '')`; `expected = os.environ.get('INTERNAL_SERVICE_SECRET', '')`; rejects with 403 if empty or mismatched (`:2506-2509`). **Security note**: the shared default for this secret across every service, if never overridden, is the literal string `"change-this-secret"` (`docker-compose.yml:6`, `x-common-env` anchor) — a well-known placeholder checked into the repo, not a real secret, unless every deployment's actual `.env` overrides it.
- Docstring (`:2494`) says it's "Called by org-service when creating an org admin during org creation" — i.e. **`sync_staff_to_auth` and org-service are two independent callers** of the same endpoint, for different purposes.
- Rejects on existing email (409, `:2527-2528`) or username (409, `:2529-2530`) — case-insensitive.
- Also upserts an `Organization` row in auth-service's own DB from the `organization` payload dict if given (`:2534-2559`) — i.e. this endpoint is *also* how auth-service's org table learns about orgs that were created elsewhere (org-service). auth-service's `Organization.all_objects.filter(id=org_id)` (`:2543`) trusts the **caller's integer PK** as the auth-service-side PK too — org IDs are assumed to line up 1:1 across databases by construction, not looked up/mapped.

**Is identity already duplicated?** Yes, by design, for staff — a
`teachers_teacher`/`principals_principal`/`coordinator_coordinator` row
plus (potentially) *two* independent `users_user` rows (staff-service's
own copy, and auth-service's), both seeded with the same default password.
**Students** go through a related-but-separate path: `student-service`'s
`students/services/student_csv_import.py`'s `_ensure_student_user_account`
(referenced at `student-service/students/management/commands/backfill_student_auth_accounts.py:27`)
calls the *same* `/api/internal/create-user/` endpoint at student-creation
time / via a backfill command for any student missing an account — this
command's own docstring (`:1-8`) confirms the endpoint is the intended
source of truth for student logins and that failures are expected and
retried, not fatal.

**Security note to flag explicitly**: `DEFAULT_PASSWORD = "12345"` is
hardcoded (`sync_staff_to_auth.py:12`) and used for **every** staff record
synced this way, with `has_changed_default_password: False` (`:24`) sent
to auth-service — i.e. this is a known, tracked "must change on first
login" state, not silently permanent, *if* whatever consumes
`has_changed_default_password` actually enforces a forced change. **Not
verified in this analysis** whether that enforcement exists on the login
path (out of scope of what was read) — flagged as an open question in §8.

---

## 4. How each service authenticates today

| Service | `DEFAULT_AUTHENTICATION_CLASSES` | Algorithm | Settings file |
|---|---|---|---|
| auth-service | `users.authentication.TokenVersionJWTAuthentication` (custom, DB-backed) | HS256, `SIGNING_KEY=SECRET_KEY` | `auth-service/auth_service/settings.py:103-112` |
| ai-service | `rest_framework_simplejwt.authentication.JWTStatelessUserAuthentication` | HS256, `SIGNING_KEY=SECRET_KEY` (env `SECRET_KEY`, wired to `AUTH_SECRET_KEY` in compose) | `ai-service/.../settings.py:70-77` |
| **other 12** (attendance, campus, content, fees, notification, org, result, staff, student, subject, support, timetable) | `ams_shared.jwt.validator.ServiceJWTAuthentication` | HS256, shared `JWT_SECRET_KEY` env var | e.g. `student-service/student_service/settings.py:75`; validator itself at `ams-shared/ams_shared/jwt/validator.py:7,13` |

**All 14 services use the same symmetric scheme**: HS256 with one shared
secret (`AUTH_SECRET_KEY` → `SECRET_KEY`/`JWT_SECRET_KEY` across services,
`docker-compose.yml` `x-common-env:6,8`). This is categorically different
from central auth's RS256 + JWKS (VMS/HDMS pattern) — **every one of the
14 services currently trusts a shared secret it can also sign with**,
which central auth's asymmetric model specifically avoids.

12 of 14 services share **one library** (`ams_shared.jwt.validator`,
installed via `pip install /app/ams-shared` in every Dockerfile — this one
*is* a real pip package, `ams-shared/setup.py` exists, unlike the raw
`COPY` duplication in §2a). `ServiceJWTAuthentication` (`validator.py:21-39`)
is already stateless and claims-only — it builds a `_TokenUser` (`:42-86`)
directly from JWT payload (`user_id`, `org_id`, `role`, `campus_id`,
`username`, `email`, `token_version`) with **no DB query**. This is
structurally the *same shape* as VMS/HDMS's `CentralAuthUser` — good news:
swapping what this ONE file trusts (secret+HS256 → auth-service JWKS
public key+RS256) would, in principle, repoint all 12 services at once,
*if* every one of them is rebuilt and redeployed after the change (they
each `pip install`/build their own copy of `ams-shared` at image-build
time — updating the package source alone does not update a running
container).

auth-service's own `TokenVersionJWTAuthentication` (`auth-service/users/authentication.py:6-29`)
is the **only** one of the 14 that hits the database per-request — it
checks `user.token_version` against the token's `token_version` claim and
force-invalidates on mismatch (used to kill all sessions on a role
change, per its docstring `:8-11`). The other 13 have no equivalent
revocation check; a token is valid until its 24h expiry
(`ACCESS_TOKEN_LIFETIME`, e.g. `auth-service/auth_service/settings.py:104`)
regardless of what changes server-side in the meantime.

**What each would need to switch to central-auth JWKS**: for the 12 on
`ams_shared`, one library change (HS256 shared-secret verify → RS256
JWKS-fetched-key verify, mirroring VMS/HDMS's `central_auth/jwks.py` +
`authentication.py`) plus a rebuild+redeploy of every dependent service —
same *mechanism* as VMS/HDMS Increment 1/2b, but wider blast radius since
12 services share the one artifact instead of 1. `ai-service` and
`auth-service` would each need their own, separate change (they don't
consume `ams_shared.jwt`).

---

## 5. Organization/Campus vs. central Tenant — the landmine

| | Central auth (`Auth-service-main`) | SMS |
|---|---|---|
| Paying-customer concept | `Tenant` — `Enterprise-Resource-Planning/Auth-service-main/Backend/src/employees/models.py:53`. UUID PK, `tenant_code` unique, holds nothing operational (just identity + active flag). Subscriptions attach here. | **No `Tenant` model exists.** `Organization` carries the paying-customer attributes instead: `plan` (FK to `SubscriptionPlan`), `max_users`/`max_students`/`max_campuses`, `payment_status`, `subdomain` — `auth-service/users/models.py:61-88`. |
| HR-structure root | `Organization` — `.../employees/models.py:73`. UUID PK, FK to `Tenant` (nullable), no billing/plan fields at all. | Same name, **different job**: SMS's `Organization` is closer in *responsibility* to central-auth's `Tenant` than to central-auth's `Organization`. |
| Branch/location level | `Institution`/`Branch` (multi-level, not read in detail this pass) | `Campus` — `campus-service/campus/models.py:5-31`, FK'd directly to `Organization` (no intermediate level). |
| Primary key type | UUID everywhere (`models.UUIDField(primary_key=True, default=uuid.uuid4, ...)`, confirmed on `Tenant`/`Organization` at the lines above) | **Django default `AutoField`/`id` (sequential integer)** — `Organization` has no explicit PK field (Django default), `Campus.id = models.AutoField(primary_key=True)` (`campus-service/campus/models.py:27`). |

**Can SMS's `Organization` map to central auth's `Organization`? No — it
should map to `Tenant`.** Mapping by name (SMS `Organization` → central
`Organization`) would put billing/plan/subscription data on the wrong
model and, worse, leave every SMS org with no `Tenant` at all (central
auth's `Subscription` model attaches to `Tenant`, not `Organization` —
per Increment 0's settled design, referenced in this prompt's own
"Context" section). The safe mapping is almost certainly: **one new
central `Tenant` per SMS `Organization`**, with a new central
`Organization` (HR-structure root, currently a concept SMS doesn't
distinguish) created 1:1 underneath it — i.e. SMS's flat
`Organization → Campus` becomes central's `Tenant → Organization →
Institution/Branch (mapped from Campus)`.

**Conflicts / landmines, concretely**:
- **PK type mismatch**: every SMS `Organization`/`Campus`/`User` ID is a
  small sequential integer; central auth uses UUIDs throughout. A
  migration needs an explicit ID-mapping table (old int → new UUID) kept
  around at least through the transition, since `sync_staff_to_auth`
  already trusts these integers as stable cross-service identifiers
  (`org_data["id"]`, §3) — decoupling that assumption is itself a step.
- **Duplicate/diverged Organization schemas**: `org-service`'s own
  `users.Organization` fork (`org-service/users/models.py`) has fields
  `auth-service`'s copy doesn't (`Invoice` model — billing/receipts) and
  is missing fields `auth-service`'s copy has (`payment_status`,
  `student_id_pattern`) — confirmed by direct diff, not assumed. **Which
  one is authoritative for a given SMS org today is not determinable by
  reading code alone** — flagged as an open question (§8).
- **11 more physical copies** (§2a) of `Organization`, each in principle
  capable of drifting from either "source" the moment someone edits one
  copy and forgets the other 12.

---

## 6. Scattered `user.role` checks and username generation — inventory (scope only, not fixed)

| Service | `.role == '...'` count | Source |
|---|---|---|
| org-service | 58 | `grep -rn "\.role\s*==\s*['\"]" org-service --include="*.py"` (excl. migrations) |
| auth-service | 52 | same pattern |
| attendance-service | 8 | same |
| subject-service | 6 | same |
| staff-service | 5 | same |
| student-service | 5 | same |
| campus-service | 4 | same |
| content-service | 3 | same |
| notification-service | 2 | same |
| ai-service | 1 | same |
| fees-service, result-service, support-service, timetable-service | 0 each | same (no direct string comparisons found — likely rely on role-helper methods or view-level `IsAuthenticated` only) |
| **Total** | **144** | |

Additionally, **188** call sites use the role-helper *methods*
(`.is_superadmin()`, `.is_principal()`, `.is_teacher()`, `.is_coordinator()`,
`.is_admin()`, `.is_org_admin_role()`) rather than raw string comparison —
`grep -rn` count across the tree, excluding migrations. These are one level
more insulated (a method signature could theoretically be preserved even
if the underlying storage changes) but every one of them is currently
implemented as `return self.role == '...'` (`auth-service/users/models.py:158-186`;
the `ams_shared` stateless `_TokenUser` re-implements a *subset* of the
same methods independently at `ams-shared/ams_shared/jwt/validator.py:61-71`
— **two more places that would need to move together**, not just one).

**Username-prefix generation** depends on `User.role` inside `User.save()`
(`auth-service/users/models.py:188-220`, calling
`auth-service/utils/id_generator.py`'s `IDGenerator.generate_*_code()`
methods) for `superadmin`/`admin`/`org_admin` specifically; other roles get
their username set externally before creation (employee_code / student_id
— confirmed by `sync_staff_to_auth.py`'s `username=employee_code` at
`:175` and `backfill_student_auth_accounts.py`'s reliance on
`student.student_id`). 16 files reference `IDGenerator`/the code-generation
methods directly (listed in the raw grep during this analysis;
concentrated in `auth-service`, `org-service`, and the `services/`
copies in `staff-service`/`notification-service`).

**None of this was touched.** Per the rules, this section is inventory
only — the actual rewrite is scoped as its own increment.

---

## 7. Proposed migration order (small, reversible steps)

Given §1-6, the core problem isn't "add a `user_id` column" — it's "there
are 13 databases that each think they're authoritative for `users_user`,
kept in sync by hand." Any safe sequence has to shrink that surface before
touching identity itself.

**Step A — Freeze the drift, don't touch identity yet.**
Stop *new* divergence before migrating anything: decide (a decision, not a
code change) whether `org-service`'s forked `users` app or
`auth-service`'s is authoritative going forward, and stop editing the
other. This is prerequisite to everything else — moving users while two
schemas are still diverging under you is unsafe. **Can run immediately,
no dependencies.**

**Step B — Introduce `central_user_id` alongside the existing `User` FK
in each of the 3 identity-linked services (student/staff's
teacher+principal; coordinator's username-link), dual-run.**
Add a nullable UUID field next to each existing `user`
FK/username-convention, populated by whatever already calls
`/api/internal/create-user/`-equivalent once that endpoint is repointed at
central auth (or a shim in front of it) instead of (or in addition to)
SMS's own `auth-service`. Nothing reads the new field yet. **Depends on
Step A. Can run in parallel across student-service/staff-service once
central auth has an equivalent internal-create endpoint (does not exist
yet — net-new work, out of scope of this analysis).**

**Step C — Repoint the `ams_shared.jwt.validator` library at central-auth
JWKS (RS256), behind a flag, one service at a time.**
Because 12 services already share this one library (§4), this is the
highest-leverage single change — but "one library" doesn't mean "one
atomic deploy": each service still needs its own image rebuilt and
redeployed, and `role`-string claims must still be present in the new
token in the shape those 144+188 call sites expect (§6), or they need to
be rewritten *first*. Suggest doing this on the **lowest-blast-radius
service first** (e.g. `notification-service`, only 2 role-checks, no
direct `campus`/`students` FK duplication beyond `users`+`campus`) as a
canary before touching `staff-service`/`auth-service` itself. **Depends on
Step B existing so tokens can carry a real central identity. Serial across
services if `ams_shared` itself changes signature; the per-service
rebuild+redeploy can be parallelized once the library is stable.**

**Step D — Migrate identities, org-by-org, using the `central_user_id`
dual-run field from Step B to cut over reads.**
For each SMS `Organization`, create the corresponding central `Tenant` +
`Organization` (§5), map every `User`/`Student`/`Teacher`/`Principal`
row to a central identity, backfill `central_user_id`. **Must be serial
per-organization** (shared `User`/`Organization` tables mean two orgs'
migrations touching the same tables concurrently is a real risk), though
different organizations' migrations could in principle run in different
maintenance windows independently once the process is proven on one.

**Step E — Repoint services to read `central_user_id` instead of the
local `User` FK, one service at a time; drop the local `User` FK last, per
service, once nothing reads it.**
`Coordinator`'s username-convention link (§1) is the trickiest of these —
recommend converting it to a real FK *before* this step, not during,
since it currently has zero referential integrity to lose track of.

**Riskiest single step: Step D (the actual identity migration/merge),
specifically because of the `org-service` schema fork (§5).** Every other
step is additive (new field, new library behind a flag, new endpoint) and
individually reversible. Step D is the one place old data gets
interpreted and written into a new home — and it has to reconcile at
least two schemas (`auth-service` vs `org-service`) that have already
diverged in ways this analysis could not fully resolve by reading code
(§8). Get Step D's field-mapping decisions signed off explicitly before
writing any of it; don't let it be discovered mid-migration.

**What can run in parallel vs. must be serial**:
- Parallel: Step C's per-service rebuild/redeploy (once library is fixed); Step E's per-service repointing (once Step D is done for that org).
- Serial: A → B → C → D → E as phases; within Step D, per-organization migrations should not overlap; Step C's library change itself must land before any service's rebuild in that step.

---

## 8. Open questions / decisions needed

1. **Is `org-service`'s `users` fork or `auth-service`'s the authoritative
   one?** They have diverged (§5) — `org-service` has `Invoice`/billing,
   `auth-service` has `payment_status`/`student_id_pattern`. Reading code
   cannot answer which one reflects current real data; this needs someone
   who knows the deployment history.
2. **Do SMS `Organization` rows already correspond 1:1 to anything in
   central auth, or would every SMS org need a brand-new `Tenant`
   created from scratch?** (§5) — if there's already informal
   correspondence (e.g. IAK is already both an SMS org and a central-auth
   tenant under a different ID), that mapping needs to be given, not
   inferred.
3. **Is `sync_staff_to_auth` still run regularly, run once and forgotten,
   or effectively dead?** (§3) — it's a manual command with no scheduler
   found in this analysis. If nobody has run it recently, staff-service's
   local `users_user` and auth-service's may already have silently
   diverged (new hires, terminations, email changes since the last run).
4. **What happens to accounts still on the default password `"12345"`?**
   (§3) — `has_changed_default_password: False` is sent and presumably
   tracked, but this analysis did not verify that anything *enforces* a
   forced change on next login. If it's tracked-but-unenforced, that's a
   live security exposure independent of this migration, worth fixing on
   its own timeline regardless of when identity moves.
5. **Is the `INTERNAL_SERVICE_SECRET` default (`"change-this-secret"`,
   `docker-compose.yml:6`) actually overridden in every real deployment's
   `.env`, or does production trust a value that's sitting in the public
   repo?** (§3) — could not be determined from the compose file alone; a
   real `.env` was not found in this repo checkout to check against.
6. **Does `Coordinator`'s username-string link to `User` (§1) ever
   actually break in practice** (e.g. a coordinator's `employee_code`
   changed without the linked `User.username` being updated in lockstep)?
   Code shows both directions are updated in a few places
   (`coordinator/models.py:187-194`, `signals.py`) but not a DB constraint
   — worth a data audit (row count of coordinators whose `employee_code`
   has no matching `User.username`) before deciding whether to fix this
   before or during the identity migration.
7. **Should the migration target be "central auth becomes the only
   `users_user`" or "central auth becomes the source of truth, SMS
   services keep a local cache"?** Step E above assumes the former
   (drop local FKs). If SMS's operational load genuinely needs
   low-latency local reads of user data (unverified — not measured in
   this analysis), a cached/replicated approach changes the whole shape
   of Steps D/E.

---

## Summary printed to console (per the prompt)

**5 biggest risks:**
1. SMS doesn't have one `users` schema to migrate — it has ≥3 diverging
   copies (`auth-service`, `org-service`'s independent fork, and 11
   Dockerfile-duplicated builds each against their own DB). Migrating
   "the" `User` model requires first deciding which copy is real.
2. `org-service`'s `users.Organization`/`User` fork has genuinely
   different fields from `auth-service`'s (billing `Invoice` model exists
   only there; `payment_status`/`student_id_pattern` exist only in
   `auth-service`'s copy) — a silent, undocumented schema fork.
3. `Coordinator` has zero referential integrity to `User` — it's a
   string-equality convention (`employee_code == username`) that nothing
   in the database enforces.
4. SMS's `Organization` maps conceptually to central auth's `Tenant`, not
   central auth's `Organization` — a naive name-based mapping would
   misplace billing/subscription data and orphan every SMS org's
   `Subscription`.
5. All 14 services currently trust one shared HS256 secret (any of them
   could mint tokens for any other) with only auth-service itself doing a
   DB-backed revocation check (`token_version`) — the other 13 trust a
   token blindly for up to 24h even if revoked server-side.

**5 decisions needed from you:**
1. Which `users` schema (`auth-service`'s or `org-service`'s) is
   authoritative today?
2. Do any SMS `Organization` rows already correspond to existing central
   `Tenant`s, or does every one need a fresh `Tenant` created?
3. Is `sync_staff_to_auth` still actively run, or effectively abandoned?
4. Is the `"12345"` default-password path's "must change on first login"
   actually enforced anywhere, or just tracked?
5. Target end-state: central auth as the *only* place `User` data lives
   (SMS services always call out for it), or central auth as source of
   truth with a locally-cached copy per service?
