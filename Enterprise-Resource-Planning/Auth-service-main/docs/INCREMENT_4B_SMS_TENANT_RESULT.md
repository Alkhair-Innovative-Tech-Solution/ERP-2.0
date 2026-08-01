# Increment 4b: Register the SMS Tenant in Central Auth — Result

Central auth now has an empty "home" for SMS: a `Tenant` (`SMS01`), an
`Organization` under it, an `sms` `Service` catalog entry, and an active
`Subscription` linking them. **SMS's own database/services were never
touched** (nothing in this session connected to SMS's `auth_db` or
anything in `School-Management-System-New/` — confirmed by `git status`
showing zero changes outside `Auth-service-main/`). VMS/HDMS proven
byte-identical before and after.

Branch: `increment-4b-sms-tenant` (not merged to `main`).

## Surprise worth flagging: `sis` already exists, and it is NOT this SMS

Before creating anything, `permissions.Service` was checked for an
existing `sms` row — none existed, **but a `sis` row did**
(`code='sis', name='School Information System'`), with its own working
login endpoint (`authentication/api.py:559-618`, `ServiceAccess.objects.get(...,
service='sis', ...)` gate at `:580-589`), predating this session's work
entirely (referenced already in this repo's own `CLAUDE.md`).

**"SIS" (School Information System, already in central auth) and "SMS"
(School Management System, the separate `School-Management-System-New`
monorepo analyzed in the prior increment) are two different, unrelated
products** — confirmed structurally: SIS's employees/credentials are
central-auth's own `Employee`/`SuperAdmin` models; SMS has its own
completely separate `User` model, its own 14 microservices, its own
databases, none of it reachable from or related to central auth. The
acronym collision (SIS vs SMS) is real and worth a name-collision warning
for whoever manages the `Service` registry later, but they are not the
same thing and this increment did not touch `sis`.

## What was built

### Extended `employees/management/commands/seed_default_tenant.py`
(Increment 4a's command — same file, additive changes, no new file.)

Added three new optional flags:
- `--create-org ORG_CODE --org-name "..."` — creates a **new** Organization
  under the tenant (Increment 4a's `--attach-org` only ever *attached an
  existing* Organization; SMS has none in central auth's own DB to attach
  — its real Organization lives in SMS's own separate `auth_db`, which
  this increment explicitly does not reach into). Mutually exclusive with
  `--attach-org`. Idempotent: re-running with the same `org_code` reuses
  the existing row rather than erroring, and refuses (via `CommandError`)
  to silently reassign an Organization that already belongs to a
  *different* tenant.
- `--subscribe SERVICE_CODE --service-name "..."` — ensures a `Service`
  catalog row exists (creating it if not — this is Step 1 from the
  prompt, folded into the same command rather than a separate one-off,
  since there was no pre-existing "seed a Service" command anywhere in
  this codebase to mirror; `vms`/`hdms`/`sis` rows all appear to have
  been created ad hoc) and creates an active `Subscription(tenant, service)`.
  Idempotent (`get_or_create`, and self-heals `status` back to `active`
  if it had drifted, without re-creating the row).

All three original Increment-4a flags (`--tenant-code`, `--name`,
`--attach-org`) are unchanged in behavior.

**Verified live, one command, all 4 pieces at once:**
```
docker exec auth_service python manage.py seed_default_tenant \
  --tenant-code SMS01 --name "SMS School" \
  --create-org SMS01 --org-name "SMS School" \
  --subscribe sms --service-name "School Management System"

  Created: Tenant SMS01 (SMS School)
  Created: Organization SMS01 (SMS School) -> Tenant SMS01
  Created: Service sms (School Management System)
  Created: Subscription SMS01 -> sms (active)
```

**Re-run (idempotency proof)** — identical command, all four lines report
`Exists:` instead of `Created:`, no duplicates, no errors.

## Isolation proof (SMS01 vs. VMST — no shared rows)

```python
Tenants: ['VMST', 'SMS01']
Orgs: [('VMST', 'VMST'), ('SMS01', 'SMS01')]
Subscriptions: [('VMST', 'vms', 'active'), ('VMST', 'hdms', 'active'), ('SMS01', 'sms', 'active')]
Services: ['hdms', 'sis', 'sms', 'vms']
```

Two fully separate tenants, each with its own Organization and its own
Subscription row — `SMS01` has no `vms`/`hdms` subscription, `VMST` has no
`sms` subscription. `sis` sits untouched alongside the new `sms` entry,
confirming the pre-existing service registry wasn't disturbed.

## Proof VMS/HDMS are unchanged

No schema change (`makemigrations --check --dry-run` → "No changes
detected" — this increment is 100% seed data, one file, zero migrations,
exactly as the prompt anticipated). Logins re-run live after all the
above:

```
POST /api/auth/login-vms  (VMST-B1-G-26-V-0001)
  tenant_id: 5aa5b29a-6a94-4349-ab57-81d48f27fe5c
  services: [vms, hdms]        <- still no "sms" leaking in
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

Byte-identical to every prior increment's verified run — including the
`services` list, which is the specific claim isolation depends on (if
`SMS01`'s data had somehow leaked into `VMST`'s subscription set, `sms`
would appear here; it doesn't). `manage.py check` clean. Full suite:
`63 passed, 2 failed, 10 errors` — same baseline, same pre-existing
unrelated cause as every prior increment.

## What was explicitly NOT done (per the prompt)

- No SMS user, no SMS `Organization`/`Campus`/`Student`/`Teacher` data
  moved or read. `SMS01`'s central-auth `Organization` is an empty shell
  with just a name and code — nothing links it to any real SMS record yet.
- No connection of any kind opened to SMS's `auth_db` or any SMS service.
- No SMS permission catalog (`sms.<module>.<action>`, the `sms_catalog.py`
  shape used by VMS/HDMS) — the `Service` row created here is just the
  registry entry, exactly as the prompt specified for step 1 ("NOT the
  full SMS permission catalog; that's a later increment").

## Then what

Per the prompt: stop here. The actual SMS user migration — informed by
`School-Management-System-New/docs/SMS_USER_MIGRATION_ANALYSIS.md` and
landing users into the now-existing `SMS01` tenant/org — is the next,
much larger sequence.
