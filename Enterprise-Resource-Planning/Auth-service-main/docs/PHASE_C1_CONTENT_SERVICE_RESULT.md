# Phase C1: Repoint content-service onto Central Auth — Result

Branch: `phase-c1-content-service` (not merged to `main`). Scoped to
`content-service/` only, per the prompt. First of 13 planned service
repoints — this doc is also the reusable recipe for C2–C13.

## What was built

### 1. `central_auth/` template — copied unchanged

`authentication.py`, `jwks.py`, `tenant.py` are byte-identical to VMS's
copies (diffed directly, zero output). `permissions.py` has exactly the
one sanctioned edit the template's own docstring calls for: `SERVICE_CODE
= 'vms'` → `'sms'`, plus the `ServiceSubscribed.message` string (cosmetic,
same spirit). No other line changed in any of the four files.

### 2. Two real integration problems found and solved — content-service-local, template untouched

Both documented in full at the top of the new `content/dual_auth.py`
(not part of the reusable template — this file's *shape* is reusable,
its exact contents will look nearly identical for C2–C13, but it's
genuinely per-service glue, not a copy-paste artifact):

**Problem 1 — DRF authentication classes don't fall through on a
mismatched token scheme.** `ServiceJWTAuthentication.authenticate()`
(legacy, HS256) and `CentralAuthAuthentication.authenticate()` (new,
RS256) both *raise* `AuthenticationFailed` — not return `None` — when
handed a token signed for the other scheme. Registering both directly in
`DEFAULT_AUTHENTICATION_CLASSES` would mean whichever runs second never
gets a chance; the first one's exception ends the chain. Fixed with
`DualAuthentication`: inspects the JWT's own unverified `alg` header
first (`RS256` → central auth, else → legacy) and dispatches to exactly
one of them. Proven live — see §5.

**Problem 2 — the shared `OrganizationMiddleware` (copied into all 13
services via Dockerfile, explicitly out of scope to touch) has a
central-auth blind spot.** It always attempts `ServiceJWTAuthentication`
itself, at the Django-middleware layer, before DRF's own authentication
runs. For an RS256 token it fails, is silently caught, and its
`get_current_user()`/`get_current_organization()` contextvars are simply
never populated for that request. Models using the default
`OrganizationManager` (`Module`, `Lesson`, `StudentContentProgress`) read
those same contextvars and return an **empty queryset** when unset ("no
user → return none, very secure"). So central-auth-authenticated requests
never use `Model.objects` (the OrganizationManager-filtered default) —
`views.py` uses `Model.all_objects` plus explicit `tenant_id` filtering
for the `CentralAuthUser` branch instead, completely bypassing the
middleware's blind spot rather than trying to fix it.

### 3. Central-id columns — `tenant_id` + `central_org_id` (+ one model-specific `central_user_id`)

Added via an abstract `CentralAuthFieldsMixin` (`content/models.py`) so
all four models get the same two additive, nullable fields with one
declaration:

- `tenant_id` (UUID, nullable, indexed) — stamped from the verified
  token's `tenant_id` claim on create; used to scope reads for
  central-auth requests. Rows with `tenant_id IS NULL` (pre-migration
  rows, or legacy-path writes) are included alongside the caller's own
  tenant — same permissive-for-unscoped-rows precedent as VMS's
  `TenantQuerySet`.
- `central_org_id` (UUID, nullable, indexed) — maps a row's local
  `users.Organization` to its central-auth `Organization` equivalent.
  Present but **not yet populated by anything** — SMS is effectively
  single-org today, and no real backfill data exists (see §4). Exists so
  the column is there when it's needed.

One field is genuinely model-specific, not part of the shared mixin:
**`StudentContentProgress.central_user_id`** (UUID, nullable, indexed).
Found while wiring `StudentProgressView`: `student_id` is a plain
`IntegerField` (SMS-local numeric id) — a central-auth identity's
`user_id` claim is a UUID and **cannot be stored in the same column**.
Added `central_user_id` as a genuinely separate field, widened
`student_id` to nullable (existing rows keep their value, nothing
backfilled), and added a partial `UniqueConstraint` on
`(central_user_id, lesson)` (`condition=central_user_id__isnull=False`)
alongside the existing `(student_id, lesson)` `unique_together` — so
duplicate-progress prevention works correctly for both identity spaces
without altering the original constraint. **Flag for C2–C13**: check
every service for this same "user id stored as a bare `IntegerField`,
not a real FK" pattern before assuming the generic `central_org_id`-only
approach covers everything — content-service didn't, once
`StudentContentProgress` was examined closely.

Two migrations, both additive/nullable-widening only:
`0003_contentitem_central_org_id_contentitem_tenant_id_and_more.py`
(the 4-model mixin fields) and
`0004_studentcontentprogress_central_user_id_and_more.py`
(`central_user_id` + `student_id` nullable + the new constraint).

### 4. Backfill — implemented, synthetic-only (as expected)

Per the Phase C analysis doc (`SMS_PHASE_C_SERVICE_REPOINT_ANALYSIS.md`):
Phase B0 found zero real SMS user/org data anywhere in this environment,
so there is no real `legacy_user_id`-linked data to backfill against for
*any* service, not just this one. The backfill **mechanism** was proven
directly: created a synthetic `NonStaffIdentity` under `SMS01`, minted a
real central-auth token for it (`generate_access_token()`), and confirmed
rows created through that token correctly get `tenant_id` stamped — the
same mechanism a real backfill script would use, just not run against
real legacy data because none exists yet.

### 5. Endpoint → permission map

| Endpoint | Gate | Status |
|---|---|---|
| `GET /modules/`, `/lessons/`, `/items/`, `curriculum` action | `DualServiceSubscribed` only (has `sms` in tenant's `services`) | Working, proven |
| `POST/PUT/DELETE /modules/`, `/lessons/`, `/items/` | `sms.content.manage` (via `_is_content_manager`) | **Flagged — not in the catalog** |
| `POST/GET /progress/` (`StudentProgressView`) | `sms.content.progress.update` (via `_is_student`) | **Flagged — not in the catalog** |

**On the two flagged permissions**: central auth's `permissions.sms_catalog.py`
(Phase B3) currently has exactly 6 permissions —
`sms.assignment.{upload,view}`, `sms.fee.{pay,view}`, `sms.result.view`,
`sms.transport.view` — none is a clean match for "manage content" or
"update own progress." Per the rules, **no permission was invented or
added to central auth's catalog from this content-service-scoped task**.
Referencing `sms.content.manage`/`sms.content.progress.update` as
codenames in `views.py` means every non-superadmin central-auth token
currently gets 403 on the gated actions — this is correct, fail-closed
behavior (proven in §6), not a bug. A future catalog step needs to add
these two (or equivalents) and assign them to the right roles before
mutation/progress endpoints are usable via central-auth tokens for
anyone but superadmin. The legacy SMS-token path is entirely unaffected
— `_is_content_manager`/`_is_student` branch by token type and keep the
exact original role-based checks for legacy tokens.

## Proof on synthetic data

Minted a real token directly (`generate_access_token()`, no login
endpoint needed — same technique used throughout Phase B) for a synthetic
`NonStaffIdentity` under `SMS01`:

```
GET  /api/content/modules/  (SMS01 student token)          -> 200 {"count":0,...}
POST /api/content/modules/  (SMS01 student token, no perm)  -> 403 {"detail":"Forbidden."}
GET  /api/content/modules/  (VMST employee token — no sms subscription)
                                                              -> 403 {"detail":"Your organization does not
                                                                       have an active SMS subscription."}
```

**Tenant isolation** — inserted two `Module` rows directly, tagged to two
different tenants:
```
Module(tenant_id=SMS01) + Module(tenant_id=VMST)
GET /api/content/modules/ (SMS01 student token) -> only the SMS01-tagged
                                                     module returned (count: 1)
```

**Dual-run — legacy path proven still working**, minted a raw HS256 token
matching `ams_shared.jwt.validator`'s expected shape:
```
GET /api/content/modules/ (legacy HS256 token, role=teacher) -> 200,
    returns BOTH modules (SMS01-tagged AND VMST-tagged) — correct: the
    legacy OrganizationManager path was never touched, doesn't know about
    tenant_id, and behaves exactly as it did before this change (a token
    with org_id=None falls through to unfiltered, same as pre-C1).
```

This last result is not a bug — it's proof the old path's behavior is
byte-for-byte unchanged, not accidentally improved or degraded by
anything added for the new path.

All synthetic data (test modules, test student) deleted after
verification.

## Proof VMS/HDMS unchanged

```
manage.py check   -> System check identified no issues (0 silenced)
POST /api/auth/login-vms  (VMST-B1-G-26-V-0001) -> vms_role: receptionist
POST /api/auth/login-hdms (VMST-B1-G-26-H-0002) -> role: assignee
```

Byte-identical to every prior increment's baseline. Full central-auth
suite: `5 failed, 64 passed, 25 errors` — identical to every prior
phase's confirmed baseline (same pre-existing `dept_sector` fixture
cause). content-service has no test suite (confirmed — `manage.py test
content` finds zero tests, consistent with every other SMS service
checked so far).

## The reusable recipe for C2–C13

1. Copy `central_auth/` (4 files) unchanged; edit only `SERVICE_CODE` (and
   its cosmetic `message` string) in `permissions.py`.
2. Add `AUTH_SERVICE_URL`/`AUTH_SERVICE_TIMEOUT` settings; add `requests`
   + `cryptography` to `requirements.txt` if not already present (check
   first — PyJWT is usually already pulled in by
   `djangorestframework-simplejwt`, but `requests`/`cryptography` are not).
3. Build a `DualAuthentication` (copy `content/dual_auth.py`'s shape,
   it's generic — routes by JWT `alg` header, works unchanged for any
   service running the same legacy `ServiceJWTAuthentication`). Wire it
   as the sole `DEFAULT_AUTHENTICATION_CLASSES` entry.
4. Build `DualServiceSubscribed`/`DualRequiresPermission` (also generic —
   no-op for legacy tokens, enforce for `CentralAuthUser`).
5. **Check every model for a bare `IntegerField`/similar storing a local
   user id** (not just proper FKs to `Organization`/`User`) before
   assuming `central_org_id` alone covers it — `StudentContentProgress`
   needed its own `central_user_id` UUID field precisely because of this.
6. Add `tenant_id`/`central_org_id` (mixin or per-model), migrate.
7. In every view: branch `get_queryset()`/`perform_create()` on
   `isinstance(request.user, CentralAuthUser)` — new path uses
   `Model.all_objects` + explicit tenant filter (never the
   `OrganizationManager`-backed default, per Problem 2 above); legacy
   path stays completely untouched.
8. Map real business rules to `sms.*` permission codenames per endpoint —
   expect gaps against the current catalog (only 6 SMS permissions exist,
   none content-shaped); flag gaps explicitly rather than inventing
   catalog entries from a single-service-scoped task.
9. Prove: valid+subscribed token → 200; token without the mutation
   permission → 403; token from an unsubscribed tenant → 403; row tagged
   to a different tenant → absent; legacy token → still works, unchanged
   behavior.

## Confirmed untouched

- `central_auth/authentication.py`, `jwks.py`, `tenant.py`: byte-identical
  to VMS's copies.
- `ams_shared/jwt/validator.py` and `users/middleware.py` (both shared
  across all 13 services): not modified.
- Every other SMS service, VMS, HDMS, central auth's own code: untouched.
- The legacy local-`User`/session/org path in content-service: proven
  working unchanged (§ dual-run proof above) — nothing dropped, this is
  dual-run, not a cutover.

## What's next

Not done here: C2 (`fees-service`) is next, separately, per the plan.
Also open: the two flagged `sms.content.manage`/
`sms.content.progress.update` permissions need a future catalog step
before content mutation/progress actually works for non-superadmin
central-auth users — noted, not solved, per this task's scope.
