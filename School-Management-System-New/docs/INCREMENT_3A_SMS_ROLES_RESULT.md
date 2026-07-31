# Increment 3a: SMS Roles → Catalog (Auth-side Only) — Result

SMS's 11 roles + permissions are now catalog data (`users/sms_catalog.py`),
derived verbatim from the existing `DEFAULT_PERMISSIONS` dict, seeded
through a new idempotent command, and wired as the source of truth for both
existing and newly-created organizations. **`User.role`, every
`user.role == '...'` check, username generation, and all 13 other SMS
services are unchanged.** Users still live entirely in SMS — nothing was
migrated or merged into central auth.

Branch: `increment-3a-sms-roles-catalog` (not merged to `main`).

**Post-verification update**: the plan below originally kept
`seed_permissions.py` / `DEFAULT_PERMISSIONS` in place as a rollback
safety net (per the increment prompt's own rule). After the equivalence
proof passed and was reviewed, the explicit decision was made to not carry
old/unused code forward — `seed_permissions.py` **has since been deleted**.
Everything below that describes it as "kept side-by-side" reflects the
state at proof-time; see "Final state" at the bottom for what actually
shipped.

**Done, verified live**: `RolePermission` rows produced by the new catalog
path are **byte-for-byte identical** to the old dict path — same
`(organization, role, permission_codename, is_allowed)` tuples, proven by
snapshotting both and diffing (see "Proof of equivalence" below), not just
asserted.

## What was built

### Step 1 — `users/sms_catalog.py`
- `SMS_PERMISSIONS`: 51 namespaced `sms.<module>.<action>` permissions,
  grouped by area (dashboard, student, teacher, campus, principal,
  coordinator, attendance, result, transfer, timetable, request, promotion,
  subject, chart, kpi, fee, permission, form). Each entry carries a
  `legacy_codename` — the bare name (`view_students`, etc.) that actually
  gets written to `RolePermission.permission_codename`, because every
  `view.required_permission = '...'` attribute scattered across the
  codebase still checks against that bare name. The namespaced `codename`
  is catalog-facing metadata; it does not yet appear anywhere in the DB or
  in a live permission check.
- `SMS_ROLE_TEMPLATES`: `role -> {legacy_codename: bool}` for all 11
  `User.ROLE_CHOICES` roles — **copied verbatim** (keys and values, `True`
  and `False`) from `DEFAULT_PERMISSIONS` in
  `users/management/commands/seed_permissions.py`.
- **Derivation was verified programmatically, not just by eyeballing**: a
  script parses `DEFAULT_PERMISSIONS` out of `seed_permissions.py` via
  Python's `ast` module (no manual re-transcription, no risk of copy
  error) and diffs it against `sms_catalog.py`'s data. First pass matched
  on permission *keys* (51 unique keys, all 11 roles) but caught a real
  bug before it shipped — see "Surprise" below.
- **Known gap in the old dict, mirrored, not fixed**: `User.ROLE_CHOICES`
  has 11 roles; `DEFAULT_PERMISSIONS` only has 10 entries — `'admin'` has
  no entry at all. `seed_permissions` has therefore never created a single
  `RolePermission` row for the `admin` role; it has zero dynamic
  permissions today. `SMS_ROLE_TEMPLATES['admin'] = {}` matches this
  exactly rather than "fixing" what may or may not be intentional — flagging
  it here for whoever owns SMS to decide.

### Step 2 — `seed_sms_catalog` command
- New, idempotent, mirrors `seed_permissions.py`'s org-loop exactly
  (per-organization if any exist, else a single `organization=None` global
  set) and its `--reset` flag semantics.
- `seed_permissions.py` **left completely untouched** — still works,
  side-by-side, specifically so old vs. new could be diffed (see below).

### Step 3 — Permission resolution now reads from the catalog
- SMS's actual runtime permission check
  (`users/permissions.py::HasDynamicPermission`) **already read from the
  `RolePermission` table**, not the `DEFAULT_PERMISSIONS` dict directly —
  the dict was only ever a one-time seed source, not something queried at
  request time. So "point resolution at the catalog" meant: make sure
  whatever *writes* `RolePermission` rows uses the catalog, not the dict.
  `HasDynamicPermission` itself needed **zero code changes** — same
  finding as VMS/HDMS's `rbac.py`/`jwt_utils.py` needing zero changes in
  earlier increments, for the same underlying reason (the runtime already
  read from a table, not a hardcoded source).
