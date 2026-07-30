# Ticket Service — Central Auth Integration (Increment 2b)

Ticket-service (and its local `approvals` app) now verify central-auth
tokens **locally** via JWKS — no per-request HTTP call to auth-service —
gate on the `hdms` subscription, and enforce `hdms.*` permissions per
endpoint. Ticket data is filtered by the token's `tenant_id`. Verified live
against a running auth-service + ticket-service stack (commands below).

## Framework mismatch — flagged before proceeding, per the prompt's rule

VMS's `central_auth/` template is DRF-based (`authentication.py` subclasses
`rest_framework.authentication.BaseAuthentication`; `permissions.py`
subclasses `rest_framework.permissions.BasePermission`, wired in via DRF's
`permission_classes=[...]`). Ticket-service uses **Django Ninja**, which has
no `permission_classes` concept at all, and whose `Router(auth=...)` expects
a plain `callable(request)`, not DRF's `authenticate() -> (user, token)`
convention. This was flagged and confirmed with the user before building
(see chat) rather than silently improvised.

**What changed vs. copy-unchanged, and why:**
- `jwks.py`, `tenant.py` — **byte-identical copies**. Pure Django ORM /
  `requests` / `jwt`, nothing DRF- or Ninja-specific.
- `authentication.py` — `CentralAuthUser` and `CentralAuthAuthentication.
  authenticate()` (the actual JWKS-fetch/verify/claims-parse logic) are
  **unchanged**. Added one method: `__call__(self, request)`, which wraps
  `authenticate()` for Ninja's calling convention — following the *exact*
  existing local pattern already used by
  `hdms_core.authentication.RemoteJWTAuthentication.__call__` in this same
  codebase. Not a new idiom introduced by this work.
- `permissions.py` — **cannot be a copy**; DRF `BasePermission` classes have
  nothing to plug into in Ninja. Replaced with a decorator
  (`require_permission(codename)` / `require_service_subscribed`) that
  checks the exact same two methods VMS's classes call —
  `user.has_service()` / `user.has_perm()`, both plain Python methods on
  `CentralAuthUser`, not DRF-specific — and raises `ninja.errors.HttpError`
  instead of failing DRF's `has_permission()`. Enforcement order is
  identical: authenticated → service-subscribed → specific permission.

Net effect: **zero change to the actual verification/authorization logic**;
only the two files that *attach* that logic to a router differ, because
Ninja and DRF attach things differently. `SERVICE_CODE = 'hdms'` is the only
value that changed between VMS's copy and this one.

## What was built

