# SMS Migration Phase B0 — Pre-Flight Data Audit — Result

Analysis only, per `SMS_PHASE_B_USER_IMPORT_PLAN.md`'s B0 scope. No writes
to SMS data (one exception, explained below — my own leftover test
artifacts, not SMS data). No branch created (matches the A1 precedent —
pure analysis, no code change).

## Headline finding: this environment has no real SMS user data yet

Every SMS database in this local dev stack was checked directly:

| Service DB | Container | `users_user` rows | Notes |
|---|---|---|---|
| `auth_db` (canonical — plan line 11 names this the one SMS auth-8001 actually logs in against) | `ams_db_auth` | **0** (2 found, both my own Phase A3 test artifacts — deleted, see below) | |
| `org_db` | `ams_db_org` | **0 tables at all** | Docker volume didn't exist until I started it just now — org-service has never been run in this environment |
| `staff_db` | `ams_db_staff` | 0 | Already clean from Phase A3's own test-data cleanup |
| `campus_db` | `ams_db_campus` | 0 | |
| all 10 other services (attendance, content, fees, notification, result, subject, support, timetable, student-service, ai) | — | **never started** | No Docker volume exists for any of them — confirmed via `docker volume ls`, none have ever been migrated in this environment |

**This is a fresh/empty local dev stack, not a populated staging or
production instance.** Every "user" I found (2 rows) was my own residue
from Phase A3 live-testing — SMS's `UserCreationService.create_user_from_entity`
silently syncs every new coordinator to `auth_db` via an internal HTTP
call to SMS's own auth-service (`_sync_user_to_auth`,
`services/user_creation_service.py`), a side channel I hadn't accounted
for when cleaning up `staff_db` at the end of Phase A3. Found and deleted
those 2 rows before running this audit, so they don't pollute it:

```
docker exec ams_db_auth psql -U auth_user -d auth_db -c "DELETE FROM users_user WHERE username IN ('TESTC1-M-26-C-0003', 'NOMATCH-CODE-0099');"
-> DELETE 2
```

## B0's questions, answered against what's here

1. **Unique, non-null email for every user?** N/A — 0 users. No
   duplicates or nulls to report, but this check has not been exercised
   against real data and should be re-run the moment real data is
   available (see "What this means for B1" below) — an empty result set
   trivially passes, it doesn't prove the check logic is right. (It's a
   simple `GROUP BY LOWER(email) HAVING COUNT(*) > 1` — low risk, but
   flagging the caveat explicitly per "distinguish what the code IS from
   what you infer.")
2. **Total users, by role (11 roles), staff vs student?** 0 total. No
   distribution to report.
3. **Which SMS users already exist in central auth (leaked syncs)?**
   Checked central auth directly: `Employee.objects.filter(tenant__tenant_code='SMS01').count()`
   → **0**. `NonStaffIdentity.objects.filter(tenant__tenant_code='SMS01').count()`
   → **0** (expected — A2 only proved the model works, then deleted its
   test row). Central auth has 2 `Employee` rows total, system-wide — both
   pre-existing VMS/HDMS test employees, unrelated to SMS. **No leakage.**
4. **Is `SMS01` the right destination for all of them?** Confirmed intact
   from Increment 4b: `Tenant(tenant_code='SMS01')` id
   `2d34b292-311c-4fff-9144-a9ecb3015cb9`, with its `Organization` ("SMS
   School") attached. Ready to receive.

## Bonus: resolved one of the plan's "Decisions needed before B1" from code

**Decision 1 (password hash compatibility)** is answerable without live
data, from code inspection:

- SMS's user creation (`staff-service/services/user_creation_service.py`)
  hashes passwords via `django.contrib.auth.hashers.make_password` — Django's
  own default hasher (no `PASSWORD_HASHERS` override found in either
  service's settings — checked both directly, neither overrides it).
- Central auth's `UserCredentials.set_password()`
  (`authentication/models.py`) uses the exact same
  `django.contrib.auth.hashers.make_password`/`check_password` pair.
- Both are on Django 5.x (SMS: 5.2.16, central auth: 5.0.1) — the default
  PBKDF2-SHA256 hash format (`pbkdf2_sha256$<iterations>$<salt>$<hash>`)
  is self-describing and unchanged across this version range.

**High-confidence answer: yes, SMS's stored password hashes should carry
over into `UserCredentials.password_hash` as-is** — no re-hash, no forced
reset needed on migration, purely on the strength of both sides using
Django's own default hasher with no divergence. This is **not empirically
verified** (there are no real password hashes anywhere in this environment
to round-trip test), so B1 should still do one direct verification as its
first step before trusting this at scale: copy one real hash, confirm
`check_password()` against a known password succeeds on the central-auth
side too.

## What this means for B1

B1 ("prove it on staff only, start with a handful") **cannot be
meaningfully exercised in this environment** — there's nothing to import.
Two ways forward, and this needs your call before B1 starts:

1. **Point me at real data.** If SMS has a staging or production database
   with actual users, B1 needs connection details for it (a new
   `DATABASE_URL`-equivalent, likely not something I should default to
   assuming I have — this is exactly the kind of access decision I
   shouldn't make unilaterally).
2. **Seed synthetic test data first.** I build a small, clearly-fake batch
   (a handful of coordinators/teachers/students with obviously-synthetic
   emails, matching the pattern VMS/HDMS test accounts already use in this
   stack — `VMST-B1-G-26-V-0001` etc.) directly in this dev environment,
   then run B1 against that to prove the mechanism end-to-end. This
   doesn't touch anything real, but also doesn't prove anything about
   real SMS data quality (duplicate emails, etc.) — only that the
   *mechanism* works.

Either way, the duplicate/null-email check (B0 question 1) needs to be
re-run against whatever real dataset eventually gets used — this run only
proves the query is correct, not that real data passes it.

## Infrastructure confirmed ready

- `auth_db`, `org_db` (schema not yet migrated — 0 tables), `staff_db`,
  `campus_db` all reachable and clean.
- Central auth's `SMS01` tenant + organization intact, zero
  `Employee`/`NonStaffIdentity` rows under it — a clean destination.
- Password hash scheme confirmed compatible by code inspection (not yet
  empirically verified).

## Nothing else touched

No SMS data was written (the 2 deleted rows were my own artifacts, not
SMS user data — deleting them restores the pre-Phase-A3 state, it doesn't
remove anything real). No central auth identities created. No migrations
run anywhere in this step.
