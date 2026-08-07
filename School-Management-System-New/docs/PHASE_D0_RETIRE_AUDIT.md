# Phase D0: Deep Audit Before Retiring the Old Auth Machinery

ANALYSIS ONLY. Nothing in this repository was changed, disabled, or
deleted to produce this document — every claim below cites `file:line`
from the code as it stands. Read `School-Management-System-New/` (the 13
SMS microservices + shared infra) and cross-referenced the frontend,
`nginx/nginx.conf`, and `docker-compose.yml`. Did **not** find
`SMS_PHASE_D_RETIRE_OLD_AUTH_PLAN.md` anywhere in this environment (see
"Open questions," item 1) — searched the repo, `docs/`, and
`/home/rahat/Documents/ALL_Plans/` (which holds every other phase's
`_PLAN.md`, confirming that's the right location and that this one
specifically is missing). The removal order below is therefore derived
directly from the code, not reconciled against a prior plan.

## 1. The headline answer: is anything still ISSUING HS256 tokens?

**Yes — two live issuers, and one of them is the production login path
for the entire SMS frontend today.**

| Issuer | `file:line` | Reachable how | Live? |
|---|---|---|---|
| `auth-service` `UserLoginView.post()` | `microservices/auth-service/users/views.py:167` (`refresh = RefreshToken.for_user(user)`) | nginx `location = /api/auth/login/` → `auth-service:8001` (`nginx/nginx.conf:125-131`, dedicated `login_limit` rate-limit zone) ← frontend `loginWithEmailPassword()` (`frontend/src/lib/api.ts:307-330`, hits `API_ENDPOINTS.AUTH_LOGIN` = `/api/auth/login/`, `frontend/src/lib/api.ts:44`) | **YES — this is THE login flow every SMS user goes through today.** `frontend/src/app/login/page.tsx:722` calls it directly. |
| `auth-service` `TokenRefreshView` (SimpleJWT built-in, re-signs a new access token from a refresh token — also HS256, same secret) | mounted at `microservices/auth-service/users/urls.py:48` (`path('auth/refresh/', TokenRefreshView.as_view())`) | nginx `location /api/auth/` prefix → `auth-service:8001` (`nginx/nginx.conf:133-137`) ← frontend's silent-refresh call, `frontend/src/lib/api.ts:263` (`API_ENDPOINTS.AUTH_REFRESH`, `api.ts:45`) | **YES** — fires whenever a stored access token is close to expiry. |
| `org-service` `UserLoginView.post()` | `microservices/org-service/users/views.py:194` (`refresh = RefreshToken.for_user(user)`) | org-service's own `/api/auth/login/` (`org-service/users/urls.py:46`) — **not** proxied by nginx (nginx only routes `/api/organizations/`, `/api/invoices/`, `/org-media/` to org-service, `nginx/nginx.conf:220-237`); org-service:8002 is published to the host directly (`docker-compose.yml:345-346: "8002:8002"`) but no code in this repo (frontend, any service, any script) calls it | **Dead-in-practice.** Present, functional, unused by anything found — only reachable by someone manually hitting port 8002. Confirm with the human whether an external client does this (see "Open questions"). |

No raw `jwt.encode(...)` calls exist anywhere in `microservices/` — every
HS256 mint goes through `rest_framework_simplejwt`'s `RefreshToken.for_user()`
(confirmed by grepping the whole tree for `jwt.encode`, `RefreshToken.for_user`,
`AccessToken.for_user`, `RefreshToken(`, `AccessToken(`; the only other
hits are two commented-out refresh-token-*consuming* lines,
`org-service/users/views.py:519,835` and `auth-service/users/views.py:527,1002`
— dead code, `#`-prefixed).

**Consequence: HS256 request-auth (Piece 3) cannot be removed while
`auth-service`'s login/refresh views are the frontend's only way to
authenticate.** This is not a "some script still issues tokens" caveat —
it's the literal front door.

## 2. Piece 1 — SMS auth-8001

**Defined**: `docker-compose.yml:304-329` — service `auth-service`,
container `ams_auth`, image built from `microservices/auth-service/Dockerfile`,
port `8001`, DB `postgres-auth`/`auth_db` (`docker-compose.yml:78-92`).

