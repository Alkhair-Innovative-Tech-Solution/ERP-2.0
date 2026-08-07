# Phase D-b4-fix: Close the Two Central-Login Gaps — Result

> Branch: `phase-d-b4-fix-token-gaps`, on top of `phase-d-b4-frontend-adapter`.
> Additive/dual-run. Synthetic data only, cleaned up after.

## Gap 1 — campus/level: investigation

**Where campus/level actually lives:** confirmed by reading the models —
neither `Employee` (`employees/models.py`) nor `NonStaffIdentity`
(`authentication/nonstaff_models.py`) has a campus or level field of any
kind. The only "campus" mention anywhere near `Employee` is a docstring
comment about central auth's own, unrelated hierarchy (`Organization →
Institution → Branch`, where "each campus is a branch") — structurally
nothing to do with SMS's own `campus.models.Campus`/`classes.models.Level`.

**Confirmed via the import contract too:** `employees/sms_import.py`'s own
docstring states it explicitly: *"Fields intentionally NOT in the staff
contract: SMS's `campus` (SMS-local profile data — Phase A1 mapped this as
staying in SMS, not central identity)."* This is a locked prior design
decision, not an oversight — B1/B2's import deliberately drops campus. Fix
(a) (add a token claim) is off the table: there is nothing in central auth
to add a claim *from*. Forcing it in would mean either (i) violating the
Phase A1 identity-vs-profile split by writing SMS profile data into central
identity, or (ii) central auth silently going stale the moment SMS
reassigns a teacher to a different campus (central auth has no mechanism to
learn about that — no sync path exists or is planned for post-creation
profile changes, only creation-time identity sync).

**What the frontend actually needs it for:** grepped every caller of
`getUserCampusId()`/`getUserLevelId()` (10 files) — every one is either
**scoping an SMS API call** to "my campus" (e.g.
`principal/shift-timings/page.tsx`, `principal/timetable-settings/page.tsx`,
`admin/students/promotion/page.tsx`, `campus-management/level-management.tsx`,
`campus-management/grade-management.tsx`, `campus-management/classroom-management.tsx`)
or **pre-filling a form default** (`components/admin/teacher-form.tsx`,
`teacher-form/current-role-step.tsx`). None are used for routing, redirect,
or any auth decision. This confirms it: campus/level is pure SMS-side
scoping data, never an identity/authorization concern — exactly the kind of
thing Fix (b) (fetch from SMS, don't put in the token) is for.

**Chosen fix: (b).** Fetch campus/level from SMS itself, under the central
auth session, rather than changing what central auth's token carries.

## Gap 1 — implementation

staff-service already had the infrastructure this needed, built in Phase
C12 and extended by Coordinator's own `/me` action:
`Teacher.get_for_user()`/`Principal.get_for_user()`/`Coordinator.get_for_user()`
all resolve a `CentralAuthUser` via an exact `central_user_id` match, and
`CoordinatorViewSet` already had a `GET /me` action returning campus/level.
**Teacher and Principal didn't have the equivalent** — added both,
mirroring Coordinator's `me()` exactly:

- `teachers/views.py`: `GET /api/teachers/me/` → `Teacher.get_for_user(request.user)` → `TeacherSerializer` (already exposes `current_campus`, `campus_data`, `campus_name`).
- `principals/views.py`: `GET /api/principals/me/` → `Principal.get_for_user(request.user)` → `PrincipalSerializer` (already exposes `campus`, `campus_data`, `campus_name`).

**Frontend** (`api.ts`, inside `loginWithEmailPasswordCentral()` — still
only this one function, no new exported surface): after building `user`
from the login response, if `person_type === 'staff'`, bucket the role by
substring (`coord`/`teach`/`princip` — same style as `login/page.tsx`'s own
redirect logic) and fetch the matching `/me` endpoint with the just-issued
access token. Merges `campus_id`/`level_id` into `user` **under the exact
keys `getUserCampusId()`/`getUserLevelId()` already read**
(`profile?.campus_id`, `profile?.level_id`) — so **neither of those two
functions needed any change at all**. Best-effort: wrapped in try/catch,
never blocks login if the fetch fails or 404s (same "never block the
primary action on a secondary fetch" pattern already used elsewhere in this
codebase, e.g. `_notify_attendance_sync`, credentials-email sending).

## Gap 2 — the role-string mismatch: fix

Found the check in `frontend/src/app/login/page.tsx:738-743`. One-line
change — normalize spaces to underscores when building `userRole`, right
where it's already lowercased:
```ts
const userRole = String(data?.user?.role || "").toLowerCase().replace(/\s+/g, "_");
```
A no-op for legacy (its role strings never contain spaces). For central,
turns `"Accounts Officer"` → `"accounts officer"` (lowercased) →
`"accounts_officer"` (normalized), which now exact-matches. The other
checks (`.includes('coord')`, `.includes('teach')`) were already tolerant
of either form and are unaffected.

**This does touch a page file** (`src/app/login/page.tsx`), which the
original D-b4 prompt said to avoid — but this follow-up prompt explicitly
anticipated and permitted exactly this case ("if the role check is in a
page file, make the minimal edit and note it"). One line, noted here as
instructed.

## Proof — both gaps closed, for real synthetic accounts, live

Rebuilt `staff-service` (Dockerfile has no source bind-mount, needed a real
image rebuild to pick up the new `/me` actions). Seeded a synthetic
`Employee` (role=teacher) in central auth, then a matching local `Teacher`
row in staff-service with `central_user_id` set to that Employee's UUID
(simulating what `remap_central_user_ids` does) and a real `Campus`.

**Direct backend proof** — `/api/teachers/me/` resolves via the
central-issued token:
```
$ curl http://localhost:8004/api/teachers/me/ -H "Authorization: Bearer <login-sms token>"
→ 200 {"id":10,"current_campus":5,...,"central_user_id":"44a99767-...","campus_name":"D-b4-fix Test Campus",...}
```

**Full live browser proof** (Playwright + system Chrome, same method as
D-b4) — logged in through the real, unmodified `/login` page:
```
requests fired: [
  "POST http://localhost:8000/api/auth/login-sms",
  "GET http://localhost:8004/api/teachers/me/"
]
redirected to: http://localhost:3000/admin/students/student-list
sis_user: {"id":"44a99767-...","full_name":"D B4Fix Test Teacher","email":"...",
           "role":"teacher","person_type":"staff","services":["sms"],"perms":[],
           "campus_id":5}
