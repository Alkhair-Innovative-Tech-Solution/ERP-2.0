# Phase C7: Repoint notification-service onto Central Auth — Result

Branch: `phase-c7-notification-service` (not merged to `main`). Scoped to
`notification-service/` only, per the prompt. Seventh of 13 — reused
C1-C6's recipe throughout; this doc records where notification-service
needed more than a copy-paste.

## Structurally different from every prior phase, confirmed up front

**None of this service's models (`Notification`/`Announcement`/
`PushSubscription`) use `OrganizationManager`** — they use Django's plain
default manager (confirmed by reading `notifications/models.py` and the
vendored `users/managers.py`). So there is no `all_objects`-vs-`objects`
blind spot on this service's own tables, a first across all 7 phases so
far. `central_tenant_qs` still exists (`notification_service/dual_auth.py`)
because the `organization`/tenant concept is still real — it just adds an
explicit `.filter(...)` on top of an already-unblind-spotted queryset
instead of swapping managers.

**The `requests`-collision hazard (C6) does not apply here.** Verified
empirically: `docker run --rm --entrypoint python
school-management-system-new-notification-service -c "import requests;
print(requests.__file__)"` resolves to the real site-packages library (this
service has no local app named `requests`). `central_auth/` was copied
byte-identical from `campus-service/` (`diff -rq`, zero output) —
`requirements.txt` adds only `cryptography==42.0.5`; `requests` itself is
already present transitively via `pywebpush`.

## What's in notification-service — confirmed as the prompt described

This service is fundamentally about *who* a notification is to/from:
`Notification.recipient`/`.actor`, `Announcement.created_by`,
`PushSubscription.user` — all real FKs to `users.User`. Simple
`IsAuthenticated`-only legacy permissions (no DRF role-gate classes), same
shape as C4/C5. One `AllowAny` endpoint (`vapid_public_key`) — investigated
per the prompt's explicit instruction (see below). Uses Django Channels
(`channels`, `channels-redis`, `daphne`) for WebSocket-based real-time
delivery — a second auth surface outside DRF entirely, not present in any
prior phase.

## Field audit — exhaustive

| Field | Model | Person, org, or domain? | Treatment |
|---|---|---|---|
| `Notification.recipient` | Notification | **person** (real FK → `users.User`) | separate `central_recipient_id` (UUID) — the core IDOR-prevention field |
| `Notification.actor` | Notification | **person** (real FK → `users.User`), nullable | separate `central_actor_id` (UUID) |
| `Notification.organization` | Notification | — (Org FK) | mixin (`tenant_id` + `central_org_id`) |
| `Announcement.created_by` | Announcement | **person** (real FK → `users.User`), nullable | separate `central_created_by_id` (UUID) |
| `Announcement.organization` | Announcement | — (Org FK) | mixin |
| `Announcement.campus` | Announcement | **domain** (null = org-wide, else scopes visibility) — not an identity | left as-is, `PrimaryKeyRelatedField` blind spot fixed (see below) |
| `Announcement.audience` | Announcement | **domain** — a `CharField` of role-labels (`all`/`principals`/`coordinators`/`teachers`/`students`), confirmed NOT an id | left as-is |
| `PushSubscription.user` | PushSubscription | **person** (real FK → `users.User`) | separate `central_user_id` (UUID); no `CentralAuthFieldsMixin` (no Organization FK on this model at all) |

Two additive migrations applied clean:
`notifications/migrations/0005_announcement_central_created_by_id_and_more`
(the central-id columns, from the earlier part of this phase) plus two more
found necessary during live proof testing this session:
`0006_alter_pushsubscription_user` and
`0007_alter_notification_recipient` (see "Nullability gap" below).
`makemigrations --check --dry-run` → "No changes detected" after each.

## Nullability gap — found only by attempting the write, fixed