**Currently running?** No — `docker compose ps -a` shows no `ams_auth`
container exists in this session (never started); only its database
container `postgres-auth` is up (brought up as a dependency of something
else, or leftover from earlier phase work — its own app was never
booted). This is a fact about *this dev environment right now*, not
evidence the service is unused in a real deployment — nginx and the
frontend are unambiguously wired to it (section 1).

**Endpoints** (`microservices/auth-service/users/urls.py:40-97`), and
whether nginx exposes each:

| Endpoint | nginx route | Caller(s) |
|---|---|---|
| `auth/login/` | `= /api/auth/login/` (exact) | Frontend — production login (section 1) |
| `auth/register/` | none found | — |
| `auth/refresh/` | `/api/auth/` (prefix) | Frontend silent refresh (section 1) |
| `profile/`, `users/*`, `permissions/*`, `current-user/`, `version/*`, `sidebar-badges/` | each has its own `nginx.conf` block (lines 143-173) | Frontend, general user/session management |
| `first-login-change-password/`, `check-password-change-required/`, `send-password-change-otp/`, `verify-password-change-otp/`, `change-password-with-otp/`, `send-forgot-password-otp/`, `verify-forgot-password-otp/`, `reset-password-with-otp/`, `student-direct-change-password/` | each proxied (`nginx.conf:174-218`) | Frontend password-reset/first-login flows — all operate on `auth-service`'s own local `User.password`, unrelated to central-auth |
| `internal/create-user/`, `internal/sync-org/` | **not** proxied by nginx (internal-only, `X-Internal-Secret`-gated) | See table below — live callers from org-service and staff-service/student-service |
| `organizations/*`, `plans/*` | **not** the ones nginx uses — nginx sends `/api/organizations/` and `/api/plans/` to **org-service:8002** instead (`nginx.conf:138-142,221-225`) | auth-service's own copies of these views (`OrganizationListCreateView` etc., `users/urls.py:42-43,90-92`) are **dead-in-practice** via the public gateway — org-service is the live target for organization management, matching Phase C11's own scope |

**Direct DB reads of `auth_db` bypassing HTTP** — yes, found two, both in
`attendance-service`:
- `microservices/attendance-service/attendance/management/commands/sync_master_data.py:305-311`
  (`_auth_conn()`, used by `sync_staff_users()`) — pulls staff `User` rows
  from `auth_db` into attendance-service's own local `users_user` table.
  Runs on **every container start** (`microservices/attendance-service/entrypoint.sh:6`,
  `python manage.py sync_master_data || true` — best-effort, doesn't
  block startup).
- `microservices/attendance-service/attendance/permissions.py:47-66`
  (inside a DRF `has_permission()` — a **live, per-request** dependency)
  — opens a fresh `psycopg2` connection straight to `postgres-auth` on
  *every* attendance-viewing request from a non-master-role user, to
  check a `users_role_permission` row for `view_attendance`. The code's
  own comment explains why: "RolePermission rows live in auth_db and are
  NOT synced here." **Fails closed** (denies access) if the connection
  fails — so this isn't just stale-data risk, it's a hard live
  dependency: tearing down `postgres-auth` (not just the `auth-service`
  app container) would make attendance viewing return 403 for everyone
  outside `MASTER_ROLES`.

**Does anything still LOG IN against auth-8001?** **Yes — confirmed in
section 1. This is the key finding: auth-8001 cannot be retired (as a
running service, and definitely not as a database) until the frontend's
login flow is repointed to central auth's own login endpoint, and
`postgres-auth` is either kept alive read-only for attendance-service or
attendance-service's `permissions.py:47-66` check is rebuilt against
central auth / a locally-synced table.**

## 3. Piece 2 — `sync_staff_to_auth` / `create-user` / `sync-org`

**`/api/internal/create-user/`** (received at `microservices/auth-service/users/views.py:2490-2506`,
`X-Internal-Secret`-gated) — callers:

