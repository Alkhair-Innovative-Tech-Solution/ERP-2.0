# Phase D blockers-clear: Frontend's 3 auth-8001 Endpoints + Migration Drift — Result

> Branch: `phase-d-blockers-clear`. Dev, test-data only. Nothing removed —
> HS256/DB/dead code still stand for R4–R6. auth-8001 stays stopped
> throughout (restarted only transiently, as a side effect of the
> frontend's own `depends_on`, and re-stopped immediately each time before
> testing).

## Blocker 1 — the 3 frontend auth-8001 endpoints

### `current-user`

**Found 4 call sites**, not 1 — the two in `lib/api.ts`
(`getCurrentUserProfile()`/`refreshUserProfile()`) were already known, but
grepping the whole frontend surfaced two more, both raw
`apiGet("/api/current-user/")` calls bypassing the adapter entirely, in
`components/admin/user-profile-popup.tsx` (the logged-in-user avatar/photo
popup — one call on mount for the nav photo, one when the popup opens).

**Repointed** `getCurrentUserProfile()` (`lib/api.ts`): under
`NEXT_PUBLIC_AUTH_SOURCE=central`, returns `getStoredUserProfile()` — the
already-stored `sis_user` from localStorage (populated at login, and by
D-b4-fix's `/me` merge for `campus_id`/`level_id`) — **no network call at
all**. Central auth's own `/api/auth/me` was considered and rejected as the
target: it only resolves `Employee`/`SuperAdmin`, not `NonStaffIdentity`
(a known gap from D-b1, never fixed), so it can't serve students either
way — the stored token/adapter data is the more complete, more honest
source for both principal types.

`refreshUserProfile()` needed no separate change — it already calls
`getCurrentUserProfile()` internally, so it inherits the fix.

The two `user-profile-popup.tsx` call sites were **repointed to call
`getCurrentUserProfile()`** instead of the raw endpoint — a 2-line import +
2 call-site swap, the component's own logic (both already had defensive
`?.` chaining and a `catch` fallback) untouched otherwise. This is the one
"component must change" case from the rules — noted here as required,
kept to the minimum edit (no JSX/UI/rendering logic touched).

### `version`

`fetchSystemVersion()` — auth-8001's `/api/version/` is a genuine, separate
feature (`SystemVersion` model + a superadmin-only publish workflow,
`release_notes`, build numbers) with no central-auth or other-SMS-service
equivalent. Rebuilding that whole feature elsewhere would be a real,
unrelated feature migration — not attempted. Under central, this now skips
the network call and returns the frontend's own `package.json` version
(`3.3.6`, imported directly — `tsconfig.json` already has
`resolveJsonModule: true`) as `display: "v3.3.6"`. An honest, real value;
just not the same "admin can publish release notes" capability. Legacy
path unchanged, still calls the live endpoint.

### `sidebar-badges`

The one genuinely hard case. auth-8001's `sidebar_badges` view
(`users/views.py`) is not a simple data-fetch — it reaches directly into
**four other services' databases** (`result_db`, `timetable_db`,
`attendance_db`, `staff_db`) via raw `psycopg2`, branching on the legacy
`_TokenUser`'s plain `.role` string (`'coordinator'`, `'principal'`, ...).
`CentralAuthUser` has no equivalent generic `.role` attribute (only
`person_type`/`vms_role` — see D-b4-fix). There is no single SMS service
that owns this data; properly rebuilding it as a central-auth-aware,
per-service-delegating aggregator is a real multi-service project, not a
repoint. **Flagged, not faked or half-built**, per the rules.

Added `getSidebarBadges()` to `lib/api.ts`: under central, returns `{}`
immediately (no request attempted). The one caller
(`admin-sidebar.tsx`, a raw `apiGet("/api/sidebar-badges/")` — also not
previously routed through `lib/api.ts`) was swapped to call it instead —
same minimal one-line UI change as `user-profile-popup.tsx`. The component
already treated a failed/empty result as "no badges" (its own comment:
*"Failures are silent — badges just don't show"*), so visible behavior is
unchanged from today's failure state — the only difference is there's no
longer an actual failed network request against a stopped host.

