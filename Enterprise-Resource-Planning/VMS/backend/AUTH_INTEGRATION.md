# VMS Backend — Central Auth Integration (Increment 1)

VMS is now a proper **consumer** of central auth: it verifies access tokens
**locally** against the auth-service's RSA public key (JWKS) — no per-request
HTTP call to auth-service — and enforces access using the `perms` /
`tenant_id` / `services` claims already embedded in the token. Verified live
against a running auth-service + VMS stack (commands below).

## What changed

### 1 — Local JWKS verification
- New `central_auth/` package (sibling of `visitors/`, not a Django app —
  plain Python, no models): `jwks.py`, `authentication.py`, `permissions.py`,
  `tenant.py`.
- `central_auth/jwks.py` fetches `{AUTH_SERVICE_URL}/.well-known/jwks.json`
  once, caches the RSA public key in Django cache (1h TTL, refetches on miss
  or unknown `kid`).
- `central_auth/authentication.py` — `CentralAuthAuthentication` (DRF auth
  class): verifies the token's RS256 signature + expiry in-process via
  PyJWT, builds `request.user` as a `CentralAuthUser` **entirely from the
  token's own claims** (`employee_code`, `tenant_id`, `services`, `perms`,
  `perm_version`, `is_superadmin`, …). No `/me` round trip, ever.
- **Deleted** `visitors/authentication.py` (`VmsHybridAuthentication`,
  `AuthServiceUser`, `LocalFallbackUser`) and the now-dead
  `auth_service_client.verify_token()` / `invalidate_token_cache()`
  (the old Redis-cached `/api/auth/me` proxy path).
- `settings.py`: `DEFAULT_AUTHENTICATION_CLASSES` →
  `central_auth.authentication.CentralAuthAuthentication`.
- `requirements.txt`: added `PyJWT==2.9.0`, `cryptography==42.0.5` (RS256
  needs `cryptography`; `djangorestframework-simplejwt` only pulled in
  PyJWT's HS256 path before).
- **Verified live**: stopped the `auth_service` container entirely, then
  called `GET /api/visits/` with a token minted earlier — **200**, because
  the public key was already cached. Restarted auth-service afterward.

### 2 — Service subscription gate
- `central_auth/permissions.py` → `ServiceSubscribed`: 403 unless `'vms' in
  token.services` (or superadmin). Put first in every authenticated
  endpoint's `permission_classes`.
- Verified via a white-box check inside the container (a token with
  `services=[]` → `ServiceSubscribed.has_permission()` → `False`; a token
  with `services=['vms']` → `True`; superadmin → `True` regardless).
  Couldn't produce a real *negative* token end-to-end for this because only
  one tenant (`VMST`, actively subscribed to `vms`) exists in this
  environment — Increment 0 already proved the 403 at the auth-service
  layer (`login-vms` returns `tenant_not_subscribed` when the subscription
  is suspended), so this is the same claim, enforced a second time on the
  consumer side using the token already in hand.

### 3 — Permission enforcement (endpoint → permission map)
`central_auth/permissions.py` → `RequiresPermission(codename)`: a DRF
permission-class factory reading `codename in token.perms` (superadmin /
`'*'` bypasses). Every non-public endpoint's `@permission_classes` is now
`[IsAuthenticated, ServiceSubscribed, RequiresPermission('vms.xxx')]`.

| Endpoint | Permission | Notes |
|---|---|---|
| `POST /visits/receptionist-entry/` | `vms.visit.create` | |
| `POST /visits/approve/<id>/` | `vms.visit.create` | check-in approval, same bucket as create |
| `POST /visits/reject/<id>/` | `vms.visit.create` | |
| `POST /visits/checkout/<id>/` | `vms.visit.checkout` | |
| `POST /visits/schedule/` | `vms.visit.create` | |
| `POST /visits/<id>/update-host/` | `vms.visit.create` | |
| `PATCH /visits/<id>/overwrite/` | `vms.visit.create` | |
| `GET /visits/` , `GET /visits/<id>/` | `vms.visit.view_own` | |
| `POST /visits/<id>/send-card-email/`, `GET .../whatsapp-link/` | `vms.visit.create` | part of the check-in completion flow |
| `GET /visitors/search/`, `/visitors/`, `/visitors/<id>/history/`, `/check-cnic/`, `/check-duplicate/`, `/blacklisted/` | `vms.visitor.view` | |
| `POST /visitors/<id>/blacklist/`, `/unblacklist/` | `vms.visitor.edit` | Admin-only role in the catalog |
| `GET /dashboard/stats/`, `/companies/`, `/companies/<name>/`, `/export/visits/`, `POST /utils/check-overnight/` | `vms.report.view` | Admin-only role in the catalog |
| `POST /hosts/from-employee/`, `GET /employees/`, `/employees/<id>/`, `/departments/` | `vms.visit.create` | reference-data lookups feeding the check-in form; no closer-fitting codename exists in the catalog (see "Catalog gaps" below) |
| `GET /qr/checkin/` (`POST`), `/visits/status/<id>/`, `/visits/verify/<id>/`, `/visits/scheduled-entry/`, `GET /hosts/` | *(none — `AllowAny`)* | public kiosk/self-service endpoints, unchanged |

**Catalog gaps** (flagging, not fixing — catalog lives in the auth service,
out of scope here): `vms.gate.manage` and `vms.role.manage` currently have
no matching action in VMS's own endpoints (no gate/location model exists
yet; role management is admin-service-side). Host-record management
(`create_host_from_employee`) doesn't map cleanly to any of the 10
permissions — `vms.visit.create` was the least-wrong fit since it's part of
the receptionist intake flow, not `vms.gate.manage` (VMS's `Host` model is
"person to visit", not a physical gate/location).