| Caller | `file:line` | Live or dead |
|---|---|---|
| `OrganizationCreateSerializer.create()` | `microservices/org-service/users/serializers.py:154-172` | **LIVE** — fires on every `POST /api/organizations/` (new org + its first org_admin). **This is the one that matters most**: it's how a brand-new org_admin's auth-8001 login credential gets provisioned at all. Phase C11 (this repo's own earlier work) did **not** add an equivalent central-auth write here — a new org today only gets a login in auth-8001. |
| `UserCreationService._sync_user_to_auth()` | `microservices/staff-service/services/user_creation_service.py:150-183`, called from `create_user_from_entity()` at line 122 | **LIVE** — `create_user_from_entity` is called from `teachers/signals.py`'s `create_teacher_user` post_save signal (fires on every Teacher/Principal/Coordinator creation) |
| `sync_staff_to_auth` management command | `microservices/staff-service/teachers/management/commands/sync_staff_to_auth.py` (`_sync_to_auth`, line 16) | **Dead/on-demand** — manual batch-backfill tool, not wired to any cron or entrypoint |
| `_ensure_student_user_account` (ViewSet method) | `microservices/student-service/students/views.py:748,751,801` | **LIVE** — called from the student ViewSet's create/update path, but **only on the legacy (non-central-auth) branch**; explicitly skipped for a central-auth-created student with a comment flagging that gap (`students/views.py:706-719`, this repo's own Phase C8 finding) |
| `_ensure_student_user_account` (module function, same name, different file — CSV import) | `microservices/student-service/students/services/student_csv_import.py:513,549` | **LIVE** during CSV bulk-import, plus a dedicated backfill command `backfill_student_auth_accounts.py:27,48` |

**`/api/internal/sync-org/`** (received at `microservices/auth-service/users/views.py:2460-2467`) — callers:

| Caller | `file:line` | Live or dead |
|---|---|---|
| `OrganizationListCreateView.create()` | `microservices/org-service/users/views.py:1656-1673` | **LIVE** — every org creation |
| `OrganizationDetailView.perform_update()` | `microservices/org-service/users/views.py:1719-1737` | **LIVE** — every `is_active`/`name` change on an org |
| `invoice_approve` | `microservices/org-service/users/views.py:2517-2530` | **LIVE** — every invoice approval (activates the org) |
| `mark_overdue_invoices` (management command) | `microservices/org-service/users/management/commands/mark_overdue_invoices.py:35` | **LIVE, recurring** — run hourly by the `org-cron` container (`docker-compose.yml:364-386`, `cron-entrypoint.sh`) |
| `generate_recurring_invoices` (management command) | `microservices/org-service/users/management/commands/generate_recurring_invoices.py:92` | **LIVE, recurring** — run daily at 00:xx UTC by `org-cron` |

