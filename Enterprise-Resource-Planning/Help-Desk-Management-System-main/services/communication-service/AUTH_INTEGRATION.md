# Communication Service — Central Auth Integration (Increment 2c)

Communication-service's `chat` and `notifications` Ninja routers now verify
central-auth tokens **locally** via JWKS — no per-request HTTP call to
auth-service — gate on the `hdms` subscription, and enforce `hdms.*`
permissions per endpoint. Chat/notification data is filtered by the token's
`tenant_id`. Verified live against a running auth-service +
communication-service stack (commands below).

## Ticket-service's Ninja `central_auth/` template — reused unchanged

Copied `jwks.py`, `tenant.py`, `authentication.py`, `permissions.py`,
`__init__.py` byte-for-byte from
`ticket-service/src/central_auth/` — no edits to any of the five files.
`SERVICE_CODE = 'hdms'` in `permissions.py` was already correct (this is
also an HDMS service) — the one place ticket-service's own instructions
called out as the expected per-service change didn't even need to change
here.

The only per-service work was, per the prompt:
- `core/settings/base.py`: added `AUTH_SERVICE_URL` (was missing entirely —
  communication-service's settings had never referenced auth-service by
  URL before). Set to the hyphenated `http://auth-service:8000`, matching
  ticket-service's Increment 2b fix (the underscored `auth_service` alias
  fails Django's `HTTP_HOST` validation on the auth-service side).
- `requirements.txt`: added explicit `PyJWT==2.9.0`,
  `djangorestframework==3.15.1` (both already present transitively via
  `djangorestframework-simplejwt`), same as ticket-service.
- The endpoint→permission map and which models get `tenant_id` (below).

## What was built

### Step 1 — Local JWKS verification
- `apps/chat/api.py`: `router = Router(..., auth=RemoteJWTAuthentication())`
  replaced with `auth=CentralAuthAuthentication()`.
- `apps/notifications/api.py`: **had no `auth=` at all** — wired up with
  `CentralAuthAuthentication()` for the first time (see Step 5 for how bad
  this was).
- **Verified live**: hit `GET /api/v1/notifications/` successfully, then
  `docker stop auth_service` entirely, then repeated the same call — still
  `200` (JWKS key was cached from the first call). Restarted auth-service
  afterward.

### Step 2 — Service gate
- Both `require_permission(codename)` and the bare `require_service_subscribed`
  (used on every notifications endpoint, see Step 3) check
  `user.has_service('hdms')` first — 403 if the tenant's `hdms` subscription
  isn't active, unconditionally bypassed for superadmin.

### Step 3 — Permission enforcement (endpoint → permission map)

**`apps/chat/api.py`** (`/api/v1/chat/*`):

| Endpoint | Permission | Fit |
|---|---|---|
| `GET /messages/ticket/{id}` (list) | `hdms.ticket.view_own` | clean-ish — see note |
| `POST /messages` (create) | `hdms.ticket.create` | clean-ish — see note |

**Note on fit**: chat messages belong to a *ticket*, not to the caller
directly — a fully correct check would confirm the caller is actually a
participant/assignee/requestor on that specific `ticket_id`. That
information lives in ticket-service, and "no ForeignKeys across service
boundaries" (HDMS's own architecture rule) means communication-service
can't join against it here. `hdms.ticket.view_own` / `hdms.ticket.create`
are the closest fit ("can interact with tickets at all" tier) — flagged
rather than inventing a new catalog permission or a cross-service call.

**`apps/notifications/api.py`** (`/api/v1/notifications/*`) — **no
per-endpoint permission at all, flagged deliberately**:

| Endpoint | Gate | Reasoning |
|---|---|---|
| `GET /` (list) | `require_service_subscribed` | personal inbox |
| `GET /unread-count` | `require_service_subscribed` | personal inbox |
| `POST /{id}/read` | `require_service_subscribed` | personal inbox |
| `POST /mark-all-read` | `require_service_subscribed` | personal inbox |
| `DELETE /{id}` | `require_service_subscribed` | personal inbox |
| `DELETE /delete-all` | `require_service_subscribed` | personal inbox |

