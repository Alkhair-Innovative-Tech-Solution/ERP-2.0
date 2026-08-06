# Phase C2: Repoint fees-service onto Central Auth — Result

Branch: `phase-c2-fees-service` (not merged to `main`). Scoped to
`fees-service/` only, per the prompt. Second of 13 — reused C1's recipe
(`docs/PHASE_C1_CONTENT_SERVICE_RESULT.md`) throughout; this doc records
where fees-service needed more than a copy-paste.

## Environment note

This run started from a fully wiped local environment (zero containers,
`.env`/JWT PEM files gone — a separate incident, not part of C2). Restored
`.env` files, the user re-supplied the JWT keypair, and every VMS/HDMS/
SMS01 seed from Increments 0 through B3 was re-run
(`seed_vms_increment0`, `seed_hdms_increment2`, `seed_default_tenant
--tenant-code SMS01 ...`, `permissions.sms_catalog.seed_sms_*`) before
C2 work began. Mentioned here only because it means tenant/employee UUIDs
in this doc's proofs differ from earlier phases' docs — the mechanism
proven is identical.

## Template reuse — confirmed unchanged

`central_auth/` (4 files) copied from `content-service/central_auth/`
directly (`cp`, then `diff -rq` against the source — zero output, byte-
identical). `SERVICE_CODE` was already `'sms'` in the source (set once in
C1), no further edit needed. `fees/dual_auth.py`'s `DualAuthentication`/
`DualServiceSubscribed`/`DualRequiresPermission` are the same shape as
content-service's C1 versions — copied in spirit, unchanged logic.

## Field-type audit (the recipe's step 2)

| Field | Type | Treatment |
|---|---|---|
| `BankAccount.organization` | FK → `users.Organization` | mixin (`tenant_id` + `central_org_id`) |
| `FeeType.organization` | FK → `users.Organization` | mixin |
| `FeeStructure.organization` | FK → `users.Organization` | mixin |
| `StudentFee.organization` | FK → `users.Organization` | mixin |
| `Payment.received_by` | **real FK → `users.User`** | separate `central_user_id` (UUID) — see below |
| `PaymentTransaction.verified_by` | **real FK → `users.User`** | separate `central_verified_by_id` (UUID) |
| `StudentFee.month` / `.year` | `PositiveIntegerField` | not ids — confirmed safe, no treatment needed |
| `FeeLineItem` | no organization/user field | scoped implicitly via `fee_structure` FK — no treatment needed |
| `Payment`/`PaymentTransaction` themselves | no own `organization` FK | scoped implicitly via `student_fee`/`challan` FK — **no `tenant_id`/`central_org_id` added to these two models**, matching the existing legacy query pattern (`student_fee__organization=org`) |

**Why `Payment.received_by`/`PaymentTransaction.verified_by` needed a
genuinely separate field, not reuse of `central_org_id`**: both are real
Django `ForeignKey(‘users.User’, ...)` fields. A `CentralAuthUser`
instance is not a `users.User` row — assigning it to a real FK raises
`ValueError: Cannot assign ...: must be a "User" instance.` at save time.
Confirmed this is the exact same class of gap C1 found with
`StudentContentProgress.student_id` (a bare `IntegerField` there;
here it's a real FK, same root cause — the central-auth identity's UUID
has nowhere type-compatible to go).

## Endpoint → permission map

| `required_permission` | Maps to | Status |
|---|---|---|
| `view_fees` | `sms.fee.view` | **Exists** (Phase B3) |
| `manage_fees` | `sms.fee.manage` | **Flagged — not in the catalog** |
| `PaymentTransactionViewSet.submit` (student self-service payment) | `sms.fee.pay` | **Exists** (Phase B3) — wired directly via `DualRequiresPermission('sms.fee.pay')`, not through the `required_permission` map |