**Is B4's central-auth write solid and independent enough that the
auth-8001 write can be dropped without losing staff creation? No —
not as currently configured.** `create_user_from_entity()`
(`microservices/staff-service/services/user_creation_service.py:83-148`)
does the auth-8001 write **unconditionally** (line 122), then the
central-auth write (line 124-130, delegating to
`sync_staff_entity_to_central_auth`) — but that central write is gated
behind `SYNC_TO_CENTRAL_AUTH`, which defaults to **`false`**
(`docker-compose.yml`, staff-service block: `SYNC_TO_CENTRAL_AUTH: ${SYNC_TO_CENTRAL_AUTH:-false}`,
confirmed live during this repo's own Phase C12 work). **If the
auth-8001 write is dropped while `SYNC_TO_CENTRAL_AUTH` is still off in
whatever environment this runs in, new staff are created nowhere
central at all** — a silent hole, not a loud failure. Before Piece 2 can
be dropped: confirm `SYNC_TO_CENTRAL_AUTH=true` is actually set (and the
sync is actually succeeding, not silently 401/500ing — `sync_staff_to_central_auth`
swallows failures and returns `(False, message)`, logged but not
alerted on) in every environment that matters.

**Students have no equivalent dual-write at all.** Unlike staff (B4),
there is no `SYNC_TO_CENTRAL_AUTH`-style flag or central-auth call
anywhere in the student-creation path for the legacy branch — new
students only ever get an auth-8001 account. The central-auth branch
(`students/views.py:696-721`) explicitly does **not** create a login and
says so in its own comment. **Before auth-8001 can be retired, new
central-auth students need a working login path that doesn't exist in
this codebase yet** — this is a bigger gap than staff's (which is "flip
a flag"); this one needs actual new code.

## 4. The event-system finding — NOT coupled to the shared secret

Every `consume_events.py` (found in `result-service`, `campus-service`,
`fees-service`, `auth-service`, `staff-service`, `student-service`,
`attendance-service`, `support-service`, `timetable-service`) delegates
to `ams_shared.events.consumer.start_consumer()`
(`microservices/ams-shared/ams_shared/events/consumer.py`) and
`ams_shared.events.publisher.publish_event()`
(`microservices/ams-shared/ams_shared/events/publisher.py`). Both connect
to **RabbitMQ** via `pika`, authenticated with `RABBITMQ_URL`
(`amqp://${RABBITMQ_USER:-guest}:${RABBITMQ_PASS:-guest}@rabbitmq:5672/`,
`docker-compose.yml:7,41-42`) — RabbitMQ's own AMQP credentials, entirely
separate from `AUTH_SECRET_KEY`/the HS256 JWT scheme. Grepped both files
and two representative `consume_events.py` handlers
(`staff-service/teachers/management/commands/consume_events.py`,
`student-service/students/management/commands/consume_events.py`) for
`JWT`/`SECRET`/`token` — the only "token" references are Python
`contextvars.ContextVar.set()`/`.reset()` tokens (an unrelated stdlib
concept used to restore the org-scoping thread-local inside the handler
via a `_SuperuserContext()` stand-in), not JWTs.

**Conclusion: removing the shared HS256 secret/scheme will not break the
event bus.** This directly answers (and closes) the prompt's own
hypothesis that this "must be untangled first (Phase D3)" — no
untangling is needed here; the event system was never coupled to HS256
in the first place.

## 5. Inter-service & cron findings

**Inter-service calls**: grepped the whole tree for an outbound call
setting `Authorization: Bearer <token>` (i.e., a service forwarding a
user's or its own JWT to another service) — **zero matches**. Every
service-to-service HTTP call found (org-service ↔ auth-service,
staff-service/student-service → auth-service, timetable-service's
`sync-teachers` endpoint, etc.) uses the `X-Internal-Secret` header
checked against `INTERNAL_SERVICE_SECRET` (32 files reference this env
var) — a static shared secret, structurally unrelated to the per-user
HS256 JWT scheme (different env var, different verification code, no
`jwt.decode` involved at all on the receiving end for these). **No
inter-service caller needs to move to RS256** — this mechanism doesn't
touch HS256 and isn't affected by its removal.

**Cron / scheduled jobs**: the only dedicated cron container in
`docker-compose.yml` is `org-cron` (lines 364-386,
`microservices/org-service/cron-entrypoint.sh`) — runs
`mark_overdue_invoices` hourly and `generate_recurring_invoices` daily,
**both of which call auth-8001's `/api/internal/sync-org/`** (section 3
table). No `celery`/`celery beat` anywhere (grepped, zero hits). The
`attendance-foxface-sync` container (`docker-compose.yml:566-580`,
`foxface-sync-entrypoint.sh`) polls a biometric device platform on a
loop — unrelated to auth-8001/HS256, confirmed by reading it in full.
`consume_events` loops (started via `&` in several `entrypoint.sh`
files, e.g. `attendance-service/entrypoint.sh:7`) run continuously but,
per section 4, have no HS256/auth-8001 coupling.

## 6. Verifier census (expected — this is what dual-run means; listed so D4 knows what it will touch)

Every one of the 13 SMS services' `DEFAULT_AUTHENTICATION_CLASSES`
points at its own `<app>.dual_auth.DualAuthentication`
(`content-service/content_service/settings.py`, `fees-service/fees_service/settings.py`,
`result-service/result_service/settings.py`, `subject-service/subject_service/settings.py`,
`campus-service/campus_service/settings.py`, `support-service/support_service/settings.py`,
`notification-service/notification_service/settings.py`, `student-service/student_service/settings.py`,
`timetable-service/timetable_service/settings.py`, `org-service/org_service/settings.py`,
`staff-service/staff_service/settings.py`, `ai-service/ai_service/settings.py`,
`attendance-service/attendance_service/settings.py` — one grep, 13/13
hits, confirmed dual-run everywhere per this repo's own Phase C1-C13
work). Each `dual_auth.py` routes HS256 → `ams_shared.jwt.validator.ServiceJWTAuthentication`
(or, for `ai-service` specifically, `rest_framework_simplejwt.authentication.JWTStatelessUserAuthentication`
— a different library, same underlying `AUTH_SECRET_KEY`/HS256 scheme,
see `ai-service/ai_service/dual_auth.py`'s own docstring) and RS256 →
`central_auth.authentication.CentralAuthAuthentication`. Two services
additionally instantiate `ServiceJWTAuthentication` directly inside a
manual-authentication middleware fallback (not just the dual_auth router):
`org-service/users/middleware.py` and `staff-service/users_override/middleware.py`
(a build-time override of the same vendored file) — both populate a
thread-local org-scoping context before DRF's own auth chain runs;
`campus-service/campus_service/dual_auth.py` and the rest follow the
same router-only shape. `auth-service` itself uses neither dual_auth nor
central_auth — it's legacy-only (`TokenVersionJWTAuthentication`,
`auth-service/auth_service/settings.py:84-86`), which is expected since
it's the piece being retired, not repointed.

**Secondary note on `SECRET_KEY`**: `AUTH_SECRET_KEY` doubles as both
the JWT `SIGNING_KEY` *and* Django's own `SECRET_KEY` (session/CSRF
signing) in every service — confirmed via `SECRET_KEY: ${AUTH_SECRET_KEY:-auth-secret-change-me}`
appearing in the `x-common-env` block every service inherits
(`docker-compose.yml:8`). Retiring HS256 *JWT verification* does not
mean this env var can disappear — Django needs *some* `SECRET_KEY`
value regardless; it would just stop needing to be the *same* value
shared across every service.

