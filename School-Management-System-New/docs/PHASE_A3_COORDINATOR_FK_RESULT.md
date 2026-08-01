# Phase A3: Coordinator → User Real FK — Result

Branch: `phase-a3-coordinator-fk` (not merged to `main`). Scoped to
`staff-service/coordinator/` only. Teacher, Principal, the `User` model,
and every other service are untouched.

## The fix

`Coordinator.user = OneToOneField(User, on_delete=SET_NULL, null=True,
blank=True, related_name='coordinator_profile')` — added at
`coordinator/models.py`, same shape as `Teacher.user`
(`teachers/models.py:70`).

Two additive migrations:
- `coordinator/migrations/0004_coordinator_user.py` — schema only, nullable `AddField`.
- `coordinator/migrations/0005_backfill_coordinator_user.py` — data migration.
  Backfills every coordinator with `user__isnull=True` by matching
  `User.username == Coordinator.employee_code` (the existing convention),
  prints matched/unmatched counts and lists unmatched rows, invents no link.

## Backfill result on the real dev DB

The dev `staff_db` had **zero** coordinators at run time:

```
docker exec ams_staff python manage.py migrate coordinator
Applying coordinator.0004_coordinator_user... OK
Applying coordinator.0005_backfill_coordinator_user...
[Coordinator FK backfill] matched: 0, unmatched: 0
 OK
```

Confirmed via shell: `Coordinator.objects.with_deleted().count() == 0`. No
orphans to report because there was no data to be orphaned — this
environment has no coordinators yet. Ran a separate, isolated fixture test
(created via `bulk_create`, bypassing all signals, then deleted afterward)
to prove the matching logic itself is correct against non-trivial data —
see below.

```
Fixtures: coordinator "BKFMATCH-0001" (employee_code matches an existing
User's username) + coordinator "BKFNOMATCH-0002" (employee_code matches no
User).

[Coordinator FK backfill] matched: 1, unmatched: 1
[Coordinator FK backfill] unmatched coordinators (id, full_name, employee_code):
  (8, 'Backfill Unmatched Test', 'BKFNOMATCH-0002')

to_match.user_id after backfill: 6 -> linked to username: BKFMATCH-0001
unmatched.user_id after backfill: None (expected: None, no invented link)
```

Matched coordinator got linked; unmatched one was correctly left
`user=NULL` and reported, not guessed. All test fixtures deleted afterward
— nothing left in the DB from this proof.

## `save()` reconciliation

`coordinator/models.py`'s employee_code-change block (previously
`coordinator/models.py:187-194`) now reads:

```python
target_user = self.user
if not target_user:
    target_user = User.objects.filter(username=old_code).first()
    if target_user:
        self.user = target_user
if target_user:
    target_user.username = new_code
    ...
```

FK (`self.user`) is used first; the old string lookup only runs as a
fallback for a coordinator the backfill couldn't match (a pre-existing
orphan), and if it succeeds there, the FK is set going forward so it
self-heals. No behavior is lost — the block still renames/re-syncs the
linked `User` exactly as before, it just trusts the FK over a fresh guess.

**Proved directly** (not via the live campus/shift-change path — see
"Pre-existing bug found" below — but by exercising the exact logic
against a drift scenario, which is the actual failure mode the prompt is
about):

```
coordinator.user_id (FK): 1, employee_code: TESTC1-M-26-C-0003
linked user username: TESTC1-M-26-C-0003

--- Simulate drift: rename the linked User's username so it no longer
    matches employee_code (exactly the scenario the string-match approach
    could never survive) ---
user.username -> 'DRIFTED-USERNAME-DOES-NOT-MATCH'

OLD logic (User.objects.filter(username=employee_code)) would find: None
NEW logic (self.user, the FK) still finds: Phase A3 Test Coordinator
Same underlying user row: True
```

This is the direct proof of the fix's purpose: once the FK exists, a
username drift that would have **silently severed** the old string-match
link no longer breaks anything, because the FK doesn't care what the
username currently says.

## Scope expansion beyond the 4 listed steps — and why

The prompt's problem statement pointed at one string-match block in
`coordinator/models.py:187-194`. While building, I found the *same*
fragility independently duplicated in `coordinator/signals.py` —
`create_coordinator_user` (fires on every new Coordinator, creates the
`User` via `UserCreationService`) and its deferred-creation twin
`on_assigned_levels_changed` (the `shift='both'` path, where `User`
creation waits for `assigned_levels` to be set via M2M) **never set the
new FK at all**. Left as-is, every newly created coordinator would get
`user=NULL` forever — directly contradicting the prompt's own test
criterion ("create a coordinator, confirm user FK auto-links").

