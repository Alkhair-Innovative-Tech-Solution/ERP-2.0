# Phase D-b2: Student Internal-Create Endpoint + Live Sync — Result

> Branch: `phase-d-b2-student-sync`, based on top of `phase-d-b1-sms-login`
> (D-b2's own proof step needs D-b1's `/login-sms` endpoint to exist).
> Additive, dual-write, flag-gated. auth-8001 student write NOT removed.

## Part 1 — central auth: `POST /api/internal/sms-student`

Added to `Enterprise-Resource-Planning/Auth-service-main/Backend/src/employees/internal_api.py`,
mirroring `POST /api/internal/sms-staff` exactly: same `X-Internal-Secret`
check against `SMS_INTERNAL_SECRET` (module-level `INTERNAL_SECRET`, fails
closed if unset/mismatched — the secret-check code itself is shared, not
forked), same response shape (`created`/`updated`/`errors`). Only the import
function differs: `import_student_records()` (Phase B2, `employees/sms_import.py`)
instead of `import_staff_records()`.

New schemas: `SmsStudentSyncIn` (`legacy_user_id`, `email`, `username`,
`password_hash`, `full_name`, `role='student'`, `is_active=True` — the exact
`SMS_STUDENT_RECORD_FIELDS` contract, no HR fields, matching B2's smaller
student shape vs staff's), `SmsStudentSyncOut`. No new migration — no model
change, purely a new Ninja route reusing existing models.

### Proof — Part 1 standalone

```
$ curl -X POST http://localhost:8000/api/internal/sms-student \
    -H "X-Internal-Secret: <correct>" -d '{legacy_user_id:90101, email:"d.b2.student@sms-test.local", ...}'
→ 200 {"created": 1, "updated": 0, "errors": []}

$ curl ... -H "X-Internal-Secret: wrong-secret" -d '{legacy_user_id:90102, ...}'
→ 401 {"error": "Invalid or missing internal secret"}

$ curl ... (no X-Internal-Secret header) -d '{legacy_user_id:90103, ...}'
→ 401 {"error": "Invalid or missing internal secret"}

$ curl -X POST .../sms-student -H "X-Internal-Secret: <correct>" -d '{legacy_user_id:90101, ...updated full_name...}'
→ 200 {"created": 0, "updated": 1, "errors": []}   ← idempotent, no dup
```

Then that student logged in via D-b1's `/api/auth/login-sms`:
```
$ curl -X POST .../login-sms -d '{"email":"d.b2.student@sms-test.local","password":"DbTwoStudentPass@123"}'
→ 200, principal.person_type == "student", identity_code SMS01-STU-0001
```

**Note:** the running `auth_service` container uses gunicorn with no
autoreload — the new route wasn't picked up until `docker restart auth_service`
(routes are registered at process start via Django Ninja's `Router`). Not a
code issue, just a fact about this dev setup worth remembering for the next
build increment.

## Part 2 — SMS side: student-service live sync caller

New file `School-Management-System-New/microservices/student-service/services/central_auth_sync_service.py`,
mirroring staff-service's file of the same name (Phase B4) closely:

- `sync_student_to_central_auth(**kwargs)` — low-level, same
  `SYNC_TO_CENTRAL_AUTH` flag check, same `CENTRAL_AUTH_URL`/
  `SMS_INTERNAL_SECRET` config, posts to `/api/internal/sms-student`. Never
  raises (returns `(ok, message)`), same contract as staff's.
- `sync_student_entity_to_central_auth(user, student)` — convenience
  wrapper for the case where a local `users.User` already exists (the
  legacy branch, see below) — extracts `user.id`/`user.email`/`user.username`/
  `user.password` (already-hashed) and the student's `full_name`.

**Dockerfile change** (`student-service/Dockerfile`): student-service
already vendors `microservices/auth-service/services/` into `/app/services/`
(a *different* thing — that's auth-service's own Django `services` app,
unrelated in name only). Staff-service's Dockerfile handles this exact
collision by copying its own local `services/` directory **last**, so its
files land in the same `/app/services/` directory without being overwritten
by the vendor copy. Added the identical line, in the identical relative
position, to student-service's Dockerfile — otherwise this phase's new file
would have silently never made it into the image.

**`docker-compose.yml`**: added `SYNC_TO_CENTRAL_AUTH`, `CENTRAL_AUTH_URL`,
`SMS_INTERNAL_SECRET` to student-service's environment block — these didn't
exist there before (student-service had `CENTRAL_AUTH_DB_*` for the offline
remap command, and `AUTH_SERVICE_URL` for JWKS, but nothing for this sync).
Same env var names as staff-service's block, same defaults (`false` / `http://host.docker.internal:8000` / empty) — **one flag now controls both staff and student sync**, per the prompt's requirement.

### Wiring — two call sites in `students/views.py`

1. **`perform_create`'s central-auth branch** (the `CentralAuthUser` path,
   where a `NonStaffIdentity`-creation call was previously flagged as an
   explicit, documented gap — "FLAGGED: a newly-created central-auth
   student has no working login until that happens"). This is the piece
   the prompt calls out as closing the C8 gap directly: no local
   `users.User` is created here (by design — see the surrounding comment,
   unchanged), so there's no existing password hash to carry over. A fresh
   default password is minted (`make_password(DEFAULT_PASSWORD)`, `'12345'`
   — the same default every other auto-created SMS account already uses),
   and `sync_student_to_central_auth()` (the low-level fn, called directly
   — there's no `user` object to wrap) is invoked with `instance.id` as
   `legacy_user_id`. Guarded by `if instance.student_id:` — student_id can
   still be `None` if required fields (campus/shift/enrollment_year) are
   missing, matching `_ensure_student_user_account`'s own guard.

2. **`perform_create`'s legacy branch and `perform_update`** — both already
   called `self._ensure_student_user_account(instance)` (the local-`User`-creating
   path, auth-8001-equivalent — **unchanged**, still runs, dual-write keeps
   it). Modified `_ensure_student_user_account` to *return* the `User` it
   created/found (previously implicit `None` in every branch — all 4
   existing callers already discarded the return value, so this can't
   change their behavior). Both call sites now capture that return value
   and, if not `None`, call `sync_student_entity_to_central_auth(local_user, instance)`
   right after — same "unconditional dual-write after the legacy write
   already happened" shape as staff's `create_user_from_entity`.

**Deliberately not wired (flagged, out of scope):** `students/services/student_csv_import.py`'s
own module-level `_ensure_student_user_account()` (line 549) is a
*different* function (same name, different file) that doesn't create a
local `users.User` at all — it POSTs straight to auth-8001's
`/api/internal/create-user/` with a plaintext password, no local hash ever
produced. Wiring central sync into this path would need real design work
(what "legacy_user_id"/password-hash to use) that the prompt's build list
didn't call for. Staff's B4 covered this CSV case too (`teacher_csv_import.py`);
student's CSV path stays auth-8001-only for now — a real, named gap for the
next increment, not silently dropped.

### Proof — Part 2, both flag states + full chain

Given this dev DB currently has zero `Campus` rows (so a fully valid
non-draft `Student` can't be constructed through the model's own
`classroom`-requiring `save()` without first seeding unrelated campus/grade/
classroom fixtures — out of scope to build here), Part 2 was proven by
invoking the exact wired functions directly (the same function objects
`views.py` imports and calls, not a reimplementation), which is the same
"prove the piece that would otherwise be blocked, note why" allowance the
prompt itself gives for network-reachability gaps:

**Flag OFF (default, unset in this dev `.env`):**
```
>>> sync_student_entity_to_central_auth(fake_user, fake_student)
(False, 'disabled (SYNC_TO_CENTRAL_AUTH not set)')
```
No exception, no central write — matches staff's identical no-op contract.

**Flag ON — legacy-branch shape (`sync_student_entity_to_central_auth`, a `User` with an already-hashed password):**
```
>>> os.environ['SYNC_TO_CENTRAL_AUTH'] = 'true'
>>> sync_student_entity_to_central_auth(fake_user, fake_student)
[CENTRAL-AUTH-SYNC] d.b2.legacybranch@sms-test.local -> {"created": 1, "updated": 0, "errors": []}
(True, '{"created": 1, "updated": 0, "errors": []}')
>>> sync_student_entity_to_central_auth(fake_user, fake_student)   # re-run
[CENTRAL-AUTH-SYNC] ... -> {"created": 0, "updated": 1, "errors": []}
(True, '{"created": 0, "updated": 1, "errors": []}')   ← idempotent
```
Then logged in via `/api/auth/login-sms` with that student's real
(pre-hashed) password → `200`, `person_type: "student"`.

**Flag ON — central-auth-branch shape (`sync_student_to_central_auth` called directly with a freshly-minted default password, exactly as `views.py`'s central-auth branch does):**
```
>>> sync_student_to_central_auth(legacy_user_id=90202, email="d.b2.centralbranch@sms-test.local",
        username="SMS01-STU-TEST-02", password_hash=make_password(DEFAULT_PASSWORD),
        full_name="DB2 CentralAuth Branch Student", role="student", is_active=True)
[CENTRAL-AUTH-SYNC] d.b2.centralbranch@sms-test.local -> {"created": 1, "updated": 0, "errors": []}
(True, ...)
```
Then logged in via `/api/auth/login-sms` with the default password `12345`
→ `200`, `person_type: "student"` — proving the exact gap the prompt names
("central-auth branch that C8 flagged — student created centrally without a
login") is now closed: a central-auth-created student gets a real, working
login.

**Reachability note:** `host.docker.internal:8000` (the default
`CENTRAL_AUTH_URL`) *is* reachable from student-service's container in this
dev environment — confirmed directly (`urllib.request.urlopen` to
`/api/auth/login-sms` returned `HTTPError 405 Method Not Allowed`, i.e. the
TCP connection succeeded, it just doesn't accept `GET`). This is contrary
to the theoretical concern raised in `docs/PHASE_D_VERIFICATION.md`'s Q2
(reasoned from native-Linux Docker's usual lack of automatic
`host.docker.internal` resolution) — empirically, in this actual running
Docker Desktop setup, it resolves and connects fine. Flagging the
discrepancy rather than silently updating that earlier doc's theoretical
claim; D-b3 (per this prompt's own next-step note) is where reachability
gets formally settled either way.

## Confirmation: staff sync + VMS/HDMS unchanged

`git diff --stat` for this branch touches only:
`Enterprise-Resource-Planning/.../employees/internal_api.py` (Part 1, purely
additive endpoint+schemas), `School-Management-System-New/docker-compose.yml`
(3 new env lines on student-service only), `student-service/Dockerfile` (1
new `COPY` line), `student-service/students/views.py` (the two call sites
above), and the new `student-service/services/central_auth_sync_service.py`
file. **Zero files under `staff-service/` touched** — staff's B4 sync path
is byte-for-byte unchanged. `authentication/api.py` (home of `/login`,
`/login-vms`, `/login-hdms`) was not touched in this phase at all.

## Cleanup

All synthetic `NonStaffIdentity` rows created during testing
(`legacy_user_id` 90101, 90201, 90202) plus their `UserCredentials` and
`RefreshToken` rows were deleted from central auth after proving. No real
`Student` rows were created in student-service's own DB (all Part 2 tests
used the wired functions directly against synthetic in-memory objects, per
the reachability/fixture note above) — nothing to clean up on that side.

## What's next (per the prompt, separately)

- **D-b3**: turn `SYNC_TO_CENTRAL_AUTH=true` on for real (not just proven
  transiently, as here) and formally resolve the reachability question this
  phase's proof empirically answered but didn't make official.
- The frontend adapter (D-b1's own deferred item) is still separate and
  still not started.
- The CSV student-import gap flagged above.