Per the recipe's "prove on synthetic data" step: attempting to create a
synthetic `Notification` with only `central_recipient_id` set raised
`NotNullViolation` on `recipient_id`. Same for `PushSubscription.user` when
testing `push_subscribe` conceptually. **Both `Notification.recipient` and
`PushSubscription.user` were non-nullable FKs** — meaning no row could ever
be created for a central-auth identity at all (a `CentralAuthUser` can't be
assigned to a real FK, and the FK was required), which would have made
`central_recipient_id`/`central_user_id` permanently write-only columns
that nothing could ever populate. Widened both to `null=True, blank=True`
— additive, no data loss, no uniqueness gap reopened (`PushSubscription
.endpoint` is already globally `unique=True` regardless of which user owns
it; `Notification` has no compound-uniqueness concern at all). This is the
same class of fix as C1's `StudentContentProgress.student_id` widening,
just found later in this phase (during the write-proof, not the initial
read-through) — flagged here explicitly since it's easy to miss by reading
alone.

## The `AllowAny` endpoint — investigated per the prompt's explicit instruction

`vapid_public_key` (`GET /api/push/vapid-public-key/`) returns
`settings.VAPID_PUBLIC_KEY`. Confirmed genuinely, correctly public: this is
how the Web Push protocol works — the VAPID **public** key is meant to be
handed to any browser client so it can construct a push subscription. Only
the VAPID **private** key (never exposed by this endpoint or anywhere else
reachable via the API) is secret. No data exposure, no mutation, no IDOR
risk. Left exactly as `AllowAny`, with an explanatory comment placed
directly above it in `notifications/views.py` for future readers.

## The `PrimaryKeyRelatedField` blind spot — found once, in `AnnouncementSerializer.campus`

`campus` is a writable `PrimaryKeyRelatedField` DRF auto-derives from the
model FK, using `Campus.objects` as its queryset. `campus.Campus.objects`
is `OrganizationManager`-backed (this service vendors `campus/` from
campus-service via Dockerfile COPY) — and `OrganizationManager.get_queryset()`
returns `queryset.none()` whenever no thread-local user is set, which is
always true for central-auth requests (the standing `OrganizationMiddleware`
blind spot). Fixed with the same `__init__`-override pattern as
C1-C6: swap to `Campus.all_objects.all()` for `CentralAuthUser`.
`NotificationSerializer.actor` (also a writable `PrimaryKeyRelatedField`,
pointing at `users.User.objects` — this service's own vendored `MultiTenantUserManager`,
see below) was checked and left as-is: `recipient` is already `read_only`
and non-nullable at the DB level, so any client `POST` to
`NotificationViewSet` already fails with an `IntegrityError` before `actor`
matters, for both token types — confirmed by reading
`NotificationViewSet.perform_create` (just `serializer.save()`, no
recipient injected), not a live path.

## A second, deeper `OrganizationManager`-class blind spot — found in `users.User` itself, fixed by scoping it out

