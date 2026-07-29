# Increment 0: VMS Vertical Slice — Result

Multi-tenant auth spine proved end-to-end on ONE service (VMS), inside the
existing `Auth-service-main/Backend/src/` — no other services touched, no
folders reorganized.

**Done:** a VMS user logs in, receives a token carrying `tenant_id` +
`perms`, can only do what their scoped role allows, and a request for a
service the tenant did NOT subscribe to returns 403. All verified live
against a running instance (commands below).

## What was built

### Step 0 — got it running
- No `.env` existed in this checkout (gitignored). Recovered real Postgres/Redis
  creds from the already-running `erp_postgres`/`erp_redis` containers
  (`docker inspect`), and RSA keypair from an older sibling checkout
  (`erp_new/config/*.pem`). Wrote `Enterprise-Resource-Planning/.env` +
  `.env.dev`.
- Old `auth-service-main-auth-service` image reused (no image registry
  access in this environment); container run via
  `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d auth-service`.
- **Surprise:** "nothing runs yet" was not quite true — `auth_db` already had
  a schema + leftover test data (2 SuperAdmins, 6 Employees) from a prior
  session sharing the same Postgres volume. Left it alone; all new seed data
  uses a distinct `VMST` tenant/org/employee so it doesn't collide.
- New idempotent command `manage.py seed_vms_increment0` creates: one
  SuperAdmin, one Tenant/Organization/Institution/Branch/Department/
  Designation, one VMS employee, and (as later steps landed) the
  Subscription/roles below.

### Step 1 — Tenant + tenant_id
- New `Tenant` model (`employees/models.py`) — the paying customer.
- `Organization.tenant` FK (nullable — legacy orgs stay `null`, no backfill).
- `Employee.tenant` FK, **denormalized** from `organization.tenant` in
  `Employee.save()` — needed at token-mint time without walking
  assignment→department→branch→institution→organization→tenant on every login.
- Migration: `employees/migrations/0019_tenant_employee_tenant_organization_tenant.py`

### Step 2 — Subscription
- New `Subscription` model (`permissions/models.py`): `tenant` × `service`,
  `status` (active/trial/suspended/cancelled), `ends_at`.
  `Subscription.tenant_has_active(tenant_id, service_code)` classmethod is
  the single check used everywhere.
- `ServiceAccess.clean()` now also validates the employee's tenant has an
  active subscription for the service (defensive; legacy employees without
  a tenant are left unchecked).
- Migration: `permissions/migrations/0010_subscription.py`

### Step 3 — catalog-driven VMS roles
- New `permissions/vms_catalog.py`: 10 namespaced permissions
  (`vms.visit.create`, `vms.visit.checkout`, `vms.visitor.view`, …) and 3
  default role **templates** (`VMS Admin`, `VMS Receptionist`,
  `VMS Security Staff`, tenant=null, `is_template=True`).
  `instantiate_tenant_roles(tenant)` clones templates into tenant-scoped
  `Role` rows.
- `Role` gained `tenant` FK and `service_catalog` FK (+ `is_template`).
  Kept the legacy `service` CharField (unchanged, used by non-VMS/legacy
  code) rather than repurposing it — see "Decisions" below.
- Existing `rbac.py` engine (`get_effective_permissions`) needed **zero
  changes** to pick up catalog-driven roles — proved live: employee with
  the tenant's "VMS Receptionist" role resolves its 5 permissions correctly.
- New management command `seed_vms_catalog` (global catalog only, no tenant).

### Step 4 — object scope
- `EmployeeRole.scope_content_type` / `scope_object_id` already existed
  (marked "MVP: always null") — **no schema change needed**, just activated.
- `rbac.get_effective_permissions()` now excludes scoped grants from the
  global/flat permission set (a role scoped to one Branch does not grant
  the permission "everywhere" — this was a latent bug once scoping
  activates).
- New `rbac.get_scoped_permissions(employee_id, obj)` + `has_permission(user,
  codename, obj=None)` (object-optional, backward compatible) implement
  has-permission AND target-in-scope.
- `require_permission(codename, obj_resolver=None)` decorator gained an
  optional resolver for endpoints that operate on a specific object.
- Verified live: employee with an EmployeeRole scoped to Branch A gets
  `True` for Branch A, `False` for Branch B, `False` with no object —
  global flat set stays empty (correctly excludes the scoped grant).

### Step 5 — token claims + JWKS
- `generate_access_token()`: **removed** `department_id`, `department_name`,
  `designation` (HR fields — this token is an authz artifact, not an HR
  profile). Kept `employee_code`/`employee_id` as identity, not HR.
- **Added**: `tenant_id`, `services` (tenant's active-subscription service
  codes), `perms` (effective global permission codenames — `["*"]` for
  SuperAdmin), `perm_version` (monotonic int, bumped by
  `rbac.clear_permission_cache()` whenever a role/override changes, so
  downstream services can detect a token minted before a permission change).
