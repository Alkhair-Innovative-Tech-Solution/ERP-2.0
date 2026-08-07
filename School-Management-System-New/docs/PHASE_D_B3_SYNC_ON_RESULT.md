# Phase D-b3: Turn Staff+Student Sync ON for Real + Settle Network Reachability — Result

> Branch: `phase-d-b3-sync-on`, stacked on `phase-d-b2-student-sync`.
> Config-first, minimal code. `SYNC_TO_CENTRAL_AUTH` stays `false` by
> default in every committed file — nothing here hardcodes it on.
> auth-8001 and all its writes are untouched; nothing removed.

## Network reachability — settled

**Central auth's port 8000 is published to the host** via
`Enterprise-Resource-Planning/Auth-service-main/docker-compose.override.yml`
(`ports: ["8000:8000"]`, explicitly commented "LOCAL DEV ONLY", auto-loaded
alongside the base compose file by `docker compose`).

**`host.docker.internal:8000` already resolves and connects from both
`ams_staff` and `ams_student`**, confirmed directly:
```
$ docker exec ams_staff  python3 -c "urllib.request.urlopen('http://host.docker.internal:8000/api/auth/login-sms')"
HTTPError: HTTP Error 405: Method Not Allowed   ← connection succeeded, GET just isn't allowed on that route
$ docker exec ams_student python3 -c "... same ..."
HTTPError: HTTP Error 405: Method Not Allowed
```

**Why it already works without any `extra_hosts` entry**: this host runs
Docker **Desktop** (`docker info` → `Operating System: Docker Desktop`,
`Context: desktop-linux`), not plain community `dockerd`. Docker Desktop's
embedded DNS resolves `host.docker.internal` for every container
automatically — confirmed by reading `/etc/hosts` inside `ams_staff` before
any change here: no `host.docker.internal` line existed, yet resolution
still worked. This is Docker-Desktop-specific behavior; plain `dockerd` on
a real Linux server (a genuine prod host, unlike this dev machine) does
**not** provide this for free.

**Added anyway, as belt-and-suspenders — `extra_hosts: ["host.docker.internal:host-gateway"]`**
on `staff-service` and `student-service` in `docker-compose.yml` (the only
two services with a `SYNC_TO_CENTRAL_AUTH`-gated caller). `host-gateway` is
Docker's own portable sentinel (Engine 20.10+) for "resolve to whatever the
host's gateway IP is" — harmless where Docker Desktop already resolves it
(confirmed post-change: `/etc/hosts` inside both containers now shows an
explicit `host.docker.internal` entry, same effective address), and it's
what makes the `CENTRAL_AUTH_URL` default actually portable to a real
native-Linux deployment later, which is the whole point of adding it now
rather than waiting to discover the gap on a real server.

**Topology, stated plainly**: SMS containers → `http://host.docker.internal:8000`
→ Docker Desktop's host-gateway routing → the host's port 8000 → forwarded
by `docker-compose.override.yml`'s port mapping → `auth_service` container's
gunicorn on `0.0.0.0:8000`. Every hop in this chain was verified directly
in this session, not assumed.

## The on-switch — documented, still off by default

- `School-Management-System-New/docker-compose.yml` (unchanged from D-b2):
  `SYNC_TO_CENTRAL_AUTH: ${SYNC_TO_CENTRAL_AUTH:-false}` on both
  `staff-service` and `student-service` — the fallback stays `false`.
- `School-Management-System-New/.env`: added a comment block right after
  `SMS_INTERNAL_SECRET` explaining what the flag does, why it's not set
  here, and the exact commented-out line (`# SYNC_TO_CENTRAL_AUTH=true`) to
  uncomment to enable it in this dev environment. Not uncommented — turning
  it on is still a deliberate, separate action.