- Two *live* write paths were found and repointed at the catalog (see Step
  4 — `DEFAULT_PERMISSIONS` itself was left in place, not deleted).

### Step 4 — `DEFAULT_PERMISSIONS` authority
Three importers were found and handled individually:

| Importer | What it is | Action |
|---|---|---|
| `users/management/commands/seed_permissions.py` | The dict's own home | Initially left untouched (kept working in parallel) so old vs. new could be diffed, per the increment prompt's rule. **Deleted afterward** on explicit instruction, once the equivalence proof below passed and was reviewed — see "Final state" at the bottom. |
| `users/signals.py` — `seed_default_permissions_for_org` | `post_save` signal on `Organization`, **live**: auto-seeds `RolePermission` for every newly-created org | **Repointed** to `users.sms_catalog.SMS_ROLE_TEMPLATES` instead of importing `DEFAULT_PERMISSIONS`. This is the actual "permission resolution" path that matters going forward — every org created from now on is provisioned from the catalog. Verified live: created a test organization, got exactly 282 `RolePermission` rows (same count/values as the dict would have produced), cleaned up afterward. |
| `users/management/commands/migrate_to_org.py` | One-off historical data-migration script (moves legacy no-org users into a real `Organization`) | **Repointed** the same way, for consistency (`from users.sms_catalog import SMS_ROLE_TEMPLATES as DEFAULT_PERMISSIONS` — minimal diff, rest of the function unchanged). |

At proof-time, `DEFAULT_PERMISSIONS` had exactly one remaining reader: its
own command file. With that confirmed, it was removed entirely rather than
kept as unused dead code — see "Final state" below.

## Proof of equivalence (old dict vs. new catalog)

```
1. Fresh RolePermission table, org=None (0 organizations in DB).
2. Ran `seed_permissions` (old) → 282 rows created. Snapshotted as
   (organization_id, role, permission_codename, is_allowed) tuples.
3. Cleared RolePermission entirely.
4. Ran `seed_sms_catalog` (new) → 282 rows created. Snapshotted the same way.
5. old_snapshot == new_snapshot → True.  (Python set equality, all 282 tuples.)
```

**This caught a real bug before it was called "done".** The first version
of `seed_sms_role_templates()` only wrote rows for permissions that were
`True` for a role (212 rows) — reasoning that a *missing* row and an
explicit `is_allowed=False` row are behaviorally identical to
`HasDynamicPermission`'s `is_allowed=True`-existence check, which is true.
But `seed_permissions.py`'s old dict explicitly writes a row for **every**
key listed for a role, `True` or `False` (282 rows) — and the SuperAdmin
permissions-toggle UI most likely renders switches from *existing rows*, so
a caller with only `True` rows written would see fewer toggleable
permissions in the UI for roles that have explicit `False` entries
(principal, coordinator, teacher, donor) than before. Fixed by writing
every explicit key (both `True` and `False`) — same as the old dict —
verified by the row-for-row diff above, not just re-asserted.

## Role → permission table (48/45/38/... allowed permissions per role)

