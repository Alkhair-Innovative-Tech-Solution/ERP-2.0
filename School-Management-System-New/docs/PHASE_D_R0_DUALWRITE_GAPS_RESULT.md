# Phase D R0: Close the Last Dual-Write Gaps Before Cutover — Result

> Branch: `phase-d-r0-close-dualwrite-gaps`. Pure additive dual-write, like
> B4/D-b2/D-b5. No removal, no cutover, no flag flips — `SYNC_TO_CENTRAL_AUTH`
> stays off by default everywhere. Synthetic data only, cleaned up after.

## Complete sweep: every auth-8001 create/sync caller, classified

Grepped every reference to `internal/create-user`, `internal/sync-org`, and
every `sync_*_to_auth`/`sync_*_to_central_auth`/`_ensure_*_user_account`
function across all 13 SMS services.

| # | Path | File | Status |
|---|---|---|---|
| 1 | Org-admin creation | `org-service/users/serializers.py` | ✅ dual-writes (D-b5) |
| 2 | Staff creation via signal (`UserCreationService`) | `staff-service/services/user_creation_service.py` | ✅ dual-writes (B4) |
| 3 | Staff batch backfill command | `staff-service/teachers/management/commands/sync_staff_to_auth.py` | ✅ dual-writes (B4 — confirmed by reading the file: imports and calls `sync_staff_to_central_auth`) |
| 4 | Staff CSV import | `staff-service/teachers/services/teacher_csv_import.py` | ✅ dual-writes (B4) |
| 5 | Student creation via ViewSet, legacy branch | `student-service/students/views.py` `perform_create`/`perform_update` | ✅ dual-writes (D-b2) |
| 6 | Student creation via ViewSet, central-auth branch | `student-service/students/views.py` `perform_create` (CentralAuthUser path) | ✅ dual-writes (D-b2/D-b3) |
| 7 | **Student CSV bulk-import** | `student-service/students/services/student_csv_import.py` `_ensure_student_user_account` | ❌ **was auth-8001-only** — **fixed this phase**, see below |
| 8 | Student backfill command | `student-service/students/management/commands/backfill_student_auth_accounts.py` | Reuses #7's function — **fixed automatically** by the same change |
| 9 | Org creation payment_status sync | `org-service/users/views.py` `OrganizationListCreateView.create()` | Correctly not wired (D-b5's own decision — `payment_status` has no central-auth equivalent; central `Organization` only tracks `name`/`is_active`) |
| 10 | Org update (name/is_active) | `org-service/users/views.py` `OrganizationDetailView.perform_update()` | ✅ dual-writes (D-b5) |
| 11 | Invoice-approve org activation | `org-service/users/views.py` `invoice_approve` | ✅ dual-writes (D-b5) |
| 12 | **org-cron: `mark_overdue_invoices`** | `org-service/users/management/commands/mark_overdue_invoices.py` | **Investigated — no gap.** Only sets `payment_status='overdue'`, never touches `is_active` or `name`. Central `Organization` has no `payment_status` field (deliberately, per #9's precedent) — nothing here maps to anything central tracks. See below for the full investigation. |
| 13 | **org-cron: `generate_recurring_invoices`** | `org-service/users/management/commands/generate_recurring_invoices.py` | Same finding as #12 — only sets `payment_status='pending'`. No gap to close. |
| — | `campus-service`'s own `/api/internal/sync-org/` | `campus-service/campus_service/urls.py` | **False positive.** A same-named but unrelated *local* SMS-to-SMS receiver (campus-service receiving org updates from org-service) — not an auth-8001 caller at all. Confirmed by reading it, not just grep-matched. |

**Confirms**: staff (B4), student on-create (D-b2), and org-admin (D-b5)
are all fully covered, exactly as the prompt asked to confirm. The only
real remaining gap was #7/#8 (student CSV path) — closed this phase.

## org-cron — investigated, genuinely no dual-write needed

Read both management commands in full. Neither ever sets `Organization.is_active`
or `.name` — both exclusively manage `payment_status` (`'overdue'` /
`'pending'`), a **billing** state. Central auth's `Organization` model (added
in D-b5) only has `is_active` and `name` — D-b5 already established that
`payment_status` isn't an auth-relevant concept and deliberately left the
org-creation-time `payment_status='pending'` sync unwired for the same
reason. These two cron commands are the same case: there is nothing in
either of them that central auth's `Organization` model represents, so
there is genuinely nothing to dual-write — not a gap left unhandled, a
correctly-scoped absence. Manufacturing a `payment_status` field on central
`Organization` just to give these commands something to sync would be
scope creep unrelated to identity/login, and was not done.

(Separately, and out of scope to fix here: nothing in `org-service` ever
sets `is_active=False` anywhere — `mark_overdue_invoices` marks an org
"overdue" but never actually deactivates it. Whether that's intentional
product behavior — a grace period before real suspension — or a genuine
pre-existing gap in org-service's own billing logic is a question for
org-service's own owners, not something this SMS-identity-focused phase
should guess at or change.)

## Student CSV bulk-import — decision: wire it (not defer)

D-b2 flagged this as deferred, reasoning "no local password hash, why it
was deferred." Re-examining `_ensure_student_user_account()`
(`student_csv_import.py`) closely: it already sends a **fixed default
password**, `'12345'` — the exact same sentinel value used by
`perform_create`'s own `_ensure_student_user_account` (the ViewSet method)
and by `central_auth_sync_service.DEFAULT_PASSWORD` (D-b2's own constant).
Since the password value is already fixed and known, a hash **can** be
produced the same way D-b2's central-auth-branch case already does
(`make_password(DEFAULT_PASSWORD)`) — there was no actual blocker left,
just an earlier pass that didn't revisit the reasoning. **Decision: wire
it**, not defer to cutover-backfill.

**What was added**: right after the existing auth-8001 call in
`_ensure_student_user_account()`, a call to the already-existing
`sync_student_to_central_auth()` (D-b2's low-level function, unchanged) —
`legacy_user_id=student.id` (same "repurpose the local service's own PK as
the idempotency key" pattern used everywhere else in this codebase, since
there's no literal `auth-8001 users_user.id` in this CSV path either),
`password_hash=make_password(DEFAULT_PASSWORD)`. This single change fixes
both #7 and #8 (the backfill command calls the same function).

**Pre-existing, unrelated quirk observed while testing**: this function's
`AUTH_SERVICE_URL` (for the "legacy" auth-8001 call) resolves to
`http://host.docker.internal:8000` in this dev environment — Phase C8
repointed that exact env var name to central auth's own URL for JWKS
purposes on this service, so the "auth-8001" call in this specific function
actually 404s against central auth's own router today. Pre-existing
(unrelated to this phase, not introduced by it, not fixed here — the
central dual-write added this phase works correctly regardless, since it
uses `CENTRAL_AUTH_URL` directly, not `AUTH_SERVICE_URL`).

## Proof

**Central dual-write, flag ON:**
```
>>> _ensure_student_user_account(fake_student)  # student_id='DB6R0-CSV-001'
[BULK STUDENT USER] Auth-service error ... 404 ...     ← the pre-existing AUTH_SERVICE_URL quirk above, unrelated
[CENTRAL-AUTH-SYNC] DB6R0-CSV-001@student.portal -> {"created": 1, "updated": 0, "errors": []}
```
Verified in central auth: `NonStaffIdentity` row created,
`identity_code=SMS01-STU-0001`, `is_active=True`.

**Flag OFF (default):**
```
>>> _ensure_student_user_account(fake_student)  # student_id='DB6R0-CSV-002'
```
No `[CENTRAL-AUTH-SYNC]` line at all. Confirmed on central auth:
`NonStaffIdentity.all_objects.filter(legacy_user_id=99998).exists()` → `False`.

**Unreachable-safe:** stopped `auth_service`, flag ON:
```
[BULK STUDENT USER] Could not reach auth-service ...
[CENTRAL-AUTH-SYNC] Could not reach central auth: <urlopen error [Errno 101] Network is unreachable>
LOCAL CALL COMPLETED WITHOUT RAISING
```
The function returned normally — a real CSV import run would continue
processing the rest of its rows exactly as before. Restarted `auth_service`
afterward.

## VMS/HDMS unchanged

`git diff --name-only` for this branch touches exactly one file:
```
School-Management-System-New/microservices/student-service/students/services/student_csv_import.py
```
No file under `Enterprise-Resource-Planning/` touched at all this phase.
Live-checked anyway:
```
$ curl -X POST .../login-vms -d '{"employee_code":"VMST-B1-G-26-V-0006","password":"VmsUser@123"}'
→ 401 {"error": "invalid_credentials", "detail": "Employee code not found or account inactive"}
```
Same result as every prior phase's identical check (pre-existing
data-availability fact of this dev DB, not a regression).

## Cleanup

The synthetic `NonStaffIdentity` (`legacy_user_id=99999`) plus its
`UserCredentials`/`RefreshToken` rows were deleted from central auth after
proving. The flag-OFF and unreachable-safe test runs (`legacy_user_id`
99998, 99997) never reached central auth at all, so nothing to clean up
there. All test invocations used in-memory `SimpleNamespace` stand-ins for
`Student`, not real DB rows — nothing to clean up in student-service either.

## Summary — is R1 (cutover) safe to schedule next?

Every identity-create path in this codebase now either dual-writes to
central auth (flag-gated, off by default) or has been confirmed to have
nothing central-relevant to sync. Nothing was left silently ambiguous:

- Staff: **fully covered** (live signal, batch backfill, CSV import).
- Student: **fully covered** (ViewSet create/update, both branches; CSV
  import and its backfill command — closed this phase).
- Org-admin: **fully covered** (D-b5).
- Org state: **fully covered** for what central tracks (`name`/`is_active`,
  via update and invoice-approve); `payment_status` correctly has no
  central equivalent and was never meant to sync.

Per the prompt, R1 (turning the flag on for real, repointing the frontend,
and backfilling existing users) is next — a user-facing change that needs
its own deliberate scheduling, not started here.