## 7. Classification: live-and-needed vs dead-safe-to-remove-early vs unclear

**(a) Live, blocks its piece's retirement:**
- `auth-service` login + refresh views (blocks Piece 3, and Piece 1 as a
  running service) — section 1.
- `internal/create-user/`, `internal/sync-org/` and every caller in
  section 3's tables (blocks Piece 1 and Piece 2).
- `attendance-service`'s two direct `auth_db` reads (blocks Piece 1's
  *database*, specifically) — section 2.
- `org-cron`'s two commands (blocks Piece 1, recurring).

**(b) Dead / safe to remove early, once confirmed with the human:**
- `org-service`'s own `UserLoginView`/`auth/register/`/`organizations/`
  views at `org-service/users/urls.py:42-43,46-47,90-92` — not reachable
  via nginx, no caller found in-repo. Removing these (or just leaving
  them, since they cost nothing running) doesn't block anything either
  way.
- The two commented-out `RefreshToken(refresh_token)` blocks
  (`org-service/users/views.py:519,835`, `auth-service/users/views.py:527,1002`)
  — already dead, `#`-prefixed, not participating in anything.
- `staff-service/teachers/management/commands/sync_staff_to_auth.py` and
  `student-service/students/management/commands/backfill_student_auth_accounts.py`
  — on-demand backfill tools, not part of any live path; useful to keep
  *available* until Piece 1/2 are actually gone (in case a last backfill
  is needed), then safe to delete.

**(c) Unclear / needs a human:**
- Whether anything **outside this repo** (a mobile app, a partner
  integration, a support script) calls `auth-service:8001` or
  `org-service:8002` directly, bypassing nginx and the frontend. Code
  alone can't answer this.
- Whether `SYNC_TO_CENTRAL_AUTH` is actually `true` in any real
  deployment right now, or only ever tested as `true` transiently during
  this repo's own Phase C12 proof (which explicitly reverted it to
  `false` afterward, per that phase's own result doc).

## 8. Proven-safe removal order

