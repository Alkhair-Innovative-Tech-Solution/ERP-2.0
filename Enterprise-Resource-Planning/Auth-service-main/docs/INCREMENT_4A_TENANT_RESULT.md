# Increment 4a: `Tenant` Model — Result

**Correction to the prompt's premise, verified before building anything**:
the prompt's "Current state" section said central auth has an
`Organization` but "NO `Tenant`" today, and asked to add `Tenant` +
`Organization.tenant` (nullable FK) + reconcile `Subscription`. All three
**already exist** — they were built in Increment 0 (the VMS vertical
slice), not skipped as the prompt assumed. This was confirmed by reading
the actual model code and the live database before writing any code (see
"What already existed" below), then confirmed with the user before
proceeding, rather than either blindly redoing steps 1–3 (which would have
been a no-op at best, a destructive/erroring change at worst) or silently
ignoring the discrepancy.

Branch: `increment-4a-tenant-model` (not merged to `main`).

**Done**: the one genuinely missing piece — a generic, reusable
`seed_default_tenant` command — now exists. Nothing else changed. **No
migration was needed or created** (`makemigrations --check` → "No changes
detected"). VMS/HDMS logins proven byte-identical before and after (there
was no "before/after" in the schema sense, since nothing schema-level
changed — but the login flow itself was exercised live to confirm, not
just assumed).

## What already existed (Increment 0, not new)

| Piece | Where | Confirmed |
|---|---|---|
| `Tenant` model — UUID pk, `name`, `tenant_code` (unique), `is_active` | `employees/models.py:53-70` | Matches the prompt's own spec for step 1 almost field-for-field. |
| `Organization.tenant` — nullable FK to `Tenant` | `employees/models.py:79-86` (`on_delete=PROTECT, null=True, blank=True`) | Matches step 2's spec exactly — already nullable, already no backfill (existing rows can be `tenant=null`). |
| `Subscription.tenant` — **direct** FK to `Tenant` (not a `tenant_code` string, not indirect via `Organization`) | `permissions/models.py:49-53` | Already more complete than step 3 asked to verify — `Subscription` was built keyed directly to `Tenant` from the start, so there was nothing to "reconcile." |
| Live proof | `docker exec auth_service python manage.py shell` | `Tenant.objects.all()` → one row, `VMST` / "VMS Increment0 Test Tenant"; `Organization.objects.all()` → `VMST` org with `tenant_id` pointing at it. Not empty, not theoretical. |

## What was built

### `employees/management/commands/seed_default_tenant.py` (new)
The only genuinely new file this increment. Idempotent (`Tenant.objects.get_or_create`
by `tenant_code`). Does nothing automatically — attaching an `Organization`
requires the explicit `--attach-org ORG_CODE` flag, and refuses (raises
`CommandError`, non-zero exit) rather than silently overwriting if that
Organization already has a *different* tenant set. No schema change, no
migration — it only calls existing model APIs.

```
python manage.py seed_default_tenant --tenant-code SMS --name "SMS Tenant"
python manage.py seed_default_tenant --tenant-code SMS --name "SMS Tenant" --attach-org SMSORG
```

This is what makes "attach SMS's org to a Tenant" (the next increment,
per the prompt's own "then stop" note) a one-line command instead of
bespoke seed code — matching what `seed_vms_increment0` did inline,
specifically for VMS, back in Increment 0.

**Verified live**, all three cases:
- Fresh create: `Created: Tenant SMS (SMS Tenant (placeholder))`.
- Re-run (idempotent): `Exists: Tenant SMS (...)` — no duplicate, no error.
- `--attach-org NOPE` (nonexistent org): clean `CommandError`, nothing attached.
- `--attach-org VMST` (org already attached to the *VMST* tenant): refused
  with `CommandError` naming the existing tenant, **not** silently
  overwritten — proves the guard-rail actually fires, not just that it's
  written.

Test tenant (`SMS`) was deleted after verification — this increment does
not create any permanent new Tenant; that's explicitly next-increment work
per the prompt.

## Step 3 (`Subscription` reconciliation) — why nothing needed changing

The prompt's step 3 said: "Check how `Subscription` currently identifies
its tenant... If it already keys off Organization or a `tenant_code`, add
the minimal bridge... If reconciling requires touching the gate, STOP and
tell me first."

`Subscription.tenant` is already a first-class `ForeignKey(Tenant, ...)`
(`permissions/models.py:49-53`) — not a string, not indirect through
`Organization`. There is no bridge to add; `Subscription` was never keyed
off anything else. **Nothing was touched here** — correctly stopping short
of "reconciling" something that doesn't need it, rather than inventing
work to match the prompt's assumption.

## Proof VMS/HDMS are unchanged

No model or migration changed, so there was no schema-level "before" to
diverge from — but the login flow was exercised live anyway, not just
assumed safe:

```
POST /api/auth/login-vms  (VMST-B1-G-26-V-0001)
  tenant_id: 5aa5b29a-6a94-4349-ab57-81d48f27fe5c
  services: [vms, hdms]
  perms: [vms.visit.checkout, vms.visit.create, vms.visit.view_own, vms.visitor.create, vms.visitor.view]
  perm_version: 1
  role: receptionist

POST /api/auth/login-hdms  (VMST-B1-G-26-H-0002)
  tenant_id: 5aa5b29a-6a94-4349-ab57-81d48f27fe5c
  services: [vms, hdms]
  perms: [hdms.ticket.close, hdms.ticket.create, hdms.ticket.view_own]
  perm_version: 1
  role: assignee
```

Both match the claim shapes and values from prior increments' verified
runs exactly. `makemigrations --check --dry-run` → "No changes detected".
`manage.py check` → "System check identified no issues". Full suite:
`63 passed, 2 failed, 10 errors` — same count as every prior increment's
baseline, same pre-existing unrelated cause (`conftest.py`'s
`sample_department` fixture passing a `dept_sector` kwarg the current
`Department` model doesn't have — flagged first in Increment 0, confirmed
unrelated to this work).

## Surprises

The entire premise of this increment. Worth flagging for whoever is
sequencing these prompts: the plan document(s) driving these increments
appear to be slightly stale relative to what Increment 0 actually shipped
— Increment 0's own deliverable
(`docs/INCREMENT_0_RESULT.md`) already documents `Tenant` as a new model
it added. A quick check of that file before writing this prompt would have
caught the same thing this session caught by reading the code directly.
Not a code problem — a planning-doc/prompt-drafting one, mentioned so the
next increment's prompt can be double-checked against current state before
being handed over.

## Then what

Per the prompt: stop here. Attaching SMS's actual `Organization` to a real
`Tenant` (using `seed_default_tenant --attach-org` built above), and the
SMS user migration itself, are separate, later increments — informed by
`School-Management-System-New/docs/SMS_USER_MIGRATION_ANALYSIS.md`.