`manage_fees` covers fee-**structure** management (create/edit
`FeeType`/`FeeStructure`/`BankAccount`) and staff recording a payment on
someone's behalf (`PaymentViewSet.create`, `CashPaymentView`,
`GenerateChallansView`) — none of which is the same action as
`sms.fee.pay` (the student's own self-service payment submission, which
already had a clean catalog match and was wired to it directly). Per the
rules, `sms.fee.manage` is **referenced but not added** to central auth's
catalog from this fees-service-scoped task — every non-superadmin
central-auth token correctly 403s on `manage_fees`-gated endpoints today
(proven below), fail-closed, same pattern as C1's `sms.content.manage`.

`StudentFeeViewSet` reads (list/retrieve) and `PaymentTransactionViewSet`
reads have **no `required_permission` at all** — gated by
`DualServiceSubscribed` only, matching "endpoints requiring no special
perm should work."

## `DualHasDynamicPermission` — the fees-specific extension

fees-service's permission system (`users.permissions.HasDynamicPermission`)
is materially different from what C1 dealt with: it calls
`request.user.is_superadmin()` as a **method** (crashes on
`CentralAuthUser` — there it's a bool *attribute*, not callable), reads
`request.user.role`/`.organization` (neither exists on `CentralAuthUser`),
and queries a **local `RolePermission` table** keyed on
`(organization, role, permission_codename)` — SMS's own dynamic
permission system, entirely separate from central auth's RBAC.

Built `DualHasDynamicPermission` (`fees/dual_auth.py`) as a drop-in
replacement: legacy tokens get the **exact original logic**, relocated
byte-for-byte, not rewritten; `CentralAuthUser` tokens get
`required_permission` mapped through `REQUIRED_PERMISSION_TO_SMS_CODENAME`
and checked via `user.has_perm()`. One import swap
(`HasDynamicPermission as HasDynamicPermission` → the dual version) covers
every view that used it — no other view code needed to change for this
part.

Also needed three small type-safe helpers (`user_is_superadmin`,
`user_role`, `user_display_name`) since `views.py` called
`request.user.is_superadmin()`/`.role`/`.get_full_name()`/`.username`
directly in several more places (campus-scoping, `CashPaymentView`'s
receipt display) — every call site now goes through these instead.
`user_role()` returns `None` for `CentralAuthUser` (no principal_type
claim exists yet, same gap flagged in B3/C1), which makes every
`user_role(user) in (...)` campus-scoping check correctly evaluate to
"skip" rather than crash.

## A gap found and fixed properly, not glossed over: `FeeService.record_payment`

`CashPaymentView`/`PaymentViewSet.perform_create` call
`FeeService.record_payment()`, which internally did
`StudentFee.objects.select_for_update().get(id=student_fee_id)` —
`StudentFee.objects` is `OrganizationManager`-filtered, which goes empty
for central-auth requests (the same `OrganizationMiddleware` blind spot
C1 found — its contextvars are never populated for an RS256 token).
Naively switching this internal lookup to the unfiltered `_base_manager`
would have **removed the legacy path's implicit tenant safety** too
(today, `OrganizationManager` is the only thing stopping a legacy token
from paying another org's challan by guessing an id).

Fixed by adding an optional `student_fee=` parameter to
`record_payment()`: when given a pre-fetched, already tenant-verified
instance, the internal lookup is skipped entirely (re-fetched by id via
`_base_manager` only after that verification, for the `select_for_update`
lock); legacy callers that don't pass it get the **exact original
behavior**, unchanged. `CashPaymentView` (central-auth branch) now
pre-fetches via the same `_central_tenant_qs()` helper the read paths
use, and 404s before ever calling the service if the challan isn't in the
caller's tenant — closing the gap for the primary staff payment-recording
flow, proven end-to-end below.

**Not fully closed, flagged**: `PaymentViewSet.perform_create` receives
`data['student_fee']` already resolved by the serializer's own
`PrimaryKeyRelatedField`, which still queries the `OrganizationManager`-
filtered default — for a central-auth request this could reject at
serializer-validation time before `perform_create` ever runs. `record_payment`
now accepts the resolved instance to at least avoid the internal-lookup
crash, but the serializer-level resolution itself wasn't changed (out of
proportion for this pass — `CashPaymentView`, the one explicitly named in
the prompt's test plan, is the one proven end-to-end). Flagged for a
follow-up, not silently left broken without a note.

## Proof on synthetic data

```
GET  /api/fees/student-fees/  (SMS01 student token, no specific perm)     -> 200 {"count":0,...}
POST /api/fees/fee-types/     (SMS01 student token, needs sms.fee.manage) -> 403 "You do not have permission..."
GET  /api/fees/student-fees/  (VMST employee token — no sms subscription) -> 403 "Your organization does not
                                                                                have an active SMS subscription."
```

**Tenant isolation** (`BankAccount`, tagged directly to two different
tenants):
```
BankAccount(tenant_id=SMS01) + BankAccount(tenant_id=VMST)
GET /api/fees/banks/ (SMS01 student token) -> only the SMS01-tagged
                                               bank account returned (count: 1)
```

**Legacy dual-run still works** — raw HS256 token (`role='superadmin'`,
matching `ams_shared.jwt.validator`'s shape):
```
GET /api/fees/banks/ (legacy token) -> 200, returns BOTH bank accounts
    (superadmin bypasses org filtering entirely in the untouched legacy
    branch — correct, unchanged behavior, not a leak)
```

**`central_user_id` fix, proven end-to-end** — central-auth superadmin
token records a cash payment on a synthetic challan via `CashPaymentView`:
```
POST /api/fees/cash/record/ {"challan_id": 1, "amount": 500}
-> 201 {"success": true, "received_by": "Increment0 SuperAdmin", "receipt_no": "RCP-2026-001", ...}

Payment row: received_by = None, central_user_id = aaf6a4af-...-b4752e247aba
```
No `ValueError` on FK assignment (the bug this fix targets), correct
field populated, `user_display_name()` correctly read `.full_name` for
the receipt display.

All synthetic data (test student, bank accounts, campus, student,
fee type/structure/challan/payment) deleted after verification.

## Proof VMS/HDMS unchanged

```
manage.py check   -> System check identified no issues (0 silenced)
POST /api/auth/login-vms  -> vms_role: receptionist
POST /api/auth/login-hdms -> role: assignee
```

Byte-identical to every prior increment's baseline. Central-auth suite:
`5 failed, 64 passed, 25 errors` — identical to every prior phase's
confirmed baseline (same pre-existing `dept_sector` fixture cause).
fees-service has no test suite (`manage.py test fees` finds zero tests,
consistent with every SMS service checked so far).

## Confirmed untouched

- `central_auth/authentication.py`, `jwks.py`, `tenant.py`: byte-identical
  to the C1/VMS source.
- `ams_shared/jwt/validator.py`, `users/middleware.py`,
  `users/permissions.py` (all shared across services): not modified —
  `DualHasDynamicPermission` is a new class in `fees/dual_auth.py`, the
  original `HasDynamicPermission` in `users/permissions.py` is untouched
  and still used exactly as before by anything that imports it directly.
- Every other SMS service, VMS, HDMS, central auth's own code: untouched.
- The legacy local-`User`/session/org path: proven working unchanged
  (dual-run proofs above).

## What's next

C3 (`ai-service`) is next, separately — per the Phase C analysis doc it
has **zero** `User`/`Organization`/`Campus` coupling (Dockerfile doesn't
even copy those apps in), so it's likely JWKS-verification-only, no
model/migration work at all. Also open: `PaymentViewSet.perform_create`'s
serializer-level `student_fee` resolution gap (above), and the two
flagged permissions (`sms.fee.manage`) need a future catalog step before
fee-structure management/staff payment-recording actually works for
non-superadmin central-auth users.