### 4 — Tenant filtering
- `central_auth/tenant.py` → `TenantQuerySet.for_tenant(tenant_id)` /
  `TenantManager` — the shared base. `Visitor`, `Host`, `Employee`, `Visit`
  each gained `tenant_id = UUIDField(null=True, blank=True, db_index=True)`
  and `objects = TenantManager()` (migration
  `visitors/migrations/0007_..._and_more.py` — also picked up unrelated
  pre-existing index-name drift already present in this checkout, see
  "Surprise" below).
- Views read via `Model.objects.for_tenant(request.user.tenant_id)` instead
  of `.objects.all()/.filter()`, and stamp `tenant_id=request.user.tenant_id`
  on every `.objects.create(...)`.
- **`approved_by` was a `ForeignKey(django.contrib.auth.models.User)`.**
  Central-auth-authenticated requests carry a `CentralAuthUser` (built from
  token claims), not a Django `User` row — assigning it to that FK would
  raise on every `receptionist_entry`/`approve_visit` call. Changed the
  field to a plain `CharField` storing `employee_code`. This was a **latent
  bug in the old code too** (`AuthServiceUser` in the deleted
  `VmsHybridAuthentication` had the same problem) that only didn't surface
  because real usage apparently went through the local-fallback
  `LocalFallbackUser` path (a real Django `User`); removing that fallback
  (see §5) made it universal, so it had to be fixed here, not left to bite
  later.
- **Verified live**: created a visit via `receptionist-entry` with a real
  token → confirmed in Postgres its `tenant_id` matches the token's
  `tenant_id` and `approved_by` holds the employee_code string. Then
  manually inserted a `Visitor`/`Visit` row tagged with a different
  (fake) `tenant_id` directly in the DB and confirmed `GET /visits/` with
  our token does **not** return it, while it does return our own tenant's
  visit — cleaned up the fake row afterward.

**Public endpoints and tenant filtering — resolved via kiosk keys
(follow-up to Increment 1, still Increment 1 scope).** `qr_checkin`
(self-service QR check-in) has no token, so there was no tenant signal to
stamp on the `Visitor`/`Visit` it creates. Fixed with a new `KioskKey`
model (`visitors/models.py`): `key` (unique string) → `tenant_id`. A QR
kiosk is configured with a key (baked into its check-in page URL/config)
and sends it as `kiosk_key` in the request; `resolve_kiosk_tenant()` in
`views.py` resolves it to a `tenant_id` before creating the
`Visitor`/`Visit`, or before filtering `host_list`.
- No `kiosk_key` sent → falls back to `tenant_id = NULL` (today's
  behavior, kept for backward compatibility since the frontend doesn't send
  one yet — this is additive, not a breaking change).
- Unknown/inactive key → **400**, not a silent fallback (almost certainly a
  kiosk misconfiguration, not a legitimate anonymous submission).
- `TenantQuerySet.for_tenant()` still includes `tenant_id IS NULL` rows
  alongside the caller's own tenant (Increment-0 precedent: null tenant =
  legacy/unscoped, permissive) — this now only matters for kiosks that
  *haven't* been given a key yet, not for kiosks in general.
- New idempotent command: `python manage.py seed_kiosk_key --key <key>
  --tenant-id <uuid> --label <label>`.
- **Verified live**: seeded `main-gate` → `VMST`'s tenant_id. QR check-in
  with `kiosk_key: "main-gate"` → `Visit.tenant_id` = the real tenant UUID
  in Postgres. Same call with no `kiosk_key` → `tenant_id` NULL. Call with
  `kiosk_key: "bad-key"` → `400 {"error": "Invalid or inactive kiosk key."}`.
- Remaining real gap: `scheduled_entry` and `visit_status`/`visit_verify`
  don't take a kiosk key — they operate on a specific already-known
  `visit_id`/`visiting_id` (from a card/QR code), not a listing, so there's
  no tenant-filtering decision to make there. `scheduled_entry` doesn't
  create new rows — it transitions an already tenant-stamped `Visit`
  (created earlier via authenticated `schedule_visit`).
- Frontend still needs to be updated to actually send `kiosk_key` on its
  QR check-in page — that's frontend work, out of scope for this backend
  increment.