The module docstring in `notification_service/dual_auth.py` states this
service's own models don't use `OrganizationManager` — true, but
**`users.User.objects` (vendored from auth-service, `MultiTenantUserManager`)
does use the exact same thread-local pattern**, and it's queried directly
in `AnnouncementViewSet._fan_out_notifications()` (`User.objects.filter(is_active=True)`,
to resolve who gets an auto-generated in-app `Notification` when an
announcement is published). Read `users/managers.py`:
`MultiTenantUserManager.get_queryset()` returns the **unfiltered** queryset
(all organizations, all tenants) whenever no thread-local user is set —
which, per the standing `OrganizationMiddleware` blind spot, is always true
for central-auth requests. Left as-is, this would have meant: a
central-auth-authored announcement fans out an in-app `Notification` to
**every active user across every organization on the platform**, not just
the announcement's own tenant — a real cross-tenant isolation break,
exactly the class of bug the prompt's IDOR warning was pointed at, and
newly *reachable* because this phase is what makes the central-auth
`perform_create` branch work at all (before this phase, a central-auth
token couldn't successfully create an `Announcement` in the first place).

**Fixed by scoping it out, fail-closed**: `users.User` has no
`tenant_id`/`central_org_id` column of its own (only per-service
tenant-scoped models got one in this whole project) — there is no reliable
way, from within notification-service, to resolve "which local `User` rows
belong to this token's tenant". Rather than guess or leave the platform-wide
leak in place, `_fan_out_notifications()` now returns immediately when the
acting `actor` is a `CentralAuthUser`, skipping in-app fan-out entirely for
central-auth-authored announcements (see the comment block in
`notifications/views.py`). The `Announcement` row itself is still correctly
tenant-scoped for readers (`get_queryset`/`central_tenant_qs`, proven
below) — only this secondary "auto-notify everyone" convenience feature is
affected, and only for central-auth actors.

**Consequence, documented rather than silently accepted**: because
`_fan_out_notifications` never runs for central-auth actors, and no other
code path in this service currently populates `central_recipient_id`, a
central-auth user's `Notification` inbox is **correctly IDOR-safe but
currently structurally always empty** in practice — proven directly below
via manually-seeded rows, since there's no live write path to seed it
through the API yet. This is a real, known limitation for a future phase
(adding a tenant-aware `users.User` equivalent), not something this phase
could close without inventing a mapping that doesn't exist. `services.py`'s
`create_notification()` was left unchanged (not made defensively dual-safe
for `actor`) since — confirmed via `grep` — its only call site is the now-guarded
`_fan_out_notifications`, so no live path can currently reach it with a
`CentralAuthUser` actor; a short comment documents the invariant instead of
adding untestable defensive code.

## The `is_org_admin_role()` bug — found, NOT fixed, confirmed live via proof

`AnnouncementViewSet._can_manage()`'s original legacy expression —
`user.is_superadmin() or user.is_org_admin_role() or user.is_principal()`
— calls a method that **does not exist** on `_TokenUser`
(`ams_shared/jwt/validator.py` — confirmed by direct read: only
`is_superadmin()`/`is_principal()`/`is_teacher()`/`is_coordinator()`
exist). This is pre-existing, predates C7 entirely, and is **not limited to
the write-gated actions** — `get_queryset()`'s legacy branch calls the same
expression unconditionally for **every non-superadmin legacy read**
(`list`/`retrieve`), confirmed live:

```
GET /api/announcements/ (legacy HS256 token, role=teacher)  -> HTTP 500
POST /api/announcements/ (same token)                        -> HTTP 500
```

Both crash with an unhandled `AttributeError` — proven on this branch, with
no code changes of mine involved (the legacy branch is untouched, byte-for-byte,
from the original). The central-auth branch relocates the exact original
expression unchanged (bug included) into
`notification_service/dual_auth.py`'s `user_can_manage_announcements()`,
documented extensively in that function's docstring, rather than silently
fixing a bug outside this phase's stated scope. The `CentralAuthUser`
branch itself is new and does not carry the bug (there is no
`is_org_admin_role()` call on that path at all) — it's narrowed, fail-closed,
to `is_superadmin` only, since this service vendors no local
Teacher/Coordinator/Principal tables (unlike C3/C6 — only `campus` is
Dockerfile-copied here) and no role/`principal_type` claim exists on the
token yet (the gap flagged since B3).

## WebSocket dual-auth — bonus fix, in scope

`notifications/consumers.py`'s `NotificationConsumer.authenticate_user()`
only performed HS256 (legacy) verification (`verify_token` + `_TokenUser`)
— a central-auth RS256 token would fail token verification entirely,
closing the WebSocket connection (`code=4003`) before ever reaching
`central_recipient_id`. Fixed by routing on the token's own `alg` header,
mirroring `DualAuthentication`'s REST-layer dispatch — RS256 decodes via
`central_auth.jwks.get_signing_key` + builds a `CentralAuthUser`, HS256
falls through to the original, unchanged path. Verified by code inspection
only — no live WebSocket test client was available in this session (the
prompt's own test plan is REST-only). Documented in the function's own
docstring that authenticating successfully here doesn't yet mean a
central-auth user *receives* anything, for the same reason their REST
inbox is currently always empty (see above) — `user_{uuid}` channel groups
exist but nothing `group_send`s to them yet. `MonitoringConsumer` (a
bundled but unrelated system-health-monitoring-dashboard feature in the
same file, checks `self.user.role`) was left completely untouched — out of
scope, not notification domain data.

## Endpoint → permission map

Central auth's catalog (`permissions.sms_catalog.SMS_PERMISSIONS`, Phase
B3) has no notification/announcement-shaped permission at all.

| `sms.*` codename | Exists? | Wired to |
|---|---|---|
| `sms.announcement.manage` | **Flagged — not in the catalog** | `AnnouncementViewSet` create/update/partial_update/destroy |

`NotificationViewSet`'s actions (list/retrieve/unread/mark_read/mark_all_read/delete_all)
are always scoped to the caller's own inbox regardless of role — gated by
`DualServiceSubscribed` only (no perm needed), matching the "endpoints
requiring no special perm should work" pattern; managing your own
notification read-state isn't a privileged action the way broadcasting an
announcement is. `push_subscribe`/`push_unsubscribe` are likewise gated by
`DualServiceSubscribed` only. `vapid_public_key` stays `AllowAny`.
Fail-closed: every non-superadmin central-auth token 403s on announcement
create/update/destroy today.

## Proof on synthetic data

Environment: `postgres-notification`/`notification-service` built and
started for the first time this phase. `auth-service` (central auth) was
already running.

Synthetic fixtures, minted via `generate_access_token`'s kwarg passthrough
(same technique as C5/C6): 4 `Employee`s under the SMS-subscribed tenant
(`5cb22798-…`) — User A (plain, no perms), User B (plain, no perms, for the
recipient-isolation check), a superadmin-flagged token (reusing A's
identity, `is_superadmin=True` via kwargs), and a plain no-perm employee —
plus 1 `Employee` under a VMS-only tenant (`d4729a21-…`, no `sms`
subscription, for the subscription-gate check). Also one legacy `Employee`-shaped
local `users.User` + `Organization(id=5)` row (created directly via
`_base_manager`, matching C6's precedent) for the legacy dual-run proof.

```
POST /api/announcements/ (plain User A token, non-superadmin)
  -> 403 "Missing required permission: sms.announcement.manage."

POST /api/announcements/ (superadmin token, {"title":"C7 Test Announcement","body":"hello all"})
  -> 201 Created
  DB: tenant_id = 5cb22798-… (SMS tenant), central_created_by_id = <token's
      own UUID>, organization_id = NULL, created_by_id = NULL

GET /api/announcements/ (plain User A token, SMS tenant, non-superadmin)
  -> 200, shows the announcement above (org-wide/all-audience, fail-closed
     branch — correct, since it's the only kind central-auth non-superadmin
     reads can resolve)

GET /api/announcements/ (VMS-only tenant token)          -> 403 "Your
     organization does not have an active SMS subscription."
POST /api/push/subscribe/ (VMS-only tenant token)        -> 403 (same)

POST /api/push/subscribe/ (User A token, {"endpoint":"…/ep-A", "keys":{...}})
  -> 200 {"ok": true}
  DB: PushSubscription.user_id = NULL, central_user_id = <A's own UUID>
GET /api/push/vapid-public-key/ (no Authorization header at all)
  -> 200 — confirms the AllowAny decision above is exercised correctly
```

**Recipient-scoping / IDOR check** (the prompt's explicit demand — front
and center) — two `Notification` rows manually seeded
(`central_recipient_id=A`, `central_recipient_id=B`; no live create path
exists yet, per the fail-closed decision above):

```
GET /api/notifications/ (A's token)   -> 200, [{"verb": "For A only", ...}]  — NOT B's
GET /api/notifications/ (B's token)   -> 200, [{"verb": "For B only", ...}]  — NOT A's
POST /api/notifications/2/mark_read/ (A's token, A's own notification)      -> 200, unread: false
POST /api/notifications/3/mark_read/ (A's token, B's notification id)       -> 404 (invisible, not just forbidden)
```

**Tenant isolation** (second `Announcement` tagged directly to the
VMS-only tenant):

```
Announcement(tenant_id=SMS01) + Announcement(tenant_id=VMS_TENANT)
GET /api/announcements/ (SMS01 superadmin token) -> only the SMS01 row
  (central_tenant_qs applies BEFORE the is_superadmin bypass — a
  central-auth superadmin still only sees their own tenant, confirmed by
  this proof, not merely assumed from reading the code)
```

**Legacy dual-run still works** — raw HS256 token
(`ams_shared.jwt.validator` shape, `role='teacher'`), matched against a
synthetic local `users.User` row (id=2, `organization_id=5`):

```
POST /api/push/subscribe/ (legacy token, {"endpoint":"…/ep-legacy",...})
  -> 200 {"ok": true}
  DB: PushSubscription.user_id = 2, central_user_id = NULL  (unchanged shape)
GET /api/notifications/ (legacy token)  -> 200, []  (no notifications
  addressed to user id=2 — recipient_id path unchanged, no crash)
GET /api/announcements/ (legacy token, role=teacher, non-superadmin)
  -> HTTP 500 — the pre-existing is_org_admin_role() AttributeError,
     confirmed live, NOT introduced or fixed by this phase (see above)
POST /api/announcements/ (same token)
  -> HTTP 500 — same pre-existing bug, hit on the write-gate path too
```

All synthetic data (5 Employees across two tenants, 1 local `users.User`,
1 `Organization`, 2 `Notification`s, 2 `Announcement`s, 2
`PushSubscription`s) deleted after verification — confirmed via direct
row-count queries (`0` across every synthetic table) post-cleanup.

## Proof VMS/HDMS unchanged

```
manage.py check (auth_service)        -> System check identified no issues (0 silenced)
manage.py check (notification-service) -> System check identified no issues (0 silenced)
POST /api/auth/login-vms (nonexistent employee_code)
  -> 401 {"error": "invalid_credentials", "detail": "Employee code not
     found or account inactive"}  (endpoint round-trips correctly)
```

Central-auth suite: `5 failed, 66 passed, 25 errors` — identical to
C5/C6's baseline, same pre-existing causes, no new failures or errors.
notification-service has no exercised test suite (`manage.py test
notifications` finds zero tests — consistent with every SMS service
checked so far).

## Confirmed untouched

- `central_auth/authentication.py`, `jwks.py`, `permissions.py`, `tenant.py`:
  byte-identical to the C1-C5 template (no C6-style `urllib` swap needed —
  verified empirically, not just assumed).
- `MonitoringConsumer` (system-health dashboard feature bundled in
  `consumers.py`): not touched — out of scope, unrelated domain.
- `ams_shared/jwt/validator.py`, `users/middleware.py`,
  `users/managers.py` (shared/vendored across services): not modified —
  the `MultiTenantUserManager` blind spot found above was scoped around
  in `notifications/views.py`, not patched at its source.
- `campus.Campus` and its `OrganizationManager`: not modified — worked
  around via `all_objects` in the serializer fix, same as every prior
  phase's treatment of vendored campus-service models.
- Every other SMS service, VMS, HDMS, central auth's own code: untouched.
- The legacy local-`User`/session/org path: proven working unchanged
  (dual-run proof above, including the pre-existing `is_org_admin_role()`
  crash left exactly as found).

## What's next

C8 is next, separately, per the 13-service plan. Also open, carried
forward: `sms.announcement.manage` needs a future catalog step;
`central_actor_id` remains schema-only (no write path in this phase
populates it, same residual-column pattern as every prior phase's
"some other person" central-id columns); `is_org_admin_role()` remains a
live crash for any non-superadmin legacy announcement request — a real bug
worth a dedicated fix phase given its blast radius (affects reads, not
just writes), similar in spirit to the earlier dedicated
`FIX_JWT_NONSTAFF_PERMS` phase, but not undertaken here since it's outside
this phase's stated scope; and the deeper finding — central-auth
announcement fan-out has no way to resolve tenant-scoped recipients
because `users.User` carries no tenant identifier of its own — is the
same class of gap as `Teacher`/`Coordinator`/`Principal` having no
`tenant_id` in C3/C4/C6, now confirmed to affect `users.User` itself; a
future phase adding a proper tenant mapping to `users.User` (or an
equivalent lookup service) would unlock both real central-auth
notification fan-out and the WebSocket delivery this phase made
authentication-capable but not yet content-capable.