Fixed both handlers to link `instance.user` (via `Coordinator.objects.filter
(pk=...).update(user=...)`, not `instance.save()`, to avoid re-entering
`post_save` recursively) right after the `User` is found or created.
Verified live — see "Create + auto-link" proof below. Left the other three
signal handlers (`notify_coordinator_on_update`, `delete_user_when_coordinator_deleted`,
`sync_coordinator_to_user`) untouched: they're not part of the "Done"
checklist (create/edit/employee_code-change), and touching delete
semantics in particular carries more risk than the prompt asked for.

Still entirely inside `coordinator/` — no other service, no Teacher, no
Principal touched.

## Pre-existing bug found (not fixed — out of scope)

The campus/shift-change employee_code regeneration block (the block
containing the string-match fix) calls `IDGenerator.generate_employee_code(...)`
— **this method does not exist** on `IDGenerator` (only
`generate_org_employee_code` does). The call raises `AttributeError`,
silently swallowed by a bare `except Exception: pass` wrapping the whole
block. This means the "regenerate employee_code when campus/shift
changes" feature has never actually worked, for any reason, since before
this change.

**Confirmed not mine and not Coordinator-specific**: the identical call
exists verbatim in `teachers/models.py:274` and `principals/models.py:185`
— it's a latent bug shared by all three models, predating this step. Per
the rules ("Do NOT change Teacher, Principal"), I did not touch it. It's
also why the reconciliation code above couldn't be demonstrated by
triggering a real campus/shift change live (the outer block never
reaches it) — hence proving it via a direct drift simulation instead,
which exercises the exact same lines. Flagging this for a separate,
explicit fix if wanted — it affects Teacher and Principal identically and
is unrelated to the Coordinator FK work.

## Create + auto-link — proved live

```
Coordinator.objects.create(campus=..., level=..., full_name='Phase A3 Test Coordinator', ...)

[OK] Created user for coordinator: Phase A3 Test Coordinator (TESTC1-M-26-C-0003)
coordinator id: 3
employee_code: TESTC1-M-26-C-0003
user linked: Phase A3 Test Coordinator (Teacher Coordinator)
user.username: TESTC1-M-26-C-0003
FK auto-linked correctly: True
```

Went through the real signal path end-to-end, including the SMS-local
auth-service sync call (`[AUTH-SYNC] User ... created in auth-service
(status 201)`) — nothing about that path was bypassed.

## Verify — all three required behaviors confirmed

- **Create**: proved above — FK set automatically, no manual linking needed.
- **Employee_code change**: the *reconciliation logic itself* proved via
  drift simulation (the campus/shift-change trigger path is unreachable
  due to the pre-existing bug documented above, in both old and new code).
- **Edit**: exercised via the campus-change test (`c.campus = campus2;
  c.save()`) — `notify_coordinator_on_update` and `sync_coordinator_to_user`
  signals fired normally, Coordinator saved without error, FK stayed
  intact throughout.

```
manage.py migrate coordinator  -> 0004, 0005 applied OK
manage.py check                -> System check identified no issues (2 silenced)
manage.py test coordinator     -> 0 tests (coordinator/tests.py is an empty scaffold — pre-existing, not part of this change)
```

All test fixtures (coordinators, users, campus, level) created during
verification were deleted afterward — the dev DB is back to its original
empty state.

## Confirmed untouched

- `Teacher`, `Principal` models and their `save()`/signals: not modified.
- `users.User` model: not modified.
- Every service other than `staff-service`: not touched.
- `coordinator/get_for_user()` classmethod (the employee_code/email
  fallback lookup used elsewhere): left as-is — not part of the "Done"
  checklist, and changing lookup call-sites elsewhere in the codebase was
  explicitly not asked for. It still works exactly as before; a future
  step could switch its callers to use the FK directly, but that's a
  separate, wider-reaching change than this one.

## Next

Phase B — the real user import into central auth — is next, per the
prompt. Coordinator identity is now DB-enforced, closing the
silent-remap risk `SMS_USER_MIGRATION_ANALYSIS.md` flagged.