```
`campus_id: 5` is present — `getUserCampusId()` now returns `5` instead of
`null` under this central-authenticated session. **Gap 1 closed.**

**Gap 2**, a second synthetic staff member with `role='accounts_officer'`:
```
$ curl .../login-sms -d '{"email":"d.b4fix.accountsofficer@...","password":"..."}'
→ principal.role = "Accounts Officer"
```
Logged in through the real `/login` page:
```
redirected to: http://localhost:3000/admin/fees
sis_user: {..., "role":"accounts officer", ...}
```
Redirected to `/admin/fees` — the exact branch that previously would have
fallen through to the `/admin` default. **Gap 2 closed.**

## VMS/HDMS unchanged

**No file under `Enterprise-Resource-Planning/` was touched in this phase
at all** — confirmed by `git diff --name-only`, which shows only:
```
School-Management-System-New/frontend/src/app/login/page.tsx
School-Management-System-New/frontend/src/lib/api.ts
School-Management-System-New/microservices/staff-service/principals/views.py
School-Management-System-New/microservices/staff-service/teachers/views.py
```
This is stronger than a diff-of-an-unchanged-file proof — central auth's
`authentication/api.py`/`jwt_utils.py` (home of `/login-vms`, `/login-hdms`,
and the token-claim logic) were never opened for editing this phase, so
VMS/HDMS token shape and login behavior cannot have changed. Live-checked
anyway:
```
$ curl -X POST .../login-vms -d '{"employee_code":"VMST-B1-G-26-V-0006","password":"VmsUser@123"}'
→ 401 {"error": "invalid_credentials", "detail": "Employee code not found or account inactive"}
```
Same result as D-b1's own proof of this exact call — that specific
synthetic VMS employee still isn't present in this dev DB (a pre-existing,
already-documented data-availability fact, not a regression).

## Legacy path unaffected

Neither gap's fix touches the `legacy` branch of `loginWithEmailPassword()`
or `authorizedFetch()` — the `/me`-fetch block is gated on
`principal?.person_type === 'staff'`, which only exists on the central
response shape; a legacy login's `data.user` never has a `person_type`
field, so this code path is simply never reached for `NEXT_PUBLIC_AUTH_SOURCE=legacy`
(the default). The role-string normalization in `login/page.tsx` is a
no-op for legacy role strings (already confirmed above).

## Cleanup

All synthetic data removed after proving: 2 `Employee` rows (`d.b4fix.teacher@...`,
`d.b4fix.accountsofficer@...`) plus their `UserCredentials`/`RefreshToken`
rows from central auth; the local `Teacher` row, its `users.User` row, and
the synthetic `Campus` fixture from `staff-service`.

## What's next

D-b5 and the actual retirement steps remain separate, later increments —
unchanged from D-b4's own closing note. This fix-phase only closes the two
named gaps; it doesn't turn any dual-run switch on anywhere real.