**Visitor identity vs. tenant boundary — confirmed as a product decision,
not an open gap.** `Visitor.cnic` is globally unique at the DB level
(pre-existing schema constraint, not introduced here), so there is only
ever one `Visitor` row per CNIC regardless of tenant.
**Decision (confirmed): global, not per-tenant.** A blacklisted visitor is
blocked at every tenant — this is intentional (a flagged/dangerous person
should be blocked everywhere, not just at the tenant that blacklisted
them), not a side-effect left unfixed. Per-tenant blacklisting would
require dropping the CNIC uniqueness constraint and moving blacklist status
to a separate per-(tenant, visitor) table — a real schema change, not
attempted, and not needed given the decision above.
Consequences of this decision: `find_existing_visitor` /
`check_duplicate_combo` / `get_or_create_visitor`'s lookup is intentionally
**not** tenant-scoped (a repeat visitor is recognized across tenants by
design; only `tenant_id` on *newly created* rows is stamped from the
caller's token/kiosk key). `blacklist_visitor` / `unblacklist_visitor` /
`check_cnic_api` act on this shared identity and are likewise unscoped by
design. Only the **`Visit` transaction list** for a visitor
(`visitor_history`) is tenant-filtered, so each tenant only sees their own
visit records with that person — their blacklist status, however, is
shared.

### 5 — Fallback decision
Removed both halves of the old local-credentials fallback, not just the
verification side:
- `visitors/authentication.py`'s `LocalFallbackUser` (verified locally-issued
  Simple JWTs on **incoming** requests) — deleted along with the whole file.
- `VmsLoginView`'s local-Django-credentials fallback (**issued** a new
  Simple JWT at **login** time when auth-service was unreachable) — also
  removed. Reasoning: it minted a token with none of `tenant_id` / `perms` /
  `services`, and after removing `LocalFallbackUser` there is no verifier
  left that accepts it — so keeping login-time issuance would have silently
  handed users a token that fails on the very next authenticated request
  (a confusing "logged in, but everything 403s" state). `VmsLoginView` now
  returns a plain `503 {"error": "...", "auth_service_down": true}` when
  auth-service is unreachable at login, instead of a broken success.
- `VmsTokenRefreshView` (`/api/auth/refresh/`, Simple-JWT based) was left
  untouched — out of scope for this increment, and a pre-existing question
  (real auth-service tokens are RS256, not Simple JWT, so this endpoint's
  applicability to central-auth tokens predates this change).

## Reusable auth-glue template
`central_auth/jwks.py`, `authentication.py`, `permissions.py`, `tenant.py`
are the whole surface — nothing VMS-specific except `permissions.py`'s
`SERVICE_CODE = 'vms'` constant. To onboard the next service: copy the
package unchanged, set `AUTH_SERVICE_URL`, change `SERVICE_CODE`, add
`tenant_id` + `objects = TenantManager()` to that service's own models.

## Surprise
The migration Django generated for the new `tenant_id` fields also included
a bundle of pre-existing, unrelated index-name renames and a `purpose`
field alter on `Visit` — drift between the stored migration state and the
current model that predates this work (confirmed via `git diff` on
`visitors/models.py` history — those fields/indexes weren't touched here).
Included in the same migration rather than splitting it out, since Django
computes one diff per `makemigrations` run and this is a dev database with
no data-loss risk from the rename.

## How to run / test

```bash
# From Enterprise-Resource-Planning/VMS/ (auth-service must already be up, see
# Auth-service-main/docs/INCREMENT_0_RESULT.md)
docker compose up -d db redis backend

# Get a central-auth token (from the auth service)
curl -s -X POST http://localhost:8000/api/auth/login-vms \
  -H "Content-Type: application/json" \
  -d '{"employee_code":"VMST-B1-G-26-V-0001","password":"VmsUser@123"}'
# copy access_token -> TOKEN

# (a) valid token succeeds, verified locally
curl -s http://vms-backend:8000/api/visits/ -H "Authorization: Bearer $TOKEN"

# (b) missing permission -> 403 (receptionist role has no vms.report.view)
curl -s http://vms-backend:8000/api/dashboard/stats/ -H "Authorization: Bearer $TOKEN"
# -> {"detail":"Missing required permission: vms.report.view."}

# (c) tenant filtering — insert a row tagged with a different tenant_id
# directly in vms_db and confirm it's absent from the list above.

# (d) kiosk key -> tenant_id on public QR check-in
docker exec vms-backend-1 python manage.py seed_kiosk_key \
  --key main-gate --tenant-id <TENANT_UUID_FROM_TOKEN> --label "Main Gate"
curl -s -X POST http://vms-backend:8000/api/qr/checkin/ \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Test","phone":"03001234567","purpose":"meeting","host_is_other":true,"kiosk_key":"main-gate"}'
# -> Visit.tenant_id in Postgres now matches TENANT_UUID_FROM_TOKEN
```

Local-verification proof: stop the `auth_service` container entirely, then
repeat (a) — still `200`, because the JWKS public key was already cached.

Login credentials: same as Increment 0 —
`VMST-B1-G-26-V-0001` / `VmsUser@123`.