`SMS_PHASE_D_RETIRE_OLD_AUTH_PLAN.md` was not found (see "Open
questions," item 1), so the order below is built from scratch against
what section 1-7 actually show, not adjusted against a prior draft.

1. **D1 — close the student login gap (new code, not a removal).**
   Give newly-created central-auth students a working login path (either
   a live `NonStaffIdentity`-creation call from `students/views.py`'s
   central-auth branch, mirroring B4's staff pattern, or an equivalent).
   Blocks nothing upstream by itself, but Piece 1/D5 cannot safely
   proceed without it (section 3).
2. **D2 — turn `SYNC_TO_CENTRAL_AUTH` on and verify it, for real, in
   whatever environment matters.** Confirm staff creation actually lands
   in central auth (not just that the flag exists) before touching the
   auth-8001 write in `user_creation_service.py:122`.
3. **D3 — repoint the frontend's login + refresh flow to central auth,
   and repoint org-service's org-admin-account provisioning
   (`OrganizationCreateSerializer.create()`) off `/api/internal/create-user/`
   onto an equivalent central-auth call.** This is the actual gate for
   everything else — until this ships, auth-8001 is the front door and
   nothing past this point is safe. (The event-system concern the
   original prompt raised, section 4, is **not** a blocker here —
   confirmed independent.)
4. **D4 — rebuild `attendance-service/attendance/permissions.py:47-66`'s
   `view_attendance` check against something other than a live
   `postgres-auth` connection** (a locally-synced table, or a central-auth
   permission check) — this is the one piece that reads `auth_db`
   directly and fails closed, so it must stop doing that before
   `postgres-auth` can go away, independent of whether the
   `auth-service` *app* is already stopped.
5. **D5 — stop the `auth-service` app container and remove the `org-cron`
   calls to `/api/internal/sync-org/`** (or repoint them to whatever
   central-auth's own org-sync equivalent turns out to be) — safe only
   after D1-D4. Decommission `postgres-auth` last, only after D4 confirms
   nothing reads it directly anymore.
6. **Not a numbered step, do anytime — dead-code cleanup (section 7b)**:
   org-service's own unused login/register/org views, the two
   commented-out blocks, and (once D1-D5 are fully done) the two
   on-demand backfill commands. None of these block or are blocked by
   anything else.
7. **Do NOT delete `microservices/auth-service/` as a directory at any
   point in D1-D5** — see "Open questions," item 2. Its `users/`,
   `services/`, `utils/` subtrees are vendored via `COPY` at Docker
   **build time** into 11 of the other 12 services' Dockerfiles
   (`campus-service`, `staff-service`, `timetable-service`, `student-service`,
   `result-service`, `fees-service`, `subject-service`, `content-service`,
   `support-service`, `notification-service`, `attendance-service` —
   confirmed by grepping every `Dockerfile` for `COPY.*auth-service`;
   `org-service` vendors only `services/`+`utils/`, has its own
   independent `users/`; `ai-service` vendors nothing). Retiring the
   *running* `auth-service` container (D5) does not retire this
   *source-code* dependency — that would need each of those 11
   Dockerfiles rewritten to stop copying from it (e.g., by promoting
   `users/`/`services/`/`utils/` into `ams-shared`, which is already a
   proper installable package and the obvious place for this), which is
   a separate, much larger refactor not implied by anything in D1-D5.

## Open questions for the human

1. **`SMS_PHASE_D_RETIRE_OLD_AUTH_PLAN.md` does not exist anywhere in
   this environment** — not in this repo's `docs/`, not in
   `/home/rahat/Documents/ALL_Plans/` (which holds the analogous `_PLAN.md`
   for every other lettered phase, A through C). If it exists somewhere
   else, point me at it and I'll reconcile section 8 against it; if it
   was never written, section 8 is the first draft of it, not a
   verification of one.
2. Is there any external client (mobile app, partner integration,
   internal support script) that calls `auth-service:8001` or
   `org-service:8002` directly, bypassing nginx? Code in this repo can't
   see outside itself.
3. Is `SYNC_TO_CENTRAL_AUTH=true` set anywhere real today, or has it
   only ever been flipped on transiently for testing (as in this repo's
   own Phase C12 proof)?
4. Confirm the intended target for D3's frontend-login repoint: does
   central auth (`Enterprise-Resource-Planning/Auth-service-main`)
   already expose a login endpoint shaped correctly for the SMS
   frontend to call directly (returning the same `access`/`refresh`/`user`/`organization`
   shape `loginWithEmailPassword()` currently expects), or does that
   endpoint still need to be built?
5. Confirm whether promoting `users/`/`services/`/`utils/` out of
   `microservices/auth-service/` and into `ams-shared` (so the 11
   vendoring services stop depending on `auth-service`'s source tree at
   all — item 7 above) is in scope for a later D-phase, or intentionally
   out of scope indefinitely.
