# SMS User Migration — Step-by-Step Plan

The biggest, riskiest piece of the whole project. This plan breaks it into small, reversible increments so 13 services never break at once. **No code yet** — this is the map. Each numbered increment becomes its own tightly-scoped prompt + branch, run and verified one at a time.

Grounded in `SMS_USER_MIGRATION_ANALYSIS.md` and direct code inspection.

---

## The problem in one picture

- SMS's `User` model exists in **~12 places**: `auth-service` (real table), `org-service` (a diverged fork — has billing fields the others don't), and **10 other services that COPY `users/` into their own image and run it against their own DB**.
- 13 of 14 services hold **direct FKs** to `users.User` / `users.Organization` / `campus.Campus`. `Student.user` and `Teacher.user` are `OneToOne` to a local `User`.
- Coordinator has **no real FK** — just `employee_code == username` string matching.
- All 14 share **one HS256 secret**; 13 trust tokens for 24h even after revoke. Central auth is RS256.
- SMS auth (`:8001`) is a **separate database** from central auth. `sync_staff_to_auth` (still live) pushes staff into SMS auth via `/api/internal/create-user/` (default pw "12345").
- Destination already exists: central-auth tenant **`SMS01`** + org + `sms` subscription (Increment 4b).

The end state: one identity per person in **central auth**; every SMS service reads `user_id` from the token (JWKS-verified), not a local `User` FK; SMS auth-8001 and `sync_staff_to_auth` deleted; `tenant_id` walls inside SMS so future schools are isolated.

---

## Guiding rules for every step

- **Dual-run always.** Add the new path beside the old; keep both working; cut over only after proving equivalence; remove the old last. Never a hard swap.
- **One service at a time.** Never repoint two services in the same increment.
- **Nullable + no forced backfill.** New `user_id` columns land nullable next to the existing FK, so nothing breaks on day one.
- **Prove live, each step.** The user runs a real login/read/write and sees it work before moving on.
- **Nothing deleted until its replacement is proven** — applies to old columns, `sync_staff_to_auth`, SMS auth-8001, and any "extra"/`sis` cleanup.

---

## The increments (in order)

### Phase A — Foundations (no service repointed yet)

**A1 — Consolidate the scattered `User` copies to one understanding.**
Map exactly what each of the 12 `User` copies contains and where they diverge (esp. org-service's billing fields). Decide the canonical shape. Likely no code — a reconciliation doc + decision. Output: "the one true SMS user shape."

**A2 — Give central auth a way to hold SMS identities.**
Confirm central-auth's `Employee`/user model can represent an SMS user (fields: username, email, role, org, campus). Add whatever's missing. Land users into the `SMS01` tenant. Still no SMS service touched — just make the destination able to receive.

**A3 — Fix coordinator's missing FK.**
Before migrating, give coordinator a real `user` reference instead of `employee_code == username` string matching, so it survives the move. Small, isolated, high-value (closes a silent-breakage risk).

### Phase B — Bring identities across (dual-run)

**B1 — One-time import: SMS users → central auth `SMS01`.**
Copy existing SMS users into central auth as identities, preserving their old id as `legacy_user_id` for later FK remapping. Read-only against SMS; write into central auth. SMS keeps working unchanged off its own auth.

**B2 — Repoint `sync_staff_to_auth` at central auth.**
Today it feeds SMS auth-8001. Point new-user creation at central auth instead (or dual-write both) so no new divergence accumulates while we migrate. The "12345" default-password path gets addressed here (enforce change-on-first-login, or flag).

### Phase C — Repoint services off local `User` (one at a time, smallest first)

For each service: add nullable `user_id` beside the local `User` FK → backfill from `legacy_user_id` → switch reads/writes to `user_id` + JWKS token verify (the VMS/HDMS pattern) → drop the local `User` FK/table. Verify live between each.

Suggested order (least-coupled first): **notification → subject → timetable → content → support → attendance → result → fees → campus → student → staff → org-service (last, it's the diverged fork)**. (`ai-service` is already independent — may need only token verify.)

Each service = its own increment. ~12 increments. This is the long stretch.

### Phase D — Remove the old machinery

**D1 — Delete SMS auth-8001** once every service verifies central-auth tokens and no one logs in against it.
**D2 — Delete `sync_staff_to_auth`** and the local `User` copies once nothing imports them.
**D3 — Switch SMS from shared HS256 to central RS256/JWKS** (falls out as services cut over; confirm the last one).

### Phase E — SMS multi-tenancy (future schools)

Add `tenant_id` walls inside SMS data (the VMS/HDMS row-level pattern) so a second school can't see the first's data. Needed because you confirmed **multiple schools are coming**. Can overlap late Phase C.

---

## Cleanup items (investigate — do NOT delete blindly)

You asked to remove `sis` and "extra files." Both are **investigate-first, delete-last**, folded in here rather than done rashly:

- **`sis` service in central auth** — has a *working login endpoint*, so it may be live. It is NOT our SMS (different product; see progress log). **Do not delete** until someone confirms it's unused. Owner question first. If confirmed dead → its own small removal increment with a revert path.
- **"Extra"/`check_*`/`migrate_*`/`debug_*`/`fix_*` scripts** — some are real historical migrations, not junk. Inventory them, mark each keep/delete with a reason, get confirmation, then remove in one reviewed pass. Never blind-delete.

Cleanup happens **after** the migration is stable, not during — deleting things mid-migration removes escape hatches you may need.

---

## The single riskiest step

**Phase C on `student-service` and `staff-service`** — they hold the `OneToOne` `Student.user` / `Teacher.user` links to real people, and the most data. If a remap is wrong here, real student/teacher records point at the wrong identity. Do these late (pattern proven on smaller services first), with the most careful before/after verification.

---

## What needs a decision before Phase B starts

1. Canonical user shape — reconcile org-service's fork (A1). Does its billing split out first (the `SubscriptionPlan` work), or ride along?
2. `sync_staff_to_auth`: dual-write to both auths during migration, or hard-cut to central auth?
3. "12345" default password: enforce change-on-first-login as part of B2, or leave as-is and just flag?
4. `sis`: get owner confirmation it's unused before scheduling any removal.