### Proof — auth-8001 stopped, frontend loads clean

Rebuilt the frontend (all 3 fixes are build-time-baked
`NEXT_PUBLIC_AUTH_SOURCE` branches). Stopped `ams_auth` again (it restarts
as a side effect of `docker compose up frontend`'s `depends_on`). Real
browser run (Playwright, system Chrome):
```
version text found: v3.3.6
redirected to: http://localhost:3000/admin/students/student-list
sis_user: {..., "role":"teacher", "person_type":"staff", ...}
any requests to :8001 or /api/current-user/ (should be NONE): []
```
Zero failed/error requests to auth-8001 or `/api/current-user/` anywhere
in the full login-through-dashboard flow — confirmed on the *second* run,
after finding and fixing the two extra `user-profile-popup.tsx` call sites
the first run caught (`http://localhost:8090/api/current-user/ -> net::ERR_FAILED`,
proxied through the gateway, which is why grepping for the literal string
`:8001` alone in the first pass missed it).

## Blocker 2 — migration drift across `teachers/`-vendoring services

**All services vendoring `teachers/` from staff-service** (confirmed via
`grep` on every `Dockerfile`, 9 total): `student-service`,
`attendance-service` (already fixed in R1), `result-service`,
`campus-service`, `subject-service`, `content-service`, `fees-service`,
`timetable-service`, `support-service`.

**Each keeps its own independent migration history** via Django's
`MIGRATION_MODULES` setting (checked every service's `settings.py`
directly) — a deliberate design so 9 services can each apply the shared
`teachers/` model on their own schedule without fighting over one shared
migrations folder:

| Service | Migration module | Drift found? |
|---|---|---|
| staff-service (source) | `teachers_staff_migrations` | N/A — has `0008`, the source of truth |
| attendance-service | `teachers_attendance_migrations` | Fixed in R1 (before this phase) |
| student-service | `teachers_student_migrations` | **Yes** — stuck at `0007`, missing `0008` |
| result-service | `teachers_result_migrations` | **Yes** — same |
| campus-service | `teachers_campus_migrations` | **Yes** — same |
| subject-service | `teachers_campus_migrations` (vendors campus-service's copy at build time — confirmed via Dockerfile) | **Yes** — same, inherited from campus-service |
| content-service | `teachers_campus_migrations` (same vendoring as subject-service) | **Yes** — same |
| fees-service | `teachers_fees_migrations` | **Yes** — same |
| support-service | `teachers_support_migrations` | **Yes** — same |
| timetable-service | *(none — no `MIGRATION_MODULES` override at all)* | **Yes**, differently — see below |

**timetable-service is structurally different**: it has no per-service
override, so it falls back to the *default* location bundled inside the
vendored `teachers/` directory itself
(`microservices/staff-service/teachers/migrations/` — a folder staff-service
itself never actually uses, since staff-service redirects `teachers`
elsewhere). That default folder's own history had consolidated what the
per-service copies split into `0006`+`0007` into a single `0006`, and was
missing the `central_*`/`tenant_id` fields entirely (same underlying gap,
different local numbering — confirmed by reading both the model and this
folder's actual migration content, not assumed).

### Fix

Same fix as R1's attendance-service repair, applied additively — one new
migration per independent history, adding exactly
`central_user_id`/`tenant_id`/`central_classroom_assigned_by_id`, nothing
rewritten or reordered:
- `student-service/teachers_student_migrations/0008_...py`
- `result-service/teachers_result_migrations/0008_...py`
- `campus-service/teachers_campus_migrations/0008_...py` (this one file
  also fixes subject-service and content-service, since both vendor this
  exact directory at Docker build time — confirmed by reading their
  Dockerfiles, not guessed)
- `fees-service/teachers_fees_migrations/0008_...py`
- `support-service/teachers_support_migrations/0008_...py`
- `staff-service/teachers/migrations/0007_...py` (the *default* location —
  numbered `0007` here since this folder's own chain only reaches `0006`;
  this is the file timetable-service actually vendors and uses)

### Proof — all clean

Rebuilt and recreated all 9 services (plus staff-service itself).
`showmigrations teachers` confirms every one now applies its `0008` (or,
for timetable-service, its equivalent `0007`). Verified past the
migration-recorder layer, directly against each service's live schema:
```
$ for svc in student result campus subject content fees support timetable staff attendance; do
    check column_name IN ('central_user_id','tenant_id','central_classroom_assigned_by_id')
  done
→ ['central_classroom_assigned_by_id', 'central_user_id', 'tenant_id']   (all 10, every service)
```

**`makemigrations --check` note**: every service except timetable-service
still reports one pending change — `+ Create model TeacherSubjectAssignment`.
This is **not new drift** — it's the same pre-existing, already-documented
phantom migration flagged in Phase C12's own result doc and reconfirmed in
every subsequent phase that has touched this migration history (most
recently R1's own attendance-service fix): `TeacherSubjectAssignment`'s FK
to `timetable.subject` can't resolve in any service other than
timetable-service itself (the only one with `timetable` actually
installed), so it has never had a real migration and is deliberately left
uncreated. `timetable-service` is the one service where this model *can*
resolve, and its own history already has it (`0005_teachersubjectassignment`,
applied) — correctly showing "No changes detected." Every central-auth-relevant
field is confirmed clean by the direct column check above, which is the
authoritative signal here, not the phantom-model noise in `--check`'s raw
output.

## Re-ran the R1–R3 through-line

With a fresh synthetic staff member, real campus fixture, and auth-8001
stopped throughout (only transiently restarted by `depends_on` side
effects, re-stopped before each check):
```
Teacher created → [AUTH-SYNC] Skipped (WRITE_TO_AUTH_8001=false), [CENTRAL-AUTH-SYNC] created:1
POST /api/auth/login-sms → 200, principal resolved correctly
GET /api/result/ → 200
GET /api/attendance/review/ → 403 (correct fail-closed, no crash — confirms Blocker 2's fix holds)
POST /api/auth/login-vms (VMS) → 401, same pre-existing data-availability result as every prior phase
auth-8001 container: confirmed stopped
```

## Confirmation: nothing removed

No file under `Enterprise-Resource-Planning/` touched. No `dual_auth.py`
opened. `postgres-auth`/`auth_db` untouched. auth-8001's container/image/
volume all still present — only ever `stop`ped, and only as a side effect
of testing (immediately re-stopped after). `WRITE_TO_AUTH_8001` and
`SYNC_TO_CENTRAL_AUTH` unchanged from R1–R3's settings.

## Cleanup

Synthetic `Employee` rows (`blockers.verify.staff@...`,
`d.r1.staff@...` — re-seeded for this phase's own testing) plus their
`UserCredentials`/`RefreshToken` rows deleted from central auth. Matching
local `Teacher`, `users.User`, and `Campus` rows deleted from staff-service.
Temporary Playwright test scripts removed.

## What's next

R4–R6 (remove HS256 per service, drop `postgres-auth`, delete dead code/
secret/compose entries) is the final prompt. Two smaller items surfaced
here that don't block it but are worth knowing about:
- `CURRENT_USER_UPLOAD_PHOTO` (`/api/current-user/upload-photo/`) shares
  the same auth-8001-only prefix as the 3 endpoints fixed here, but wasn't
  one of the named 3 — it'll still fail under central (2 callers:
  `unified-profile.tsx`, `accounts_officer/profile/page.tsx`). Not touched,
  flagged for whoever picks it up.
- `sidebar-badges`'s real fix (a central-auth-aware, per-service
  aggregator) is still an open, multi-service project — this phase only
  stopped it from failing loudly, it didn't rebuild the feature.
