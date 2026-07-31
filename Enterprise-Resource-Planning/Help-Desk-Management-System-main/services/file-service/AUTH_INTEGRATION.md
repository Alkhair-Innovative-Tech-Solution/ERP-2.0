# File Service — Central Auth Integration (Increment 2d, last HDMS backend service)

file-service's `files` Ninja router now verifies central-auth tokens
**locally** via JWKS — no per-request HTTP call to auth-service — gates on
the `hdms` subscription, and enforces `hdms.*` permissions per endpoint.
Attachment data is filtered by the token's `tenant_id`, including download
and status (the endpoints that previously had **no auth at all**). Verified
live against a running auth-service + file-service stack (commands below).

This closes the most dangerous open surface found across HDMS so far: three
of four file endpoints let anyone download or inspect any file, with no
login required.

## Ninja `central_auth/` template — reused unchanged (3rd time)

Copied all 5 files (`jwks.py`, `tenant.py`, `authentication.py`,
`permissions.py`, `__init__.py`) from `ticket-service/src/central_auth/` —
`diff -rq` against the source confirms byte-identical, zero edits.
`SERVICE_CODE = 'hdms'` was already correct. Same pattern as
communication-service (Increment 2c); the template is now proven reusable
across all three Ninja HDMS services with no framework-specific changes
needed at all (unlike the DRF→Ninja adaptation ticket-service had to do
once, in 2b).

Per-service changes, exactly as scoped:
- `core/settings/base.py`: added `AUTH_SERVICE_URL` (was entirely absent —
  file-service had never referenced auth-service by URL) at the hyphenated
  `http://auth-service:8000`.
- `requirements.txt`: added explicit `PyJWT==2.9.0`,
  `djangorestframework==3.15.1` (both already present transitively).
- The endpoint→permission map, `Attachment`'s `tenant_id`, and threading
  `tenant_id` through `UploadService.upload_file()` (below).

## What was built

### Step 1 — Local JWKS verification + close the router
- **Before**: `router = Router(tags=["files"])` — no router-level auth.
  `POST /upload` had `auth=RemoteJWTAuthentication()` per-endpoint;
  `GET /{id}/status`, `GET /{id}/download`, `GET /{id}` had **nothing** —
  fully open to unauthenticated requests.
- **After**: `router = Router(tags=["files"], auth=CentralAuthAuthentication())`
  — auth lives on the router, covering every current AND future endpoint by
  default, so a new endpoint can't accidentally ship open again (the exact
  failure mode this increment is closing).
- **Verified live**: `GET /{id}/download` with no `Authorization` header at
  all now returns `401` (was previously a working file download for
  anyone). Then uploaded a file with a valid token, stopped `auth_service`
  entirely, uploaded a second file with the same token — still `200`
  (JWKS key was cached from the first call). Restarted auth-service
  afterward.

### Step 2 — Service gate
- `require_permission(codename)` on every endpoint checks
  `user.has_service('hdms')` first — 403 if the tenant's `hdms` subscription
  isn't active; superadmin bypasses unconditionally.

### Step 3 — Permission enforcement (endpoint → permission map)

| Endpoint | Permission | Fit |
|---|---|---|
| `POST /upload` | `hdms.ticket.create` | clean-ish — see note |
| `GET /{id}/status` | `hdms.ticket.view_own` | clean-ish — see note |
| `GET /{id}/download` | `hdms.ticket.view_own` | clean-ish — see note |
| `GET /{id}` (details) | `hdms.ticket.view_own` | clean-ish — see note |

**Flagged, per the prompt's own framing — not faked as more precise than it
is**: an attachment belongs to a *ticket*, and anyone entitled to that
ticket (requestor + assignee) should be able to see its files — this is
"can interact with tickets at all" tier, not "is this my own file."
`hdms.ticket.create`/`view_own` are the closest catalog fit. The precise
check — *is this caller actually a participant of **this specific**
ticket* — needs ticket-service data (who's the requestor/assignee on
`attachment.ticket_id`), and HDMS's own "no ForeignKeys across service
boundaries" rule means file-service can't join against it here. **Not
built, flagged as a follow-up.** Same reasoning, same conclusion,
communication-service reached for chat messages in Increment 2c.

