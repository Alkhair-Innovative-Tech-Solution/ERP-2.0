# SMS User Shape Reconciliation — Phase A1 (Analysis Only)

Read-only analysis. No code changed. Deliverable per
`claude-code-sms-phase-a1-user-reconciliation-prompt.md`.

## 0. Bottom line

The 11 Dockerfile-copied services are **byte-identical by construction** —
they have no local `users/` directory of their own, so there is nothing to
diverge. The only real fork is **`org-service`**, and its divergence is
small and easy to classify: billing fields (`Invoice`, `activation_date`,
`payment_status` choices) plus one missing field (`User.is_deleted`) and one
missing permission choice. Everything else across all 13 copies is
identical. This report is short because the actual surface area is small —
see §1 for why 13 "copies" reduces to 2 comparisons.

## 1. Are the copies identical, or just similar? (Task 2 question)

Checked every one of the 11 Dockerfile-copied services' `Dockerfile`:

```
attendance-service/Dockerfile:33   COPY microservices/auth-service/users/ /app/users/
campus-service/Dockerfile:33       COPY microservices/auth-service/users/ /app/users/
content-service/Dockerfile:33      COPY microservices/auth-service/users/ /app/users/
fees-service/Dockerfile:33         COPY microservices/auth-service/users/ /app/users/
notification-service/Dockerfile:33 COPY microservices/auth-service/users/ /app/users/
result-service/Dockerfile:33       COPY microservices/auth-service/users/ /app/users/
staff-service/Dockerfile:33        COPY microservices/auth-service/users/ /app/users/
student-service/Dockerfile:33      COPY microservices/auth-service/users/ /app/users/
subject-service/Dockerfile:33      COPY microservices/auth-service/users/ /app/users/
support-service/Dockerfile:33      COPY microservices/auth-service/users/ /app/users/
timetable-service/Dockerfile:33    COPY microservices/auth-service/users/ /app/users/
```

None of these 11 services has a local `<service>/users/` source directory
(confirmed absent on disk for all 11) — there is nothing to have edited
even if someone wanted to. They are **identical by construction**, always
sourced from `auth-service/users/models.py` at image build time.

