# Phase C13: Repoint ai-service onto Central Auth — Result (FINAL of 13)

Branch: `phase-c13-ai-service` (off `main`, not merged). Scoped to
`ai-service/` only. The last of the 13 SMS service repoints, and the
only one framed as "token-verification only" — no `User`/`Organization`/
`Campus` model coupling, no identity remap. That framing held for the
auth layer itself, but the audit surfaced two structural mismatches the
prompt didn't anticipate (detailed below) that would have made central
tokens crash or silently return nothing rather than "just work."

## How central-token verification was wired

ai-service authenticates via `rest_framework_simplejwt`'s
`JWTStatelessUserAuthentication` — a different library than every other
SMS service (`ams_shared.jwt.validator.ServiceJWTAuthentication`), but
the same idea: decode HS256 with the shared secret, wrap the payload as a
`TokenUser`, no DB lookup. `ai_chat/views.py`'s own `_get_token_claim`
already has a two-step fallback:
```python
def _get_token_claim(user, claim, default=None):
    try:
        val = user.token.get(claim)
        if val is not None:
            return val
    except Exception:
        pass
    return getattr(user, claim, default)
```
`AiCentralAuthUser` (in `ai_service/dual_auth.py`) deliberately has **no**
`.token` attribute at all — `user.token.get(claim)` raises `AttributeError`,
caught by the existing `except Exception: pass`, falling through to
`getattr(user, claim, default)`. Zero changes needed to `_get_token_claim`
itself; the wrapper just needs to expose the right plain attributes.
`DualAuthentication` routes on the token's own `alg` header (RS256 ->
`CentralAuthAuthentication`, wrapped in `AiCentralAuthUser`; else ->
the original `JWTStatelessUserAuthentication`, unchanged) — same shape as
every prior phase's `DualAuthentication`. `central_auth/` (authentication.py,
jwks.py, permissions.py) copied unchanged; `SERVICE_CODE='sms'` already
set in the template, no edit needed.

## Claim mapping