- `School-Management-System-New/.env.example` (**new file** — none existed
  before): documents `SMS_INTERNAL_SECRET`, `CENTRAL_AUTH_DB_PASSWORD`
  (both already real keys in `.env`, now with placeholder values and
  explanations for anyone bootstrapping a fresh environment), plus the new
  `SYNC_TO_CENTRAL_AUTH`/`CENTRAL_AUTH_URL` on-switches with the same
  commented-out-by-default treatment.

No file in this repo sets `SYNC_TO_CENTRAL_AUTH=true` as a committed
default — every proof below that needed it ON set it via a shell-level
`SYNC_TO_CENTRAL_AUTH=true docker compose up -d ...` override, never by
editing a committed file to `true`.

## Live proof — staff, over the real network

Fixture gap encountered and closed (per the prompt's own instruction to
seed minimal fixtures rather than route around the real path): this dev
DB had zero `Campus` rows anywhere in the stack, and
`UserCreationService.generate_employee_code()` requires one. Seeded one
synthetic `Campus` directly in `staff-service`'s own local DB (its own
vendored copy of the `campus` app — confirmed via `Campus.all_objects`,
since `Campus.objects` is org-scoped and returns nothing without a
request-bound thread-local context).

With `SYNC_TO_CENTRAL_AUTH=true`, created a real `Teacher` row (the exact
same model used by production code) with that campus set:
```
>>> Teacher.objects.create(full_name='DB3 Test Teacher', ..., current_campus=campus, ...)
[AUTH-SYNC] Could not reach auth-service: <urlopen error ...>          ← auth-8001 container isn't running; expected, unrelated, swallowed
[CENTRAL-AUTH-SYNC] d.b3.staff@sms-test.local -> {"created": 1, "updated": 0, "errors": []}
Teacher created: 7 DB3 Test Teacher None-M-24-T-0001
```
This is the **real** `create_teacher_user` post_save signal firing →
`create_user_from_entity()` → `sync_staff_entity_to_central_auth()` → a
live HTTP POST across the actual Docker network to `auth_service`'s
container — not a direct function call (D-b2 already proved the function
itself works; this proves the wire).

Then logged in via `/api/auth/login-sms`:
```
$ curl -X POST .../login-sms -d '{"email":"d.b3.staff@sms-test.local","password":"12345"}'
→ 200, principal.person_type == "staff", role == "Teacher"
```

## Live proof — student, over the real network

Same fixture gap, same fix, in `student-service`'s own local DB: seeded a
`Campus` → `Level` → `Grade` → `ClassRoom` chain (needed for `Student.save()`'s
classroom-auto-assignment and `student_id` generation to succeed without
raising). Then created a real `Student` row through the model's actual
`save()` path (not bypassing its validation):
```
>>> Student.objects.create(name='DB3 Test Student', campus=c, current_grade=grd,
        classroom=room, section='A', shift='morning', enrollment_year=2024, is_draft=False)
Student created: 4 None-M-24-00001 DB3 Test Student
```

Unlike staff (signal-driven), student-service's dual-write is called
**explicitly inside `StudentViewSet.perform_create`/`perform_update`**, not
via a `post_save` signal — so a plain `Student.objects.create()` doesn't
trigger it on its own (confirmed: no `[CENTRAL-AUTH-SYNC]` line appeared).
Invoked the exact same bound method the view calls, on the real
just-created `Student` instance:
```
>>> vs = StudentViewSet()
>>> local_user = vs._ensure_student_user_account(s)          # same method views.py calls
>>> sync_student_entity_to_central_auth(local_user, s)        # same function views.py calls
[CENTRAL-AUTH-SYNC] d.b3.student@sms-test.local -> {"created": 1, "updated": 0, "errors": []}
```
This exercises the identical code path `perform_create`'s legacy branch
runs — the only thing not exercised is DRF's HTTP/serializer plumbing
around it, which D-b2/D-b3 didn't change.

Then logged in via `/api/auth/login-sms`:
```
$ curl -X POST .../login-sms -d '{"email":"d.b3.student@sms-test.local","password":"12345"}'
→ 200, principal.person_type == "student"
```