### Step 1 — Local JWKS verification
- New `central_auth/` package (sibling of `apps/` and `core/` in
  ticket-service's `src/`) — see framework note above.
- `core/settings/base.py`: fixed `AUTH_SERVICE_URL`'s default from
  `http://auth_service:8000` to `http://auth-service:8000`. The underscore
  form is a valid Docker DNS alias but **fails Django's own `HTTP_HOST`
  validation on the auth-service side** (RFC 1034/1035 forbids underscores
  in hostnames) — every JWKS fetch 400'd with `DisallowedHost` until this
  was fixed. `auth-service` (hyphen) is the same container's other
  erp_network alias; this is the exact hostname VMS's Increment 1 already
  uses for the same reason.
- `requirements.txt`: added `PyJWT==2.9.0`, `djangorestframework==3.15.1`
  explicitly (both were already present transitively via
  `djangorestframework-simplejwt`, which this codebase already depends on
  and imports from — made explicit rather than relying on transitive
  resolution).
- **Verified live**: stopped the `auth_service` container entirely after
  one successful call (which cached the JWKS key), then called
  `GET /api/v1/tickets/` — still `200`. Restarted auth-service afterward.

### Step 2 — Service gate
- `require_service_subscribed` / the gate built into `require_permission`
  both check `user.has_service('hdms')` first — 403 if the tenant has no
  active `hdms` subscription (or the user is superadmin, which bypasses).

### Step 3 — Permission enforcement (endpoint → permission map)

**`apps/tickets/api.py`** (`/api/v1/tickets/*`):

| Endpoint | Permission | Fit |
|---|---|---|
| `POST /` (create) | `hdms.ticket.create` | clean |
| `GET /` (list) | `hdms.ticket.view_own` (baseline) | see note below |
| `GET /{id}` | `hdms.ticket.view_own` | clean |
| `PATCH /{id}` (generic update) | `hdms.ticket.create` | **no clean match** — catalog has no "edit" permission |
| `POST /{id}/status` (FSM transition) | per-action, see below | multi-action endpoint |
| `GET /{id}/sub-tickets` | `hdms.ticket.view_own` | clean |
| `POST /{id}/attachments` | `hdms.ticket.create` | clean-ish |
| `POST /{id}/assign` | `hdms.ticket.assign` | clean |
| `POST /{id}/reject` | `hdms.ticket.create` | **no clean match** |
| `POST /{id}/postpone` | `hdms.ticket.create` | **no clean match** |
| `PATCH /{id}/acknowledge` | `hdms.ticket.close` | **no clean match** — closest assignee-tier permission |
| `PATCH /{id}/progress` | `hdms.ticket.close` | **no clean match** — same reasoning |
| `PATCH /{id}/sla` | `hdms.ticket.assign` | **no clean match** — closest moderator-tier permission |
| `GET /{id}/history` | `hdms.ticket.view_own` | clean |
| `POST /{id}/confirm-review` | `hdms.ticket.assign` | clean-ish — docstring says "moderator review" |

`POST /{id}/status` action → permission (only `assign`/`close` have a
dedicated catalog permission; everything else falls back to
`hdms.ticket.create`):
```
STATUS_ACTION_PERMISSIONS = {'assign': 'hdms.ticket.assign', 'close': 'hdms.ticket.close'}
DEFAULT_STATUS_PERMISSION = 'hdms.ticket.create'  # submit/review/start_progress/resolve/reject/postpone/reopen
```

**`GET /` list_tickets — given real meaning, not just gated by name.** The
Increment-2a catalog has both `hdms.ticket.view_own` and
`hdms.ticket.view_all`; a flat gate (à la VMS's Increment 1, which didn't
implement row-level scoping) would make the distinction meaningless. Here:
callers with only `view_own` (Assignee, Requestor) get the queryset
restricted to `requestor_id=me OR assignee_id=me`; callers with
`view_all` (Admin, Moderator) see every ticket in their tenant. **Verified
live**: with the Assignee test user (create/view_own/close only),
`assign_ticket` correctly `403`'d with `"Missing required permission:
hdms.ticket.assign."`.

**`apps/approvals/api.py`** (`/api/v1/approvals/*`) — see "Discovered mid-build" below:

| Endpoint | Permission | Fit |
|---|---|---|
| `POST /` (create) | `hdms.ticket.create` | clean-ish |
| `GET /ticket/{id}` (list) | `hdms.ticket.view_own` | clean |
| `POST /{id}/decision` (approve/reject) | `hdms.ticket.assign` | **no clean match** — moderator-tier |

### Step 4 — Tenant filtering
- `apps/tickets/models/managers.py` (new, ticket-service-local, **not**
  part of the central_auth template): `TenantSoftDeleteQuerySet` combines
  `hdms_core.models.SoftDeleteQuerySet` (the shared soft-delete base every
  ticket model already used) with `central_auth.tenant.TenantQuerySet`.
  Needed because `Ticket`/`SubTicket`/`Attachment`/`Approval` all inherit
  `hdms_core.models.BaseModel`, whose `objects = SoftDeleteManager()`
  default-filters `is_deleted=False` — swapping in `TenantManager()` bare
  would have silently dropped that filtering (deleted rows reappearing).
  `TenantSoftDeleteManager.objects.for_tenant(x)` now does both.
- `tenant_id = UUIDField(null=True, blank=True, db_index=True)` added to
  `Ticket`, `SubTicket`, `Attachment` (`apps/tickets`) and `Approval`
  (`apps/approvals`). **Not** added to `AuditLog` (shared audit
  infrastructure, not a ticket-owned model — out of scope) or `Comment`
  (model exists but isn't wired into any live endpoint — dead code, not
  touched, see "What was NOT touched" below).
- Migrations: `apps/tickets/migrations/0008_attachment_tenant_id_subticket_tenant_id_and_more.py`,
  `apps/approvals/migrations/0002_approval_tenant_id.py`. No backfill —
  this is dev data only (confirmed: the DB had zero pre-existing rows
  before this session's own test tickets).
- Views read via `Model.objects.for_tenant(request.user.tenant_id)`
  instead of `.objects.all()/.filter()/.get()`, and stamp
  `tenant_id=request.user.tenant_id` on every `.objects.create(...)`.
- `get_ticket_history` had **no tenant (or even ticket-ownership) check at
  all** before this — any authenticated caller could read any ticket's
  audit history by ID. Fixed by resolving the ticket through the
  tenant-scoped manager first.
- **Verified live**: created a ticket with a real token → confirmed in
  Postgres `tenant_id` matches the token's `tenant_id`. Inserted a second
  ticket directly in the DB tagged with a different (fake) `tenant_id`,
  confirmed `Ticket.objects.for_tenant(real_tenant)` excludes it while
  including the real one — cleaned up the fake row afterward.

### Step 5 — Retired the old auth path
- `apps/tickets/api.py`: removed `RemoteJWTAuthentication` (was
  `router = Router(..., auth=RemoteJWTAuthentication())`) and the entire
  commented-out `# TODO: Re-enable user validation...` /
  `UserClient.validate_user_exists()` block — not disabled, deleted.
  Identity and permission now come from the token; there is no
  `UserClient` call anywhere in the live ticket request path anymore.
- **Discovered mid-build, fixed rather than left**: `apps/approvals/api.py`
  had its own separate Ninja router with **`auth=` unset entirely** — every
  approval endpoint was completely open, no authentication of any kind
  (worse than the ticket router's retired `RemoteJWTAuthentication`, which
  at least required *something*). `approvals` is a ticket-service-local
  Django app (`apps/approvals/`), not a separate microservice — in scope
  under "touch ONLY ticket-service" — so wired up with the same
  `CentralAuthAuthentication` + `require_permission(...)` pattern rather
  than flagged-and-left. **Verified live**: an unauthenticated
  `POST /api/v1/approvals/` now `401`s (was previously `200`, no check at
  all).
- **Incidental fix, forced by actually exercising the endpoint for the
  first time**: `ApprovalOut` schema typed `id`/`ticket_id`/`approver_id`
  as `str` while the model fields are UUID — Pydantic v2 doesn't
  auto-coerce UUID→str, so `.from_orm()` always 500'd. Pre-existing,
  unrelated to auth — it just never surfaced because this router had zero
  auth and (as far as could be determined) had never been successfully
  called end-to-end before. Fixed to match `TicketOut`'s already-correct
  `UUID` typing.

## What was NOT touched (dead code, not reachable from any live endpoint)

- `hdms_core` (the **shared** lib at `services/shared/hdms_core/`) —
  `RemoteJWTAuthentication` and `UserClient` still exist there unchanged.
  Touching it would affect communication-service and file-service too,
  explicitly out of scope. Ticket-service simply stopped importing/using
  them.
- `apps/tickets/services/ticket_service.py`, `apps/tickets/selectors.py`,
  `apps/approvals/services.py` — all call `UserClient.validate_user(...)`
  (either `hdms_core`'s or a local `core/clients/user_client.py` copy),
  but **none of these files are imported by `api.py` or `core/routers.py`**
  — confirmed via grep, they're unreferenced by any live request path. Not
  rewired; if one of these is ever wired up, it needs the same treatment
  (permission from the token, not a `UserClient` call).
- `Comment` model (`apps/tickets/models/comment.py`) — exists, has no
  `tenant_id`, but has no API endpoint anywhere either. Not touched.
- `AuditLog` (`apps/audit/`) — shared audit infrastructure, not
  tenant-tagged; tenant isolation for it is enforced indirectly (via the
  ticket lookup in `get_ticket_history`, see Step 4).

## Reused vs changed vs removed

| | |
|---|---|
| **Reused unchanged** | `central_auth/jwks.py`, `central_auth/tenant.py`, `CentralAuthUser` + `authenticate()` in `authentication.py` (VMS's exact logic) |
| **Adapted (framework-forced)** | `authentication.py` (`__call__` adapter added), `permissions.py` (decorator instead of DRF classes) |
| **New (ticket-service-local, not template)** | `apps/tickets/models/managers.py` (soft-delete + tenant composition) |
| **Extended** | `apps/tickets/api.py`, `apps/approvals/api.py`, 4 models (+tenant_id), `core/settings/base.py` (AUTH_SERVICE_URL fix) |
| **Fixed (pre-existing, unrelated)** | `ApprovalOut` schema UUID typing |
| **Removed** | `RemoteJWTAuthentication` + commented-out `UserClient` block from the tickets router; the approvals router's total lack of auth |

## How to run / test

```bash
# From Enterprise-Resource-Planning/Help-Desk-Management-System-main/
# (auth-service must already be up with Increment 2a's HDMS seed data)
docker compose build ticket-service
docker compose up -d ticket-service

# Get a token (Increment 2a's HDMS Assignee test user)
curl -s -X POST http://localhost:8000/api/auth/login-hdms \
  -H "Content-Type: application/json" \
  -d '{"employee_code":"VMST-B1-G-26-H-0002","password":"HdmsUser@123"}'
# copy access_token -> TOKEN, then (ticket-service has no host port mapped,
# so exec into the container or hit it from another erp_network container):

# (a) valid token succeeds, verified locally
curl -s http://localhost:8002/api/v1/tickets/ -H "Authorization: Bearer $TOKEN"

# (b) missing permission -> 403 (Assignee has no hdms.ticket.assign)
curl -s -X POST http://localhost:8002/api/v1/tickets/<id>/assign \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"assignee_id":"<uuid>"}'
# -> {"detail": "Missing required permission: hdms.ticket.assign."}

# (c) tenant filtering — insert a ticket tagged with a different tenant_id
# directly in the DB and confirm Ticket.objects.for_tenant(real_tenant)
# excludes it (shown via manage.py shell in this session).
```

Local-verification proof: stop the `auth_service` container entirely, then
repeat (a) — still `200`, because the JWKS public key was already cached.