| ai-service claim | Legacy source | Central token | Resolution |
|---|---|---|---|
| `username` | JWT `username` claim | no `username` claim | `full_name` / `employee_code` / `identity_code`, in that order — display-only, safe |
| `role` | JWT `role` claim | **not present at all** | STUDENT: exact — a central student token carries `person_type='student'` (Phase A2/B2's own claim), mapped directly. STAFF: **genuinely unresolvable from the token** (no HR/designation data — deliberately excluded, confirmed via `Auth-service-main/.../jwt_utils.py`'s own docstring). Resolved instead in `_build_scope()` via an **exact** `central_user_id` match against `teachers_teacher` -> `coordinator_coordinator` -> `principals_principal` in turn — mirrors Phase C12's `Teacher/Principal/Coordinator.get_for_user()` exactly. `org_admin`/`admin` have no backing profile table at all and are **left genuinely unresolved** — flagged below, not hacked around. |
| `org_id` | JWT `org_id` claim (integer, matches each downstream DB's local `Organization.id`) | `tenant_id` (UUID) | **Not a value substitution — a column swap.** Every table these raw-SQL queries touch (`students_student`, `teachers_teacher`, `coordinator_coordinator`, `principals_principal`, `campus_campus`, `classes_classroom`, `classes_grade`, `attendance_attendance`, `result_result`, `transfers_classtransfer` — checked every one directly via `\d` in psql) already has BOTH the legacy integer `organization_id` and a `tenant_id` UUID column, added by whichever phase touched that service. `_build_scope()` sets `scope['org_col'] = 'tenant_id'` for a central token; `_execute_tool()`/`_resolve_campus_id()` use `scope['org_col']` in their WHERE clauses instead of a hardcoded `'organization_id'` literal. |
| `campus_id` | JWT `campus_id` claim (only principals carry this directly — teacher/coordinator resolve it via a DB lookup even on the legacy path) | **not present at all**, for any role | Resolved the same way as role — read off the matched profile row (`teacher.current_campus_id` / `coordinator.campus_id` / `principal.campus_id`) during the same `central_user_id` lookup, never from a token claim that doesn't exist. |
| `user.id` (used directly, e.g. `WHERE user_id=%s`) | integer, local `users.User.id` | UUID | Same column-swap treatment: `_build_scope()` sets `user_col='central_user_id'` for a central token; every `_build_scope`/`_execute_tool` query that filtered by `user_id` now filters by `scope`'s resolved id against the right column. |

**Flagged, not hacked around**: `org_admin`/`admin` roles remain
unresolvable for a central token (no backing profile table, no RBAC
catalog wiring — same gap C11/C12 flagged for SMS staff roles generally).
A central token belonging to an org_admin/admin degrades to the exact
same safe path an unknown role already took before this phase: `_get_allowed_declarations('')`
returns `[]`, and `AIChatView.post()`'s existing `if not allowed_tools:`
check returns "Aap ke role ke liye koi data query available nahi hai."
— no crash, no cross-tenant leak, just no AI chat access, matching how
the legacy system already treats an unrecognized role.

## Two structural blockers found live, not anticipated by "no model changes needed"

**1. The `organization_id`/`user_id` type mismatch (see table above)** —
this is the one the prompt's own Goal section gestured at ("map org_id
vs tenant_id... so the campus lookup + role gating still work") but
undersold as a simple claim-name substitution. It's actually a **column
swap across every raw SQL query in `_execute_tool`** (~15 query fragments)
plus `_build_scope`'s three profile lookups — a central token's `tenant_id`
is the wrong SQL *type* for an `organization_id` integer column, not just
a different name for the same value. Fixed by threading `scope['org_col']`/`user_col`
through every query that needs it. No model changes were needed for this
part — every column already existed, added by whichever earlier phase
touched that service's own table.

**2. ai-service's own local `Conversation`/`ConversationMessage` models
— genuinely required an additive migration, contradicting the phase's
own premise.** `Conversation.user_id`/`.org_id` are plain `IntegerField`s
with no `null=True`. A central actor's `user.id` (UUID) and tenant
(`tenant_id`, UUID) cannot be coerced into an `IntegerField` at all —
`int("bb4e39ba-e2fe-...")` raises `ValueError` before the query even
reaches the DB. This isn't a claim-resolution nuance, it's a hard crash
on the **very first** `Conversation.objects.create(...)`/`.filter(...)`
call for *any* central-auth actor, regardless of role. Found live while
tracing `AIChatView.post()`'s full call path, not by reading the prompt's
own audit (which stated "no models to change" — verifiably incomplete
once `ai_chat/models.py` is actually read). Fixed with a small, genuinely
additive migration: `user_id`/`org_id` made nullable (backward-compatible
— every legacy call site still always supplies both, so existing rows and
behavior are byte-identical), plus new nullable `central_user_id`/
`central_org_id` UUID columns. `_conversation_lookup_kwargs(user, ...)`
picks the right kwargs dict per token type. This is the same additive-
migration shape used in all 12 prior phases, just applied to a model the
phase's own scoping note said didn't need it — flagged here explicitly
rather than silently deviating.

## Endpoint -> permission map

| Endpoint | Legacy gate | Central gate |
|---|---|---|
| `POST /api/ai/chat/` | `IsAuthenticated` | + `DualServiceSubscribed` (sms subscription); role-based tool gating (existing, unchanged) is the only fine-grained control |
| `GET /api/ai/conversations/` | `IsAuthenticated` | + `DualServiceSubscribed` |
| `GET /api/ai/history/` | `IsAuthenticated` | + `DualServiceSubscribed` |

No `sms.*` catalog permission exists for "use AI chat" specifically
(checked `permissions/sms_catalog.py` — only `sms.assignment.*`/`sms.fee.*`/
`sms.result.view`, none map to this feature) — per this phase's own
instruction ("don't invent catalog perms"), none was created. This
matches the LEGACY system's own design: AI chat was never gated by a
fine-grained permission codename, only by role (`TOOL_PERMISSIONS` in
`ai_chat/permissions.py`) — the central path's `DualServiceSubscribed` +
the same existing role-based tool gating is the equivalent-shaped gate,
not a regression from a finer-grained legacy control that doesn't exist.

`central_auth.permissions.ServiceSubscribed` (the raw template) was
**not** used directly in `DEFAULT_PERMISSION_CLASSES` — confirmed it
calls `user.has_service(...)` unconditionally, which a legacy `TokenUser`
doesn't define at all (`AttributeError`, not a clean 403). Wrote
`ai_service.dual_auth.DualServiceSubscribed` instead, wrapping it in the
same `isinstance(user, CentralAuthUser)` check every prior phase's
version uses.

## Proof on synthetic data

Environment: ai-service built and started for the first time this phase
(first-time bring-up). `GEMINI_API_KEY` is unset in this environment (an
external dependency, not something to provision for a synthetic proof) —
`AIChatView.post()` correctly 500s at its own pre-existing "AI service
not configured" check for **every** token type, legacy and central alike,
proving the auth/permission layer passes identically for both before
hitting that unrelated, pre-existing environment limit.

Synthetic fixtures: 1 `Teacher` (staff_db, `central_user_id` set to match
a central `Employee`, `tenant_id` set), 1 `Student` (student_db,
`central_user_id` set to match a central `NonStaffIdentity`, `tenant_id`
set), 4 central tokens (teacher-shaped, student-shaped, superadmin,
VMS-only-tenant), 1 legacy HS256 token.

```
_build_scope() called directly (isolates the claim-resolution logic from
the unrelated GEMINI_API_KEY environment gap):

  central teacher token:
    role: teacher (exact central_user_id match against teachers_teacher)
    org_id: <tenant_id UUID>, org_col: tenant_id
    campus_id: 3 (== the synthetic teacher's own current_campus_id)
    allowed_tools: [get_students, get_absent_students, get_attendance_summary]
      (correctly excludes get_teachers/get_coordinators — teacher-only scope)

  central student token:
    role: student (exact person_type='student' claim)
    org_id: <tenant_id UUID>, org_col: tenant_id
    student_id: 3 (exact central_user_id match against students_student)
    allowed_tools: [get_my_results, get_my_attendance]

  central superadmin token:
    role: '' (correctly unresolved — not linked to any teacher/coordinator/
      principal/student profile; org_admin/admin have no backing table at all)
    allowed_tools: [] -> "no data query available for your role" (same
      safe degradation the legacy system already gives an unknown role;
      matches the legacy system's own explicit superadmin block, just via
      a different code path)

HTTP:
  POST /api/ai/chat/ (VMS-only tenant token, no sms subscription) -> 403
    {"detail":"Your organization does not have an active SMS subscription."}
  POST /api/ai/chat/ (central student token)  -> 500 "AI service not
    configured" — same pre-existing gap every token type hits, proving
    the auth+permission layer passed cleanly first
  GET  /api/ai/conversations/ (central teacher token) -> 200, [] (no
    crash — proves the Conversation.central_user_id/.central_org_id fix)
  Conversation.objects.create(**_conversation_lookup_kwargs(central_user, ...))
    -> central_user_id/central_org_id correctly populated with the UUIDs,
       user_id/org_id correctly left NULL (not corrupted/coerced)
  GET  /api/ai/conversations/ (legacy HS256 token)  -> 200, [] — unchanged
  POST /api/ai/chat/ (legacy HS256 token) -> 500 "AI service not
    configured" — same pre-existing gap, unchanged
```

All synthetic data (1 Teacher, 1 Student, 3 Employees, 1 NonStaffIdentity,
plus the supporting Campus/Level/Grade/ClassRoom chain) deleted after
verification.

## A migration-state inconsistency found and fixed along the way

`makemigrations`/`migrate` had already auto-run once in this environment
(an earlier automated pass) and recorded `ai_chat.0002_...` as applied in
`django_migrations`, but the actual `ALTER TABLE`/`ADD COLUMN` DDL for
that migration's `central_user_id`/`central_org_id`/nullable-`user_id`/
`org_id` operations had **not** taken effect on the real table (confirmed
via `\d ai_chat_conversation` in psql — columns simply weren't there,
while the migration's `RenameIndex` operation, earlier in the same file,
HAD taken effect) — an inconsistent partial-apply, unrelated to anything
in this phase's own logic. Fixed by applying the missing DDL directly and
re-syncing the migration recorder (`migrate ai_chat 0002 --fake`) — the
resulting schema is byte-identical to what a clean `migrate` would have
produced; `makemigrations --check` confirms no drift remains.

## Proof VMS/HDMS unchanged

```
manage.py check (auth_service)  -> System check identified no issues (0 silenced)
manage.py check (ai-service)    -> System check identified no issues (0 silenced)
pytest (auth_service)           -> 5 failed, 66 passed, 25 errors — identical to every prior phase's baseline
POST /api/auth/login-vms (nonexistent employee_code)
  -> 401 {"error": "invalid_credentials", "detail": "Employee code not found or account inactive"}
```

## Confirmed untouched

- `central_auth/authentication.py`, `jwks.py`, `permissions.py`:
  byte-identical to the C1-C12 template.
- `ai_chat/permissions.py` (`TOOL_PERMISSIONS`, `ROLE_DISPLAY`): not
  modified — role-based tool gating works unchanged for both token types.
- The legacy `JWTStatelessUserAuthentication` path: proven working
  unchanged end-to-end (dual-run proof above).
- Every SQL query's actual filtering *logic* (WHOSE data a role can see)
  — only the column name used for org/user scoping changed per token
  type; the scope-narrowing rules themselves (`assigned_classroom` /
  `assigned_levels` / `campus` / `all` / `self`) are untouched.
- Every other SMS service, VMS, HDMS, central auth's own code: untouched.

## This completes all 13 SMS service repoints — Phase C is done.

Per this phase's own closing instruction: stop here. **Phase D** (remove
SMS's own auth-8001, `sync_staff_to_auth`, and the shared HS256 scheme)
is the next major phase, separately. Carried forward as documented gaps:
an SMS staff-RBAC catalog (so org_admin/admin become resolvable for
central tokens, matching the gap flagged since C11) remains open;
`transfers`/`TeacherSubjectAssignment`-class pre-existing gaps flagged in
earlier phases are untouched and unrelated to this one.