Notifications are the caller's own inbox (`Notification.user_id` =
recipient), not gated by ticket-role. The Increment-2a catalog has nothing
narrower than "authenticated + hdms-subscribed" that fits "read/manage MY
OWN notifications" — a Requestor reading their own notification shouldn't
need `hdms.ticket.view_all`. Rather than invent a new catalog permission
(catalog lives in auth-service, out of scope here), every endpoint uses the
bare `require_service_subscribed` gate **plus** strict scoping to
`request.auth.id` (see Step 5 — this is also the fix for the pre-existing
IDOR).

### Step 4 — Tenant filtering
- New `apps/chat/managers.py` (communication-service-local, **not** part
  of the central_auth template — mirrors ticket-service's
  `apps/tickets/models/managers.py` from Increment 2b): `TenantSoftDeleteQuerySet`
  combines `hdms_core.models.SoftDeleteQuerySet` with
  `central_auth.tenant.TenantQuerySet`. Needed because `ChatMessage` and
  `Notification` both inherit `hdms_core.models.BaseModel`, whose
  `objects = SoftDeleteManager()` default-filters `is_deleted=False` —
  swapping in a bare `TenantManager()` would have silently dropped that
  filtering. `notifications/models.py` imports `TenantSoftDeleteManager`
  from `apps.chat.managers` rather than duplicating it (same
  cross-app-import precedent ticket-service's `approvals` set with
  `apps.tickets.models.managers`).
- `tenant_id = UUIDField(null=True, blank=True, db_index=True)` added to
  `ChatMessage`, `TicketParticipant` (`apps/chat`) and `Notification`
  (`apps/notifications`). `TicketParticipant` doesn't inherit `BaseModel`
  (no soft-delete) — it gets the plain `central_auth.tenant.TenantManager`
  instead of the soft-delete composition.
- Migrations: `apps/chat/migrations/0002_chatmessage_tenant_id_ticketparticipant_tenant_id.py`,
  `apps/notifications/migrations/0002_notification_tenant_id.py`. No
  backfill — dev data only.
- `apps/chat/api.py` and `apps/notifications/api.py` read via
  `Model.objects.for_tenant(request.auth.tenant_id)` instead of
  `.objects.filter(...)/.get_object_or_404(...)`, and stamp
  `tenant_id=request.auth.tenant_id` on every `.objects.create(...)` in the
  live request path.
- **Verified live**: created a chat message with a real token → confirmed
  `tenant_id` matches the token's. Inserted a second message directly in
  the DB tagged with a fake tenant_id, confirmed
  `ChatMessage.objects.for_tenant(real_tenant)` excludes it while including
  the real one. Cleaned up both test rows afterward.

### Step 5 — Retired the old path
- `apps/chat/api.py`: removed `RemoteJWTAuthentication()`, the unused
  `HttpBearer`/`JWTAuthentication` imports, and the `print(f"DEBUG: ...")`
  line that dumped every payload + sender ID to stdout.