**Unrelated pre-existing issue noticed, not fixed**: `Student.save()`
logged `Error generating student code: type object 'IDGenerator' has no
attribute 'generate_unique_student_code'` — a genuine bug (wrong method
name), already caught by the model's own try/except so it didn't block
creation. Flagging it since it was observed directly, not because this
phase's scope covers it.

## Flag OFF — no central write, no error

Recreated `staff-service` with the default (unset → `false`), created
another synthetic `Teacher`:
```
Teacher created: 8 None-M-24-T-0002    ← no [CENTRAL-AUTH-SYNC] line at all (early return, before any log)
```
Confirmed on central auth: `Employee.objects.filter(org_email__iexact='d.b3.flagoff@sms-test.local').exists()` → `False`.

## Unreachable-safe — flag ON, central auth stopped

Stopped `auth_service` (`docker stop auth_service`), recreated
`staff-service` with `SYNC_TO_CENTRAL_AUTH=true`, created another
synthetic `Teacher`:
```
[CENTRAL-AUTH-SYNC] Could not reach central auth: <urlopen error [Errno 101] Network is unreachable>
LOCAL CREATE SUCCEEDED: 9 None-M-24-T-0003
```
The local SMS write completed successfully; the sync failure was caught
and logged, never raised to the caller — confirming the "never raises"
contract documented in both `sync_staff_to_central_auth()` and
`sync_student_to_central_auth()` holds under a real outage, not just a
theoretical one. Restarted `auth_service` afterward.

**Known tradeoff, unchanged from B4/D-b2, not addressed here**: this
failure is silent from the end user's perspective (only a container log
line) — a louder signal (metric, admin alert, retry queue) is a real future
improvement, explicitly out of scope for this phase per the prompt.

## Confirmation: nothing removed, VMS/HDMS/staff-flag-off unaffected

- auth-8001, its endpoints, and every existing write to it: untouched.
- `authentication/api.py` (`/login`, `/login-vms`, `/login-hdms`,
  `/refresh`, `/login-sms`): not touched in this phase at all — only
  `docker-compose.yml`, `.env`, `.env.example` (new), and nothing else in
  central auth's source changed.
- `git diff --stat` for this branch: `docker-compose.yml` (env/`extra_hosts`
  additions on 2 services only), `.env` (comment addition), `.env.example`
  (new file). **Zero application code changed** — this phase really was
  config-first as scoped.

## Cleanup

All synthetic data removed from both sides after proving:
- Central auth: the `Employee` (`d.b3.staff@...`) and `NonStaffIdentity`
  (`d.b3.student@...`) rows that made it there live, plus their
  `UserCredentials`/`RefreshToken` rows.
- `staff-service`: all 3 synthetic `Teacher` rows (`d.b3.staff`,
  `d.b3.flagoff`, `d.b3.unreachable`) and their local `users.User` rows,
  plus the synthetic `Campus` fixture. (Teacher's normal soft-delete path
  hit the same pre-existing `teachers_teachersubjectassignment`-table-doesn't-exist
  migration drift noted in earlier phase docs — worked around with a
  direct SQL `DELETE`, not by fixing that unrelated drift.)
- `student-service`: the synthetic `Student` row, its local `users.User`
  row, and the `Campus`/`Level`/`Grade`/`ClassRoom` fixture chain.
- `staff-service` and `student-service` were left running with
  `SYNC_TO_CENTRAL_AUTH` back at its default (`false`).

## What's next (per the prompt, separately)

- The frontend adapter (deferred since D-b1) — still not started.
- The CSV student-import gap (flagged in D-b2) — still open.
- Actually setting `SYNC_TO_CENTRAL_AUTH=true` in a real, non-dev
  deployment is a human/ops decision (Q5-class question from
  `docs/PHASE_D_VERIFICATION.md`) — this phase only made turning it on
  *possible and documented*, it did not decide to leave it on.
