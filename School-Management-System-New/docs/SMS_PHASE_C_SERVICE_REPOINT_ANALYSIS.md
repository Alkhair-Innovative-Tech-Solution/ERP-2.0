# SMS Migration Phase C — Service Repoint Plan: Analysis

Verification pass against `/home/rahat/Documents/ALL_Plans/SMS_PHASE_C_SERVICE_REPOINT_PLAN.md`,
before C1 starts. Read-only — no code changed, no branch created. Checks
the plan's claims against the actual codebase rather than taking them at
face value.

## Context: what Phase C assumes is already true

Per the plan, Phase C assumes Phases A+B are done: central auth holds all
SMS identities (staff via B1, students via B2), RBAC is generic (B3), new
staff dual-write into central auth (B4). All four confirmed complete and
documented (`PHASE_A2_STUDENT_IDENTITY_RESULT.md`,
`PHASE_B1_USER_IMPORT_RESULT.md`, `PHASE_B2_STUDENT_IMPORT_RESULT.md`,
`PHASE_B3_GENERIC_RBAC_RESULT.md`, `PHASE_B4_STAFF_SYNC_RESULT.md`, all in
`Auth-service-main/docs/`).

## Decision 1 — Framework per service: resolved, uniformly DRF

Checked every one of the 13 services' `requirements.txt` directly:

```
content-service:       djangorestframework
fees-service:          djangorestframework
ai-service:            djangorestframework
result-service:        djangorestframework
subject-service:       djangorestframework
campus-service:        djangorestframework
support-service:       djangorestframework
notification-service:  djangorestframework
student-service:       djangorestframework
timetable-service:     djangorestframework
attendance-service:    djangorestframework
org-service:            djangorestframework
staff-service:         djangorestframework
```

**No `django-ninja` anywhere.** All 13 are DRF-only.

This resolves the plan's Decision 1 cleanly: VMS's `central_auth/`
template (`Enterprise-Resource-Planning/VMS/backend/central_auth/` —
`authentication.py`, `jwks.py`, `permissions.py`, `tenant.py`) is the
correct template for **every** SMS service, copied unchanged, no
per-service framework branching required.

HDMS's `ticket-service` needed an extra adapter layer — its
`central_auth/authentication.py` docstring explains why: that service
mixes Django Ninja routers with DRF, so the DRF-style
`authenticate(self, request)` method needed a `__call__` wrapper to also
work as a Ninja `Router(auth=...)` callable. None of SMS's 13 services
mix frameworks this way, so that adapter is not needed anywhere in Phase
C — the plain DRF template (VMS's version, not ticket-service's) is the
one to reuse.

## The file-count ranking table — heuristic, not exact; one real correction

Re-grepped each service for `User`/`Organization`/`Campus` references
independently. Numbers didn't match the plan's table exactly in either
direction (methodology-dependent — string-style FKs like
`'users.Organization'`, migration files, and indirect imports all count
differently depending on the pattern used). Not worth reconciling
precisely: the plan's own rule — "prove the recipe on C1–C2 (tiny) before
trusting it on the big ones" — means getting the recipe right on a small
service matters more than the exact ordering past that point.

**One finding that does change the picture: `ai-service` is not a
4-file, "early" service — it has zero coupling.**

```
find ai-service -iname Dockerfile | xargs grep -i "COPY.*users\|COPY.*campus"
-> (no output — Dockerfile doesn't copy users/ or campus/ at all)
```

`ai-service` has no local `User`, `Organization`, or `Campus` reference
anywhere in its source. This confirms
`SMS_USER_MIGRATION_PLAN.md`'s own earlier note: *"ai-service is already
independent — may need only token verify."* Practically: it likely
doesn't need the FK-add/backfill/dual-run steps of the repeat recipe at
all — just JWKS token verification wired in, nothing to repoint because
there's no local `User` FK to repoint. Worth treating as its own,
simpler case rather than grouping it with the other "early" 4-file
services, and possibly doing it *before* C1 as an even lower-risk warm-up
(there's no model/migration risk at all, only auth-glue code).

## C1 (`content-service`) sanity-checked directly — confirmed small

```
content/models.py:11,38,69,94   FK to 'users.Organization' (string ref, 4 models)
content_service/settings.py:46  AUTH_USER_MODEL = "users.User"  (boilerplate, every service has this)
content/views.py:16             from users.models import Organization
```

Confirmed: `content-service` has **no FK to `User` at all**, only to
`Organization` (4 places), plus the standard `AUTH_USER_MODEL` setting
every service carries regardless of actual coupling. This matches the
plan's claim that it's small and safe, and clarifies exactly what
"repoint" will mean here in practice: there's no `Student.user`/
`Teacher.user`-style OneToOne to remap, no per-request local-User lookup
to replace — just tenant/org-scoping logic that currently resolves
through `Organization` and needs to resolve through the JWT's `tenant_id`
claim instead. A genuinely good, low-risk first target.

## Decision 2 — `legacy_user_id` availability: the one that actually matters

This is a direct callback to Phase B0's finding, and it applies to
**every** service in Phase C uniformly, not per-service:

> B0 (`SMS_PHASE_B0_AUDIT_RESULT.md`) found **zero real SMS user data
> anywhere in this environment** — `auth_db`, `org_db`, `staff_db`,
> `campus_db` all empty of real users; the only "users" found were the
> analyst's own test artifacts, since deleted.

Consequence for Phase C: the recipe's step 3 ("add nullable
`central_user_id`, backfill from `legacy_user_id`") **cannot be exercised
against real data for any of the 13 services right now** — there is no
real SMS user anywhere with a `legacy_user_id`-linked central-auth
identity to backfill against, because there are no real SMS users at all
yet in this environment. This doesn't block proving the recipe works —
B1 through B4 all proved their mechanisms against synthetic data
successfully, and Phase C's dual-run + backfill pattern can be proven the
same way (create synthetic local `User` + matching synthetic central-auth
identity via B1/B2's importers, backfill, verify the mapping resolves
correctly). But it does mean "prove live" in every C-increment's test
plan will mean "prove against synthetic data," not a real production
backfill, until real SMS data exists somewhere. Worth stating explicitly
up front so each increment's proof isn't mistaken for more than it is.

## Decision 3 — org-service billing split: still open, correctly deferred

The plan itself defers this ("decide when we reach it") — C12 is far
down the order, nothing to resolve now. Flagging only that it remains an
open decision, not a finding that needs action yet. When C12 is reached,
the relevant prior finding to re-check is Phase A1's:
`SMS_USER_SHAPE_RECONCILIATION.md`'s org-service divergence report
(`Invoice`, `SubscriptionPlan` duplication, `activation_date`,
`payment_status` constraint difference) — that's the billing surface in
question.

## Summary of corrections to carry into C1's prompt

1. Framework is uniformly DRF — no per-service check needed, use VMS's
   plain DRF `central_auth/` template everywhere.
2. `ai-service` has zero `User`/`Organization`/`Campus` coupling — treat
   it as a separate, simpler case (JWKS wiring only, no FK/backfill
   steps), not a mid-tier 4-file service.
3. `content-service` (C1) confirmed small and FK-to-`Organization`-only,
   no `User` FK — matches the plan's "safest first" framing.
4. Every increment's backfill proof will necessarily be synthetic-data-only
   until real SMS data exists — state this up front in each C-increment's
   prompt/result doc so it's not read as more than it is.
5. Exact file-count ranking beyond C1/C2 is approximate — re-verify a
   given service's actual coupling directly (as done here for
   content-service) when its turn comes, rather than trusting the table's
   number alone.