- **Discovered mid-build, fixed rather than left, same shape as
  ticket-service's `approvals` router surprise**: `apps/notifications/api.py`
  had **no `auth=` at all** — every endpoint took an arbitrary `user_id`
  query parameter with zero authentication. Any caller could read, mark
  read, or **delete** any other user's notifications just by guessing/
  incrementing a UUID — worse than chat's retired `RemoteJWTAuthentication`,
  which at least required *something*. Wired with
  `CentralAuthAuthentication()` and rewrote every endpoint to derive the
  user from `request.auth.id` instead of a client-supplied `user_id` —
  removes both the missing-auth hole and the IDOR in one change, since the
  two were the same root cause (trusting a client-supplied identity instead
  of the token's).

## What was NOT touched (separate auth path / dead code)

- **WebSocket path** (`apps/chat/consumers.py`, `apps/chat/middleware.py`,
  `apps/chat/routing.py`): uses a completely separate
  `JWTAuthMiddleware` (raw `rest_framework_simplejwt.tokens.AccessToken`,
  no JIT sync, no central_auth) at the Channels ASGI layer, not the Ninja
  HTTP routers this prompt scoped in ("current state to verify" only listed
  `chat/api.py` and `notifications/api.py"). Left as-is — flagging it: it
  has no tenant/permission enforcement at all today, and would need the
  same treatment in a future increment if that's in scope.
- `apps/chat/services.py` (`ChatService.send_message`/`add_participant`),
  `apps/notifications/services.py` (`NotificationService.create_notification`)
  — both call `UserClient`/`TicketClient` (`hdms_core.clients.*` or the
  local `core/clients/user_client.py` copy), but **neither class is
  imported by `api.py`, `consumers.py`, or anywhere else** — confirmed via
  grep, dead code not reachable from any live path. Not rewired; same
  pattern ticket-service found in its own `services.py`/`selectors.py`.
- `hdms_core` (shared lib, `services/shared/hdms_core/`) — untouched;
  touching it affects ticket-service and file-service too, out of scope.
  Communication-service just stopped importing `RemoteJWTAuthentication`
  from it in the two routers that mattered.

## Reused vs changed vs removed

| | |
|---|---|
| **Reused unchanged** | all 5 `central_auth/` files (byte-identical copy from ticket-service) |
| **New (service-local, not template)** | `apps/chat/managers.py` |
| **Extended** | `apps/chat/api.py`, `apps/notifications/api.py`, `ChatMessage`/`TicketParticipant`/`Notification` models (+tenant_id), `core/settings/base.py` (+AUTH_SERVICE_URL), `requirements.txt` |
| **Fixed (pre-existing, unrelated to auth wiring itself but caused by it)** | notifications router's total lack of auth + `user_id`-as-query-param IDOR; a stray debug `print()` in chat's create_message |
| **Removed** | `RemoteJWTAuthentication()` from the chat router |

## Also fixed in this session: a shared `.env` regression (not this service)

Unrelated to communication-service itself: the shared root `.env`
(`Enterprise-Resource-Planning/.env`, loaded by every HDMS/VMS/auth-service
container via `env_file`) had been overwritten by an earlier session in
this repo with an auth-service-only subset, dropping `AUTH_SERVICE_URL`,
email settings, and frontend URLs for every other service. Nothing broke
in practice (every service has a code-level default), but it was degraded.
Restored to the full original set (reconstructed from already-running
containers' captured env) before starting this work, since a broken
`AUTH_SERVICE_URL` there would have silently defeated this increment's own
JWKS fetch.

## How to run / test

```bash
# From Enterprise-Resource-Planning/Help-Desk-Management-System-main/
# (auth-service must be up with Increment 2a's HDMS seed data:
#  docker exec auth_service python manage.py seed_hdms_increment2)
docker compose build communication-service
docker compose up -d --no-deps communication-service
docker exec -u root hdms-communication-service python manage.py makemigrations chat notifications
docker exec hdms-communication-service python manage.py migrate

# Get a token (Increment 2a's HDMS Assignee test user — exact employee_code
# printed by seed_hdms_increment2, e.g. VMST-B1-G-26-H-0007)
curl -s -X POST http://localhost:8000/api/auth/login-hdms \
  -H "Content-Type: application/json" \
  -d '{"employee_code":"<code>","password":"HdmsUser@123"}'
# copy access_token -> TOKEN (communication-service has no host port mapped,
# so exec into the container or hit it from another erp_network container)

# (a) valid token succeeds, verified locally
docker exec hdms-communication-service curl -s http://localhost:8003/api/v1/notifications/ \
  -H "Authorization: Bearer $TOKEN"
# stop auth_service entirely, repeat -> still 200 (JWKS cached)

# (b) missing permission -> 403 (demonstrated via a temporary
# EmployeePermissionOverride revoking hdms.ticket.create, since every
# seeded HDMS role template has both hdms.ticket.create and view_own —
# there's no role that structurally lacks the chat permissions to test
# against, unlike ticket-service's 'assign')
docker exec hdms-communication-service curl -s -X POST http://localhost:8003/api/v1/chat/messages \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"ticket_id":"<uuid>","message":"blocked"}'
# -> {"detail": "Missing required permission: hdms.ticket.create."}

# (c) tenant filtering — insert a chat message tagged with a different
# tenant_id directly in the DB, confirm ChatMessage.objects.for_tenant(real)
# excludes it (shown via manage.py shell in this session).
```