Namespaced codenames, `True`-valued only (the doc-friendly view — the
actual seeded rows also include the explicit `False` ones per role, listed
in full in `users/sms_catalog.py`'s `SMS_ROLE_TEMPLATES`):

- **superadmin** (48): sms.attendance.{approve,mark,view}, sms.campus.{create,view}, sms.chart.* (10), sms.coordinator.{create,view}, sms.dashboard.{admin,coordinator,principal,student,superadmin,teacher,view}, sms.fee.{manage,view}, sms.form.manage, sms.kpi.* (4), sms.permission.manage, sms.principal.{create,view}, sms.promotion.view, sms.request.view, sms.result.{approve,bulk_import,edit,view}, sms.student.{create,edit,view}, sms.subject.view, sms.teacher.{create,view}, sms.timetable.view, sms.transfer.view
- **admin** (0): none — no entry in the old dict, mirrored exactly.
- **org_admin** (45): same as superadmin minus `sms.dashboard.superadmin` and `sms.result.bulk_import`/`sms.result.edit`.
- **principal** (38): everyone-facing views + `sms.campus.create`, `sms.coordinator.create`, `sms.result.approve/bulk_import/edit`; **not** `sms.principal.view/create`, `sms.attendance.mark`, `sms.permission.manage`, `sms.form.manage`.
- **coordinator** (31): student/attendance/result-heavy; **not** `sms.teacher.create`, `sms.campus.*`, `sms.principal.*`, `sms.coordinator.*`, `sms.attendance.mark`, `sms.promotion.view`, `sms.fee.manage`.
- **teacher** (12): sms.student.view, sms.teacher.view, sms.attendance.{view,mark}, sms.result.{view,bulk_import,edit}, sms.transfer.view, sms.timetable.view, sms.request.view, sms.chart.network_performance, sms.dashboard.teacher.
- **donor** (19): read-only — people-list views + campus + most charts/KPIs; zero create/edit/approve permissions anywhere (by design, per the existing dict's own comments).
- **accounts_officer** (5): sms.dashboard.{view,accounts}, sms.student.view, sms.fee.{view,manage}.
- **admissions_counselor** (6): sms.dashboard.{view,admissions}, sms.student.{view,create,edit}, sms.campus.view.
- **compliance_officer** (6): sms.dashboard.{view,compliance}, sms.student.view, sms.attendance.view, sms.result.view, sms.campus.view.
- **student** (2): sms.dashboard.{view,student}.

## Confirmations (per the rules)

- `User.role`, `ROLE_CHOICES`, `is_superadmin()`/`is_principal()`/etc.,
  username-prefix generation: **not touched**. `grep -rn "\.role =="` and
  `grep -rn "ROLE_CHOICES"` outside `users/models.py` show only the
  pre-existing scattered checks, unmodified.
- The other 13 SMS services: **not touched** — this increment only reaches
  `School-Management-System-New/microservices/auth-service/`.
- Central `Auth-service-main/`: **not touched**.
- No users migrated or merged anywhere.
- Every schema change: none — no new models, no migrations. `RolePermission`
  itself is unchanged; only what populates it changed.
- Seeds idempotent: `seed_sms_catalog` re-run after already seeding →
  `Created: 0, Reset: 0, Skipped: 282`.

## Final state: `seed_permissions.py` deleted

The equivalence proof above (byte-for-byte identical `RolePermission` rows)
was run and reviewed. At that point `DEFAULT_PERMISSIONS` had exactly one
remaining reader — its own file — and both live write-paths (the
org-creation signal and the migration script) had already been repointed
at the catalog. On explicit instruction not to carry old/unused code
forward once the new path is trusted, `users/management/commands/
seed_permissions.py` was deleted outright (not just deprioritized).

This is a **deviation from the increment prompt's original rule**
("don't delete it, keep it working in parallel") — recorded here
explicitly rather than silently: the prompt's caution was for *before*
equivalence was proven; once proven and confirmed, the decision was made
to not keep dead code around. If the original `DEFAULT_PERMISSIONS` text
is ever needed again, it's in git history on this branch prior to the
deletion commit.

`users/sms_catalog.py` is now SMS's sole role/permission source.

## How to run / test

```bash
# From School-Management-System-New/
docker compose up -d auth-service

# The only seed path now
docker exec ams_auth python manage.py seed_sms_catalog

# Equivalence proof (as run in this session)
docker exec ams_auth python manage.py shell -c "
from users.models import RolePermission
snap = set((str(rp.organization_id), rp.role, rp.permission_codename, rp.is_allowed) for rp in RolePermission.objects.all())
print(len(snap))
"
# Compare snapshots before/after clearing + reseeding with the other command.

# New-org auto-provisioning now uses the catalog
docker exec ams_auth python manage.py shell -c "
from users.models import Organization, RolePermission
org = Organization.objects.create(name='Test School')
print(RolePermission.objects.filter(organization=org).count())  # -> 282
"
```