Also explicitly out of scope per the prompt: **attachment-type-based
access** (e.g. gating a document *category* like "admin-only contracts"
behind a stricter permission). There's no catalog permission for it today
and inventing one is an auth-service change, out of scope here — every
`category` is currently gated the same as any other attachment.

### Step 4 — Tenant filtering
- New `apps/files/managers.py` (file-service-local, **not** part of the
  central_auth template — third copy of the same composition pattern from
  ticket-service 2b / communication-service 2c):
  `TenantSoftDeleteQuerySet` = `hdms_core.models.SoftDeleteQuerySet` +
  `central_auth.tenant.TenantQuerySet`. Needed because `Attachment`
  inherits `hdms_core.models.BaseModel`, whose `objects = SoftDeleteManager()`
  default-filters `is_deleted=False` — a bare `TenantManager()` would have
  silently dropped that.
- `tenant_id = UUIDField(null=True, blank=True, db_index=True)` added to
  `Attachment`. Migration: `apps/files/migrations/0003_attachment_tenant_id.py`.
  No backfill — dev data only (confirmed via `Attachment.objects.count()`
  before this session's own test uploads).
- `apps/files/api.py`: new `_get_attachment_for_tenant(request, id)` helper
  — every one of the four endpoints (including `status` and `download`,
  called out explicitly by the prompt as the critical ones) resolves
  through `Attachment.objects.for_tenant(request.auth.tenant_id)` before
  doing anything else. A missing/wrong-tenant lookup 404s exactly like a
  genuinely nonexistent attachment — no existence leak that would tell an
  attacker "this ID exists, just not for you."
- `POST /upload` stamps `tenant_id=request.auth.tenant_id`. Since
  `Attachment.objects.create(...)` actually happens inside
  `UploadService.upload_file()`, not in `api.py`, `tenant_id` had to be
  threaded through as a new parameter on `upload_file()` and into the
  `Attachment.objects.create(...)` call there.
- **Verified live**: uploaded a file with a real token → confirmed
  `tenant_id` matches the token's. Inserted a second attachment directly in
  the DB tagged with a fake `tenant_id`, confirmed both `GET /{id}/status`
  and `GET /{id}/download` with the real tenant's token return `404` for
  it (not the file, not a 403 that would confirm existence) — cleaned up
  both test rows afterward.

### Step 5 — Retired the old path
- Removed `RemoteJWTAuthentication` (was per-endpoint on `/upload` only)
  and the unused `UserClient` import (imported, never actually called in
  `api.py` — the endpoint fell back to `request.user.id` from
  `RemoteJWTAuthentication`'s JIT sync, not a `UserClient` HTTP call).
- **Also removed, not just left**: the `uploaded_by_id` query parameter on
  `POST /upload`. It let any caller attribute an upload to an *arbitrary*
  user id ("if provided, e.g. from proxy, use it") — worse than a missing
  auth check, since it was a trust-the-client identity override sitting
  right next to a real auth mechanism. Uploader identity now comes from
  `request.auth.id` (the verified token) unconditionally.
- Removed three `print(f"DEBUG: ...")` statements from `get_file_status`,
  `download_file`, `get_file` that dumped attachment IDs/status to stdout
  on every call.
- `core/clients/user_client.py` (`UserClient`) — left in place, unreferenced
  by `api.py` or anywhere else now (confirmed via grep — nothing imports
  it). Dead file, same "found but not reachable from any live endpoint"
  shape ticket-service and communication-service both hit in their own
  `services.py`/client code. Not deleted, just noted.

## Unrelated observation (not fixed, not this increment's scope)

While proving the download flow, the background scan (`scan_file_task`,
presumably run by a separate Celery worker container) errored on both test
uploads (`ERROR: Can't access file /app/media/general/<key>.txt`, landing
`scan_status='infected'` — a scan *failure*, not an actual virus hit) rather
than reaching `'clean'`. This looks like the file-service API container and
its Celery worker not sharing the same media volume/mount, unrelated to
auth — pre-existing, and out of scope here. To finish the download proof
under (c)/(b) below, `scan_status` was force-set to `'clean'` directly in
the DB for the test attachment (cleaned up along with the row afterward).
Flagging this so it isn't mistaken for something this increment touched.

## What was NOT touched

- `hdms_core` (shared lib) — untouched, affects other services too, out of
  scope.
- `core/clients/user_client.py`, `core/clients/ticket_client.py` — kept.
  `TicketClient.validate_ticket()` is still called from `POST /upload`
  (a legitimate "does this ticket exist" check, unrelated to identity/auth
  — not part of what this increment retires).

## Reused vs changed vs removed

| | |
|---|---|
| **Reused unchanged** | all 5 `central_auth/` files (byte-identical copy, confirmed via `diff -rq`) |
| **New (service-local, not template)** | `apps/files/managers.py` |
| **Extended** | `apps/files/api.py`, `Attachment` model (+tenant_id), `UploadService.upload_file()` (+tenant_id param), `core/settings/base.py` (+AUTH_SERVICE_URL), `requirements.txt` |
| **Removed** | `RemoteJWTAuthentication` (was per-endpoint), unused `UserClient` import, the `uploaded_by_id` client-identity-override parameter, 3 debug `print()`s |
| **Closed (previously wide open, no auth of any kind)** | `GET /{id}/status`, `GET /{id}/download`, `GET /{id}` |

## Open items (flagged, not fixed here — per the prompt)

1. **Chat WebSocket path** (`communication-service/apps/chat/consumers.py` +
   `middleware.py`) still uses its own separate `rest_framework_simplejwt`
   auth, no tenant/permission enforcement, untouched by Increments 2c or 2d.
2. **Shared root `.env` fragility** — checked before starting this
   increment: `AUTH_SERVICE_URL=http://auth-service:8000` was present and
   correct (the earlier session's accidental overwrite, fixed during
   Increment 2c, held). Flagging per the prompt's instruction to check
   rather than silently depend on it — no action needed this time, but the
   file has degraded once already and isn't tracked anywhere durable.
3. **Ticket-participant-scoped access** (this doc's Step 3 flag) and
   **attachment-type-based access** — both need product/catalog decisions
   in auth-service, out of scope for a file-service-only increment.

With this, every HDMS **HTTP** backend service (ticket, communication,
file) runs on central auth. Only the chat WebSocket path (#1 above) remains
outside it.

## How to run / test

```bash
# From Enterprise-Resource-Planning/Help-Desk-Management-System-main/
# (auth-service must be up with Increment 2a's HDMS seed data:
#  docker exec auth_service python manage.py seed_hdms_increment2)
docker compose build file-service
docker stop hdms-file-service && docker rm hdms-file-service
docker compose up -d --no-deps file-service
docker exec -u root hdms-file-service python manage.py makemigrations files
docker exec hdms-file-service python manage.py migrate

# Get a token (Increment 2a's HDMS Assignee test user — exact employee_code
# printed by seed_hdms_increment2)
curl -s -X POST http://localhost:8000/api/auth/login-hdms \
  -H "Content-Type: application/json" \
  -d '{"employee_code":"<code>","password":"HdmsUser@123"}'
# copy access_token -> TOKEN

# (a) valid token succeeds, verified locally
docker exec hdms-file-service curl -s -X POST http://localhost:8005/api/v1/files/upload \
  -H "Authorization: Bearer $TOKEN" -F "file=@/tmp/testfile.txt" -F "category=general"
# stop auth_service entirely, upload again with the same token -> still 200

# (b) download with NO token — the key proof, this used to be wide open
docker exec hdms-file-service curl -s -o /dev/null -w "%{http_code}\n" \
  "http://localhost:8005/api/v1/files/<file_key>/download"
# -> 401 (was 200 before this increment)

# (c) tenant filtering — insert an attachment tagged with a different
# tenant_id directly in the DB, confirm status/download with the real
# tenant's token both 404 it (shown via manage.py shell in this session).
```