**Caveat (unresolved, flag as unknown):** identical *source* does not
guarantee identical *deployed schema* if a given service's image hasn't
been rebuilt since the last `auth-service/users/models.py` migration. No
live containers were inspected for this in this session (analysis-only,
per the prompt's rules) — worth a one-line check (`docker exec <svc>
python manage.py showmigrations users`) before Phase B, not now.

This collapses "13 copies" into **2 actual comparisons**: `auth-service`
(reference) vs. `org-service` (the only real fork), covered below.

## 2. Field-by-field User matrix

Reference: `auth-service/users/models.py` `User` (lines 93–225). Columns
collapse the 11 identical Dockerfile copies into one (`11× Dockerfile
copies`) since §1 established they're identical to `auth-service`.

| Field | auth-service | org-service | 11× Dockerfile copies |
|---|---|---|---|
| `email` (unique) | L114 | L154 — same | same |
| `username` (unique) | L115 | L155 — same | same |
| `organization` FK | L118 | L158 — same | same |
| `is_org_admin` | L119 | L159 — same | same |
| `role` (11 `ROLE_CHOICES`, L99–111) | L120 | L139–151, L160 — same | same |
| `campus` FK | L121 | L161 — same | same |
| `phone_number` | L122 | L162 — same | same |
| `biometric_id` | L123 | L163 — same | same |
| `photo` | L124 | L164 — same | same |
| `is_verified` | L125 | L165 — same | same |
| `last_login_ip` | L126 | L166 — same | same |
| `has_changed_default_password` | L127 | L167 — same | same |
| `token_version` | L130 | L170 — same | same |
| **`is_deleted`** | **L133** — present | **MISSING entirely** | same as auth-service |
| `employee_code` (property, not a DB field) | L135–143 | L172–180 — same logic | same |
| `created_at` / `updated_at` | L146–147 | L183–184 — same | same |
| `USERNAME_FIELD` / `REQUIRED_FIELDS` | L149–150 | L186–187 — same | same |
| all 10 role-check methods (`is_superadmin`…`can_view_all_data`) | L158–186 | L195–223 — same | same |
| `save()` auto-username/employee-code logic | L188–220 | L225–257 — same (one comment differs, L240 org-service adds `# global counter, no org scope`, no behavior change) | same |

**Result: exactly one field-level difference in `User` itself —
`is_deleted` is missing from `org-service`.** Everything else is identical,
including method bodies.

### Related models in the same file

| Model | auth-service | org-service |
|---|---|---|
| `SubscriptionPlan` | L8–42 (fields declared twice — pre-existing bug, both copies) | L8–42 — identical, same duplicate-field bug |
| `CODE_PATTERN_CHOICES` (5th entry) | L49: `PREFIX_NOSEP_SEQ4` → `KPS0001` | L49: `PREFIX_YYYY_ROLE_SEQ5_SLASH` → `IAK/2026/T/00001` — **different key AND label** |
| `STUDENT_ID_PATTERN_CHOICES` | L52–58, present | **entirely absent** |
| `Organization.payment_status` | L73 — bare `CharField(max_length=10, default='paid')`, **no choices constraint** | L68–73 — constrained to `PAYMENT_STATUS_CHOICES` (pending/paid/overdue) |
| `Organization.student_id_pattern` | L77, present | **absent** (follows from `STUDENT_ID_PATTERN_CHOICES` being absent) |
| `Organization.activation_date` | absent | **L74 — present, `DateTimeField(null=True, blank=True)`** |
| `Invoice` model | absent | **L91–130 — present entirely** (billing) |
| `PasswordChangeOTP` | L228–271 | L265–308 — identical |
| `RolePermission.PERMISSION_CHOICES` | 48 entries, includes L318 `view_network_performance_chart` | 47 entries — **`view_network_performance_chart` missing** (compare org-service L354→L356, the chart block ends one entry short) |
| `SystemVersion` | L351–381, present | **entirely absent from org-service** |

## 3. `org-service` — full divergence report (Task 3)

**org-service has, that auth-service doesn't (all billing, not identity):**
- `Invoice` model (org-service `users/models.py:91-130`) — invoicing/billing records tied to `Organization` + `SubscriptionPlan`.
- `Organization.activation_date` (L74) — when an org's subscription activated. Billing/lifecycle, not identity.
- `Organization.payment_status` choices constraint (L68-73) — stricter than auth-service's unconstrained version, still billing.
- `CODE_PATTERN_CHOICES`'s 5th option uses a different key/label (L49) — this affects `Organization.code_pattern` *display*, not `User` identity.

**auth-service has, that org-service doesn't:**
- `User.is_deleted` (auth-service L133) — a genuine identity/soft-delete field, missing in org-service. **This is the one identity-relevant gap**, not billing.
- `STUDENT_ID_PATTERN_CHOICES` + `Organization.student_id_pattern` (auth-service L52-58, L77) — student ID formatting config, arguably identity-adjacent (affects how `Student.student_id` is generated) but lives on `Organization`, not `User`.
- `SystemVersion` model — app-version tracking, unrelated to identity or billing.
- `RolePermission.PERMISSION_CHOICES` has one extra entry (`view_network_performance_chart`) — a permission catalog gap, not a `User` field.

**Split per the prompt's instruction** (separate billing from identity):
- **Billing/SubscriptionPlan/Invoice concern** (will split into its own service later, per prompt): `Invoice`, `Organization.activation_date`, `Organization.payment_status` choices, `SubscriptionPlan` (identical in both, not a divergence).
- **Genuine identity concern**: only `User.is_deleted` missing in org-service. This one matters for Phase B — if org-service is ever a write-source for `User` rows, a soft-deleted-in-auth-service user could look "alive" via org-service's copy of the model (though since both share one `users_user` DB table only if co-located — see note below — the practical risk depends on deployment topology, flagged as an open question in §6).

**Manager logic divergence (not in the prompt's field list, but material):**
`auth-service/users/managers.py` vs `org-service/users/managers.py` (diffed
directly) — auth-service's `OrganizationManager`/`MultiTenantUserManager`
has a JWT-claims fallback: when the `Organization` row isn't in the
current service's DB, it falls back to `getattr(user, 'org_id', None)`
(a claim carried on the stateless JWT `_TokenUser`, not a DB lookup).
org-service's manager only supports the real-object path
(`hasattr(org, 'created_by')`) — it has no such fallback. This means
query-scoping *behavior* differs between the two, even where the `User`
model fields are identical. Flagged as open question in §6.

## 4. Related identity models — identity vs. profile split (Task 4)

### Student (`student-service/students/models.py`)
- **Identity link**: `user = OneToOneField('users.User', on_delete=SET_NULL, null=True, blank=True, related_name='student_profile')` — nullable/soft link, confirmed present but not required.
- **Identity-adjacent field living on Student, not User**: `student_id = models.CharField(max_length=20, null=True, blank=True)` (line 269) — this is the *external* student login identifier. `User.save()` comment confirms the convention explicitly: `users/models.py:190` *"Students have their username set externally (student_id) so skip them"* — i.e. for role=`student`, `User.username` is populated FROM `Student.student_id`, not auto-generated. This is a real identity field, just sourced from the profile model instead of generated on User itself.
- **Everything else is profile data**: photo, name, gender, dob, place_of_birth, religion, mother_tongue, student_cnic, nationality, blood_group, special_needs_disability, email, phone/emergency contacts, father/mother/guardian family fields, address, family_income, house_owned, zakat_status, campus, classroom/last_classroom FKs, current_grade, section, enrollment_status/is_draft/is_deleted/is_active lifecycle flags, dynamic_data JSON, gr_no/old_gr_number/enrollment_year/shift ID-adjacent fields (lines 94–299, extensively). None of these belong in central-auth identity — they're SMS-domain student records.

### Teacher (`staff-service/teachers/models.py`)
- **Identity link**: `user = OneToOneField(User, on_delete=SET_NULL, null=True, blank=True, related_name='teacher_profile')` (line 70).
- **Identity-adjacent**: `User.employee_code` property (auth-service `users/models.py:138-139`) reads `self.teacher_profile.employee_code` — so Teacher's own `employee_code` field (not grepped with explicit line above but present per the `save()` collision-check pattern seen in Coordinator, same convention) is the actual source of truth for the User-level `employee_code` display.
- **Profile-only**: photo, full_name, father_name, dob, gender, contact_number, email, addresses, marital_status, cnic, biometric_id, signature, education_level/institution_name/year_of_passing/education_subjects/education_grade, prior-experience fields (institution/position/dates/subjects/responsibilities/total_experience_years) — lines 76–121. All SMS HR/profile data, not identity.

### Principal (`staff-service/principals/models.py`)
- **Identity link**: `user = OneToOneField(User, on_delete=SET_NULL, related_name='principal_profile', null=True, blank=True)` (line 68).
- **Identity-adjacent**: `employee_code` field (line 139) — same role as Teacher's, feeds `User.employee_code` property.
- **Profile-only**: photo, full_name, father_name, dob, gender, contact_number, emergency_contact, email, cnic, nationality, religion, permanent_address, marital_status, biometric_id, education/experience fields, designation, campus FK, shift, contract_type/contract_end_date, joining_date, status/is_currently_active, signature — lines 74–145.

### Coordinator (`staff-service/coordinator/models.py`)
- **No `user` FK field at all** — confirmed by full-file grep for "user" (case-insensitive): the only hits are `biometric_id`'s help text and the `save()` sync block. This is the weakest identity link of the four.
- **Identity link is a bare string convention**: `employee_code = CharField(...)` (line 109) is kept in sync with `User.username` via explicit code in `save()`:
  ```
  coordinator/models.py:187-194
      # Update User account if it exists (linked by employee_code/username)
      from users.models import User
      user = User.objects.filter(username=old_code).first()
      if user:
          user.username = new_code
          ...
  ```
  There is **zero DB-level referential integrity** — `Coordinator.employee_code` and `User.username` are two independently-editable CharFields kept aligned only by this one `save()` code path firing correctly. If a Coordinator row's `employee_code` is edited by any path that bypasses this `save()` method (bulk update, raw SQL, admin `update_fields` shortcut elsewhere), the link silently breaks with no error.
- **Profile-only**: photo, full_name, dob, gender, contact_number, email, cnic, biometric_id, addresses, marital_status, religion, education/experience fields, campus, level FK, assigned_levels M2M, shift, joining_date, is_currently_active, can_assign_class_teachers, signature — lines 55–116.

**Cross-model pattern**: all four (Student/Teacher/Principal/Coordinator)
duplicate a near-identical set of personal fields already covered by
`User` in spirit but not in fact — `User` itself carries very little
personal data (`phone_number`, `biometric_id`, `photo` only); everything
else (name, dob, gender, cnic, addresses, family/emergency info) lives
exclusively on the profile models, never on `User`. `User.employee_code`
is a *computed property*, not a stored field — its value is delegated to
whichever profile model is linked (Teacher/Principal by FK, Coordinator by
string match, Student implicitly via `student_id`).

## 5. Map SMS User fields → central auth (Task 5)

Central auth reference: `Auth-service-main/Backend/src/employees/models.py`
(`Employee`, lines 343-459; `Tenant`/`Organization`, lines 53-99) and
`authentication/models.py` (`UserCredentials`, lines 22-139) +
`authentication/superadmin_models.py` (`SuperAdmin`, lines 13-87).

| SMS `User` field | Central auth destination | Status |
|---|---|---|
| `email` | `Employee.org_email` / `personal_email` (models.py:408, 375) | (a) exists, different field names/split |
| `username` | No equivalent — central auth logs in via `employee_code` (`employees/models.py:356-359`), not a separate username | (b) needs a decision: keep `username` as SMS-local, or map onto `employee_code`? See §6 |
| `organization` FK | `Employee.organization` (models.py:361) → `Organization.tenant` (models.py:79-86) | (a) exists, richer hierarchy (central auth has Tenant→Organization→Institution→Branch→Department, SMS only has flat Organization) |
| `role` (11 choices) | No direct equivalent — central auth has no `role` field on `Employee`; role/permission comes from `permissions.ServiceAccess` + a per-service role catalog (e.g. `HdmsRole`, and per the earlier `sis` cleanup doc, an analogous SMS role catalog would be needed) | (b) needs adding — an SMS role catalog analogous to HDMS's, gated via `ServiceAccess(service='sms')` |
| `campus` FK | No equivalent in central auth (central auth's structure is Branch, not Campus) | (c) stays SMS-profile data — campus is SMS-specific, not a central-identity concern |
| `phone_number` | `Employee.org_phone` / `personal_phone` (models.py:409, 374) | (a) exists |
| `biometric_id` | No field on `Employee` | (b) needs adding, if biometric login is to be centralized; else (c) stays SMS-local |
| `photo` | `Employee.resume_url` is the closest (a URL, not an ImageField) — no direct photo field | (b) needs adding, or (c) stays SMS-local if photo storage remains service-local |
| `is_verified` | No equivalent | (c) likely stays SMS-profile (email/onboarding verification, not core identity) |
| `last_login_ip` | `UserCredentials.last_login_ip` (authentication/models.py:64-68) | (a) exists, already tracked centrally |
| `has_changed_default_password` | No direct equivalent, but `UserCredentials` tracks `password_changed_at` (authentication/models.py:70-73) | (a) mostly covered — presence of a `password_changed_at` timestamp can derive "has changed" |
| `token_version` | No equivalent — central auth invalidates sessions via `RefreshToken.is_revoked` / `BlacklistedToken` (authentication/models.py:142-283), a different mechanism | (c) SMS-specific mechanism, likely dropped once central JWT/refresh model takes over |
| `is_deleted` | `Employee` inherits `SoftDeleteModel` (employees/models.py:343, `from .utils import SoftDeleteModel`) | (a) exists, same soft-delete pattern already used centrally |
| `employee_code` (property) | `Employee.employee_code` (models.py:356-359) — but centrally it's **auto-generated from `EmployeeAssignment`**, not user-editable | (a) exists, but generation logic differs — central auth derives it from department/branch/designation/shift (models.py:490-522), SMS derives it from campus/shift/role via `IDGenerator` (SMS-local). **Conflict** — see §6. |
| `created_at` / `updated_at` | `Employee` (via `SoftDeleteModel`, timestamps present in all central models) | (a) exists |
| Password/credentials (not on `User` itself in SMS — no `password` field shown, `AbstractUser` supplies it) | `UserCredentials.password_hash` (authentication/models.py:53-56), fully separated from identity, matching Django's own separation | (a) exists, same separation pattern already used centrally |
| `student_id` (on `Student`, not `User`, but functions as student's `username`) | No equivalent — central auth's `Employee` model has no concept of a non-employee (student) identity at all | (b) needs adding — central auth would need either a parallel lightweight identity model for students, or an `Employee`-adjacent "Person" abstraction; **not decided, flag as open question** |
| Role catalogs' data (`RolePermission` — org-scoped, custom per-org toggles) | `permissions.ServiceAccess` + service-specific role models (pattern: `HdmsRole`, `VmsRole` in `Auth-service-main/Backend/src/permissions/`) | (a) pattern exists, (b) an SMS-specific role catalog needs building, following the same shape |

## 6. Proposed canonical SMS user shape + open questions (Task 6)

### Canonical field list ("true SMS user")

Source of truth is `auth-service/users/models.py` `User` (not org-service —
org-service is missing `is_deleted`, which is the more complete/correct
shape). Per field:

| Field | Source of truth | Central-auth destination | Conflict? |
|---|---|---|---|
| `email` | auth-service `User.email` | `Employee.org_email`/`personal_email` | Field split — needs a mapping decision |
| `username` | auth-service `User.username` | none currently | **Open — see Q1** |
| `role` | auth-service `User.role` (11 choices) | none currently (would need SMS role catalog) | **Open — see Q2** |
| `organization` | auth-service `User.organization` | `Employee.organization` → `Tenant` | Structural mismatch (flat vs. hierarchical) — SMS `Organization` maps to central `Tenant`+`Organization` combined, needs a 1:1 rule |
| `phone_number` | auth-service `User.phone_number` | `Employee.org_phone`/`personal_phone` | Field split, same shape as email |
| `campus` | auth-service `User.campus` | none — stays SMS-profile | Not a conflict, just confirmed out-of-scope for central identity |
| `biometric_id` | auth-service `User.biometric_id` | none | **Open — see Q3** |
| `photo` | auth-service `User.photo` | none (Employee has `resume_url` only) | Minor — needs a field type decision (URL vs. ImageField) |
| `is_verified`, `has_changed_default_password`, `token_version` | auth-service `User` | none (different mechanisms exist centrally) | Not conflicts — SMS-specific mechanics likely retired at migration, not mapped |
| `is_deleted` | auth-service `User.is_deleted` (org-service is missing this — auth-service wins as source of truth) | `Employee` (via `SoftDeleteModel`) | Already compatible pattern |
| `employee_code` | auth-service `User.employee_code` property, generated via `Teacher`/`Principal.employee_code` or `Coordinator` string-match or `IDGenerator` for admin roles | `Employee.employee_code`, generated via `EmployeeAssignment` (different algorithm) | **Open — see Q4** |
| `student_id` (on `Student`, functions as student identity) | `student-service/students/models.py:269` | no equivalent identity concept centrally | **Open — see Q5** |
| Password (`UserCredentials`-equivalent; SMS uses `AbstractUser`'s built-in `password`) | Django built-in, on `User` itself | `UserCredentials.password_hash`, already separated from identity | Compatible pattern, no conflict — just needs a migration mechanic (later phase) |

### Open questions (need decisions before Phase B)

1. **`username` vs. `employee_code`** — central auth has no free-standing
   `username`; it authenticates by `employee_code`. Does SMS's `username`
   become the new central `employee_code` verbatim, get regenerated under
   central auth's own numbering scheme (`EmployeeAssignment`-derived), or
   do both coexist (SMS-local username, central `employee_code` as a
   second identifier)?

2. **Role/permission model** — central auth has no `role` field on
   `Employee`; HDMS/VMS instead use a `ServiceAccess` + per-service role
   catalog pattern (`HdmsRole`, `VmsRole`). Does SMS's 11-value `role`
   choice list become an `SmsRole` catalog following that exact pattern
   (recommended, for consistency with the `sis`-cleanup precedent that
   already established this convention), or something else?

3. **`biometric_id` and `photo`** — currently only exist in SMS. Do these
   get added to central `Employee` (making them available to all
   ERP services, not just SMS), or do they stay SMS-local profile data
   fetched from a separate SMS microservice call after central login?

4. **`employee_code` generation algorithm mismatch** — SMS generates
   codes via campus/shift/role and a **local, service-specific**
   `IDGenerator`; central auth generates via
   department→branch→institution→designation chain
   (`EmployeeAssignment.save()`, `employees/models.py:490-522`). These are
   two genuinely different numbering schemes. If SMS users are migrated
   into central `Employee` rows, whose code format wins — are existing SMS
   `employee_code`/`username` values preserved as a legacy identifier, or
   regenerated under central auth's scheme (which would break any SMS UI
   or report that displays the old code)?

5. **Student identity** — central auth's `Employee` model is built for
   *staff* (has `EmployeeAssignment`→`Department`/`Designation`, an HR
   concept). Students have no natural home there. Does central auth need
   a parallel lightweight identity concept for non-employees (donors,
   students), or do students simply never move into central auth and stay
   permanently SMS-local (i.e., only staff — Teacher/Principal/Coordinator/
   admin roles — get centralized, not students)? This determines whether
   `Student.student_id` is in scope for Phase B at all.

6. **Coordinator's string-only link** — before any migration touches
   Coordinator identity, the `employee_code == User.username` convention
   (no FK, `coordinator/models.py:187-194`) needs a decision: migrate it to
   a real FK first (a small SMS-internal fix, separate from central-auth
   work), or carry the fragility forward into the mapping?

7. **Manager/query-scoping logic divergence** (§3) — auth-service's
   `MultiTenantUserManager`/`OrganizationManager` support a JWT-claims
   fallback that org-service's copy lacks. Not a `User`-field conflict,
   but if org-service ever needs to resolve `Organization` via JWT claims
   (e.g., cross-service calls), its manager would need the same fallback
   added — flagging so it isn't missed as "just billing."

---

## Console summary (also printed to chat)

**Canonical field list**: `email`, `username`, `role`, `organization`,
`phone_number`, `campus`, `biometric_id`, `photo`, `is_verified`,
`has_changed_default_password`, `token_version`, `is_deleted`,
`employee_code` (computed), `student_id` (on Student, functions as
identity for role=student), password (via Django `AbstractUser`).
Source of truth: `auth-service/users/models.py` (org-service is the
same shape minus `is_deleted`).

**Top 3 conflicts/decisions needed:**
1. **`username`/`employee_code` reconciliation** (Q1 + Q4) — SMS and
   central auth each generate employee identifiers with different
   algorithms; migration must decide which wins and whether the other is
   preserved as a legacy alias.
2. **No `role` concept in central auth** — SMS's 11-value role list has no
   home there yet; needs an `SmsRole` catalog mirroring the existing
   `HdmsRole`/`VmsRole` pattern before any SMS user can carry a role
   post-migration.
3. **Students have no identity model in central auth** — `Employee` is an
   HR/staff concept; whether students are ever centralized (and thus
   whether `Student.student_id` matters for this migration at all) is
   undecided and blocks scoping Phase B.