- New `GET /.well-known/jwks.json` — serves the RSA public key as a JWK
  (`kty`, `n`, `e`) so consumer services can fetch the verification key
  instead of needing the PEM distributed out-of-band.

### Step 6 — enforce + remove VmsRole
- `login-vms` enforcement order: credentials valid → **tenant subscribed**
  (`Subscription.tenant_has_active`) → `ServiceAccess` active → catalog role
  assigned. SuperAdmin bypasses via the separate `/api/auth/login` endpoint.
- **Deleted** `VmsRole` (model, migration `0013_delete_vmsrole`, and every
  call site: `permissions/api.py` grant/check/list-VMS endpoints,
  `authentication/api.py` `login-vms`, `permissions/utils.py` `get_vms_role`).
  All replaced by catalog `EmployeeRole`/`Role` lookups via new helpers
  `get_employee_vms_role_type()` / `assign_employee_vms_role()` in
  `vms_catalog.py`, which also translate old `role_type` slugs
  (`admin`/`receptionist`/`security_staff`) to/from catalog `Role.name` for
  API back-compat.
- Live-verified the actual "Done" bar: suspended the test tenant's `vms`
  Subscription → `login-vms` returns `403 tenant_not_subscribed`;
  reactivated → `200` again.

## Reused vs changed vs removed

| | |
|---|---|
| **Reused unchanged** | `rbac.py` core formula, RS256 signing, `SuperAdmin`, account lockout (`UserCredentials`), audit app, Redis cache, `EmployeeRole`/`EmployeePermissionOverride` (scope fields existed, just inert) |
| **Extended** | `rbac.py` (scope-aware checks, perm_version), `jwt_utils.py` (new claims), `Role` (tenant/service_catalog), `ServiceAccess.clean()`, `login-vms` |
| **New** | `Tenant`, `Subscription`, `vms_catalog.py`, JWKS endpoint, `seed_vms_increment0`/`seed_vms_catalog` commands |
| **Removed** | `VmsRole` model + all 6 call sites |

## Decisions worth flagging

- **`Role.service` (CharField) kept, not replaced.** The spec said "add
  tenant_id + service_id to Role"; a literal FK named `service` would
  collide with the existing CharField that legacy/HDMS code already filters
  on. Added `service_catalog` (FK) alongside it instead. VMS's new roles set
  both. If a future increment migrates HDMS onto the same catalog, this is
  the field to fold away.
- **`Role` uniqueness** needed two partial `UniqueConstraint`s (`tenant IS
  NULL` vs `tenant IS NOT NULL`) instead of a plain `unique_together`,
  because Postgres treats `NULL` as distinct — a naive 3-column
  `unique_together` silently stopped enforcing uniqueness for legacy global
  roles. Caught by the existing test suite, not by inspection.
- **Leftover DB state.** `auth_db` was not empty despite the "nothing runs
  yet" premise — see Step 0. Worth confirming with the team whether that
  volume should be wiped before this becomes a shared dev environment.
- **JWKS `kid`** is a hardcoded `"auth-service-1"` — fine for one key; revisit
  if/when key rotation is added.

## How to run / test the slice

```bash
# From Enterprise-Resource-Planning/Auth-service-main/
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d auth-service
docker exec auth_service python manage.py seed_vms_increment0

# Login (issues token with tenant_id/services/perms/perm_version)
curl -X POST http://localhost:8000/api/auth/login-vms \
  -H "Content-Type: application/json" \
  -d '{"employee_code":"VMST-B1-G-26-V-0006","password":"VmsUser@123"}'

# JWKS
curl http://localhost:8000/.well-known/jwks.json

# Prove the subscription gate (403 when tenant's VMS subscription isn't active)
docker exec auth_service python manage.py shell -c "
from permissions.models import Subscription
s = Subscription.objects.get(tenant__tenant_code='VMST', service__code='vms')
s.status = 'suspended'; s.save()"
curl -X POST http://localhost:8000/api/auth/login-vms \
  -H "Content-Type: application/json" \
  -d '{"employee_code":"VMST-B1-G-26-V-0006","password":"VmsUser@123"}'
# -> 403 {"error": "tenant_not_subscribed", ...}
```

Test suite: `docker exec auth_service python -m pytest permissions/ authentication/ -q`
— 63 passed. 12 pre-existing failures/errors in `permissions/tests.py`
(`TestGrantHdmsAccessAPI`, `TestCheckHdmsAccessAPI`) are unrelated to this
work — stale fixtures reference a `Department.dept_sector` field that
doesn't exist on the current model; confirmed via `git diff` that this file
was never touched here.

Login credentials seeded:
- SuperAdmin: `S-26-0001` / `SuperAdmin@123`
- VMS test user: `VMST-B1-G-26-V-0006` / `VmsUser@123`
