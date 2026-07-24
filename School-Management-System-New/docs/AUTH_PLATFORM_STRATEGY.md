# Unified Auth Platform — Architecture & Migration Strategy

> **Scope:** Analysis of three repositories — SMS (School Management System), AIT-LMS (Learning Management System), and the Auth Service (transformation target) — followed by a strategy to turn the Auth Service into a standalone, domain-agnostic Authentication & Authorization microservice.
>
> **Status:** Proposal — no code has been modified. Pending team approval.
>
> **Companion doc:** [`SYSTEMS_COMPARISON.md`](../../SYSTEMS_COMPARISON.md) — honest per-concern comparison of the three systems and the whole-platform unification topology.
>
> **Date:** 2026-07-17

---

## Table of Contents

1. [Current Architecture Summary](#1-current-architecture-summary)
2. [Feature Comparison Matrix](#2-feature-comparison-matrix)
3. [Canonical Identity Model](#3-canonical-identity-model)
4. [Canonical Authorization Model](#4-canonical-authorization-model)
5. [Proposed Auth Service Architecture](#5-proposed-auth-service-architecture)
6. [Migration Strategy](#6-migration-strategy)
7. [Risks & Trade-offs](#7-risks--trade-offs)
8. [Step-by-Step Implementation Roadmap](#8-step-by-step-implementation-roadmap)

---

## 1. Current Architecture Summary

### 1.1 SMS (School Management System) — `SMS/`

**Shape:** True microservices estate. 16 Django services (auth, org, campus, staff, student, attendance, result, fees, timetable, subject, content, notification, support, AI, frontend-service) behind an **nginx gateway**, with **database-per-service** (14 Postgres instances), RabbitMQ (`ams.events` topic exchange), Redis, MinIO, and a Next.js frontend.

**Identity & tenancy:** `users.User` extends `AbstractUser` with a fixed `role` enum of 11 roles (superadmin, admin, org_admin, principal, coordinator, teacher, donor, accounts_officer, admissions_counselor, compliance_officer, **student**). This is a genuine **multi-tenant SaaS**: `Organization` carries `subdomain`, `SubscriptionPlan` (max users/students/campuses, per-student pricing), `payment_status` (login is blocked org-wide on unpaid invoices, except org_admin), `enabled_features` JSON, and configurable ID-code patterns (`PREFIX_YY_ROLE_SEQ4`, etc.). Row-level tenancy is enforced through custom managers (`OrganizationManager`, `MultiTenantUserManager`). Users also carry `campus` FK, `biometric_id` (FoxFace attendance integration), `token_version`, and a soft-delete flag.

**AuthN/tokens:** SimpleJWT, **HS256 with one shared secret across all 16 services**. Login (`users/views.py`) embeds claims: `user_id, role, org_id, campus_id, username, email, token_version`. Downstream services validate **statelessly** via `ams-shared`'s `ServiceJWTAuthentication` → `_TokenUser` (no DB hit; known gotcha: `_TokenUser.organization` is always `None` — services must use `org_id`). `token_version` mismatch force-invalidates sessions on role switch. Forced-password-change flow uses email **OTP** (`PasswordChangeOTP`); students get a bypass token. Default password for provisioned staff is `'12345'`.

**AuthZ:** `RolePermission` — a per-organization, per-role toggle table over ~50 hardcoded permission codenames (including per-chart/per-KPI dashboard permissions). Role checks are helper methods on the user (`can_manage_campus()`, etc.) plus decorators in services.

**Coupling red flags:**

- Login **directly connects to the staff-service Postgres via psycopg2** to fetch a principal's `campus_id`, and hydrates profiles with raw SQL against other services' databases — bypassing service boundaries.
- staff-service and org-service call `auth-service` HTTP APIs to create users (`UserCreationService`); auth-service consumes `org.created/org.updated` events to mirror the Organization table.
- Employee/student code generation lives in auth (`GlobalCounter`, thread-safe org-wide sequences).

### 1.2 AIT-LMS — `AIT-LMS/`

**Shape:** 6 Django services (auth, course, admission, notification, certification, content) behind a **FastAPI API gateway** (pure reverse proxy with per-route public/private flags; actual token validation happens in each service), single shared Postgres instance, Redis, RabbitMQ, nginx, two Next.js frontends (`ait_fe` public admission portal, `Lms_fe` LMS).

**Identity & tenancy:** `users.User` extends `AbstractBaseUser`, **UUID PKs, email as username**, role enum of 6 roles (admin, teacher, student, coordinator, account_officer, lead). **Single organization, multi-branch**: `Branch` model (PH/NG/GS codes), teachers have M2M cross-branch assignment, admins are branch-null (all-branch). Per-user `features_access` JSON toggles, `must_change_password` flag, soft delete.

**The big problem:** the LMS auth service is a **domain dumping ground**. It owns the entire admission/enrollment lifecycle: `Student` (admission status machine, receipt-code verification, deposits with bag/ID-card/certificate fees and refund calculation, batch/level/specialization), `ReceiptCode` (a financial record), `StudentTransferHistory`, `TeacherAttendance`, guardian/residential/academic records, and Google Sheets import pipelines. Auth, admission, finance, and HR concerns are fused into one service.

**AuthN/tokens:** Shared `common.jwt_utils` — **HS256, default secret `'your-secret-key-change-in-production'`**, 24-hour access tokens, 7-day refresh, minimal claims (`user_id, email, role`). The shared `JWTAuthentication` contains dangerous heuristics: *"if email contains 'admin', role MUST be ADMIN"* — a privilege-escalation-by-email-naming bug waiting to happen. No token revocation, no blacklist, no token versioning. `PasswordResetToken` for resets.

**AuthZ:** `roles_required([...])` decorator, `ADMIN` bypasses everything; `RolePermission` stores one JSON permission dict per role (global, not tenant-scoped).

### 1.3 Auth Service (target) — `Auth-service/`

**Shape:** Service monorepo — Django 5 + django-ninja backend, Next.js 16 admin frontend. Already serves an ERP family (HDMS help-desk, VMS visitor management, SIS) on a shared `erp_network`.

**Identity:** The most mature identity model of the three:

- Hierarchy: `Organization → Institution (typed: educational/healthcare/social_welfare/…) → Branch → Department → Designation → Employee`, joined via `EmployeeAssignment` (multi-role, `is_primary` drives derived `employee_code`; dual-ID system `IAK-0001` + `C06-M-24-T-0001`). Everything is `SoftDeleteModel`.
- **Credentials separated from identity**: `UserCredentials` (XOR link to `Employee` or `SuperAdmin`) with lockout (5 failures → 30 min), password-change timestamps, last-login IP. `SuperAdmin` is a distinct model, not a flag.
- Caveat: `Employee` also carries deep **HR payload** (bank account, education history, work experience, marital status) — HR concerns living inside the auth boundary.

**AuthN/tokens:** **RS256 keypair** — private key only in auth service, consumers verify with the public key (`docs/jwt-key-management.md`). Access 1h / refresh 7d, `jti`, `token_type`, persisted `RefreshToken` rows (per-device, revocable) + `BlacklistedToken` on logout. Claims: `user_id, code, full_name, email, is_superadmin` (+ department/designation for employees).

**AuthZ — two generations coexist:**

1. **Service registry**: `Service` (add a row per downstream app) + `ServiceAccess` grants (with granted_by/revoked_by audit trail) — but per-service roles are **hardcoded model classes** (`HdmsRole`, `VmsRole` with auto-set boolean capability flags), and each service grew its **own login endpoint** (`/login`, `/login-hdms`, `/login-vms`, `/login-sis`). The registry's "no code change" promise is broken by both.
2. **Generic RBAC (newer)**: `Permission` (codename, service), `Role` (service-scoped bundle, runtime-managed), `EmployeeRole` (with generic-FK **scope** field ready for branch/institution scoping, currently global), `EmployeePermissionOverride` (allow/deny). Effective permissions = `(role perms ∪ allowed overrides) − denied overrides`, Redis-cached 5 min with explicit invalidation. This is the right foundation.

Plus a dedicated **audit app**, permission-change audit log, and real consumers already integrating remotely (HDMS `RemoteJWTAuthentication`).

---

## 2. Feature Comparison Matrix

| Capability | SMS | AIT-LMS | Auth Service (target) | Verdict |
|---|---|---|---|---|
| **Framework** | Django + DRF/SimpleJWT | Django + Ninja/DRF mix | Django 5 + Ninja | Compatible |
| **User PK** | int (AbstractUser) | UUID | UUID | Canonical: UUID |
| **Login identifier** | username (employee code) **or** email | email | employee_code | Must support **multiple aliases** |
| **Token algorithm** | HS256, one shared secret | HS256, weak default secret | **RS256 keypair** | RS256/JWKS wins |
| **Access/refresh TTL** | SimpleJWT defaults | 24 h / 7 d | 1 h / 7 d | Per-service policy needed |
| **Revocation** | `token_version` (role switch) | none | Refresh-token DB + blacklist | Merge: version **and** revocation |
| **Stateless downstream validation** | ✅ `ams-shared` TokenUser | ✅ shared lib (with unsafe fallbacks) | ✅ public-key verify | Shared pattern — keep |
| **Multi-tenancy** | **Multi-org SaaS** + subscription/billing gates | Single org, multi-branch | Single org, multi-institution hierarchy | Conflict — see §3 |
| **Org hierarchy** | Org → Campus | Branch (flat) | Org → Institution → Branch → Dept → Designation | Auth's tree generalizes both |
| **Roles** | 11 fixed enum roles | 6 fixed enum roles | Runtime `Role` table per service | RBAC tables win |
| **Fine-grained permissions** | `RolePermission` (org × role × codename toggle) | JSON dict per role | Permission/Role/Override + scope | Auth RBAC supersedes both |
| **Scoped roles (campus/branch)** | via `campus_id` claim ad hoc | via `branch` FK ad hoc | Generic-FK scope (designed, unused) | Needed by both — activate it |
| **Students/non-staff identities** | Students **are Users** | Students are Users + heavy profile | ❌ Employees only | **Biggest gap in target** |
| **Guardian/parent identity** | implicit | GuardianInfo (not a login) | ❌ | Future persona |
| **Forced password change** | OTP-gated flow | `must_change_password` flag | ❌ | Consolidate |
| **Password reset** | Email OTP | Reset token | ❌ (admin reset only) | Consolidate |
| **Account lockout** | ❌ | ❌ | ✅ 5 tries / 30 min | Shared win |
| **Audit logging** | scattered | `AdminActionLog` | Dedicated audit app + PermissionAudit | Auth wins |
| **ID/code generation** | Org-configurable patterns + GlobalCounter | `AIT-BR-YYYY-CODE-0001` | Assignment-derived codes | **Pluggable generator** required |
| **Feature flags/entitlements** | Org `enabled_features` + plan limits | Per-user `features_access` | ❌ | New entitlements concern |
| **Billing/subscription gating login** | ✅ | ❌ | ❌ | SMS-specific → policy hook |
| **Domain data inside auth** | Profile hydration via cross-DB SQL | Admissions, deposits, transfers, teacher attendance | HR payload on Employee | All three violate separation |
| **Events** | RabbitMQ `ams.events` (org.*, student.*) | RabbitMQ topic | ❌ none | Auth must **publish** identity events |
| **Service-to-auth provisioning** | staff/org services call auth HTTP | Google Sheets sync jobs | Admin UI + migration scripts | SCIM-like provisioning API |
| **Existing auth consumers** | 15 sibling services | 5 sibling services | HDMS, VMS, SIS | 20+ consumers total |

### Shared capabilities (consolidate)

JWT issuance/refresh/verify · credential storage & lockout · forced password change + reset (OTP and link) · roles & permission checks · org-unit scoping · soft delete · audit · session/device tracking · identity event publication · ID-code generation.

### Unique SMS requirements

Multi-org SaaS tenancy · subscription/payment login gating · org-configurable ID patterns · `token_version` semantics · per-org role-permission matrix · student + donor personas · biometric ID linkage · OTP flows.

### Unique LMS requirements

Email-first login · admission-driven user lifecycle (lead → applicant → enrolled student) · receipt-code account activation · cross-branch teacher assignment · per-user feature toggles · Google Sheets import (transitional).

### Potential conflicts

Token algorithm & claim contracts · int vs UUID subject IDs · "organization" meaning (tenant vs institution) · role vocabularies · students-as-users vs employees-only · two different `RolePermission` shapes · three different code-generation schemes · login-blocking business rules (billing) that don't belong in a domain-agnostic IdP.

---

## 3. Canonical Identity Model

The unifying insight: **separate who someone is, how they log in, and what they are in each system.**

```
┌────────────┐      ┌──────────────┐       ┌─────────────────────┐
│  Account    │1────1│ Credentials  │       │ Tenant (Organization)│
│ (login/sub) │      │ pwd, lockout │       │ SMS org / AIT / IAK  │
└─────┬──────┘      └──────────────┘       └──────────┬──────────┘
      │1                                               │
      │             ┌──────────────┐                   │
      ├──*──────────│ Identifier    │        ┌─────────▼─────────┐
      │             │ email/username│        │ OrgUnit (closure   │
      │             │ /emp_code/    │        │ tree, typed nodes: │
      │             │ biometric_id  │        │ institution/branch/│
      │1            └──────────────┘        │ campus/department) │
┌─────▼──────┐                              └─────────┬─────────┘
│  Person     │  profile basics only                   │
│ (name, dob, │                                        │
│ cnic, phone)│                                        │
└─────┬──────┘                                        │
      │*                                               │
┌─────▼──────────────────────────────────────────────▼───┐
│ Persona (type: employee|student|guardian|donor|lead,     │
│ tenant, org_unit, external_ref → domain-service profile, │
│ status lifecycle, valid_from/to)                          │
└──────────────────────────────────────────────────────────┘
```

- **Account** — the authentication subject (`sub` in JWT, UUID). One human = one account, even if they're a teacher in SMS and a student in LMS.
- **Identifier** — N login aliases per account (email, username, employee_code, student_id, biometric_id) with `type` + `tenant` uniqueness. Resolves the SMS-username vs LMS-email conflict without forcing either to change.
- **Credentials** — target service's `UserCredentials` generalized to hang off Account (keep lockout, IP tracking, password history; add OTP/reset-token tables from SMS/LMS).
- **Person** — minimal PII (full name, CNIC, DOB, contacts). **HR payload (bank, education history) and student payload (deposits, guardians) move out** — they belong to HRMS/staff-service and admission/student-service respectively, referenced by `external_ref`.
- **Persona** — the bridge between identity and domain: "this account is a *teacher* at *Campus C06* in *tenant IAK-SMS*" / "this account is an *enrolled student* in *AIT-Nagan branch*". Personas carry lifecycle status (applicant → enrolled → alumni; hired → active → terminated). The target's `EmployeeAssignment` becomes the employee-persona's assignment detail.
- **Tenant + OrgUnit tree** — `Organization` is the tenant (SMS has many; LMS and IAK-ERP each have one). OrgUnit is a typed adjacency/closure tree that generalizes SMS `Campus`, LMS `Branch`, and the target's Institution→Branch→Department chain. Tenant config holds what SMS keeps on Organization today: ID-code patterns, password policy, token TTLs, enabled features. Subscription/billing stays in SMS's org-service and is consulted via a **policy hook**, not stored in auth.

---

## 4. Canonical Authorization Model

Extend the target's newer RBAC generation; retire both `RolePermission` variants and the hardcoded `HdmsRole`/`VmsRole` classes.

- **Service (audience)** — registry row per client app (`sms`, `lms`, `hdms`, `vms`, `sis`, future `erp`, `crm`). Each declares: allowed grant types, token TTLs, claim-enrichment plugin, redirect/CORS config. One generic `/login` with a `service` parameter (or OIDC `aud`) replaces the per-service login endpoints.
- **Permission** — `service + codename` (seeded by engineering, as today). SMS's 50 codenames and LMS's JSON keys import 1:1.
- **Role** — service-scoped, tenant-owned bundle of permissions, editable at runtime. System roles (seeded defaults per service: `sms:teacher`, `lms:student`…) + custom tenant roles. SMS's per-org `RolePermission` matrix becomes per-tenant role definitions.
- **RoleAssignment** — `account (or persona) × role × scope(OrgUnit|Tenant|global)`. The target's `EmployeeRole` with the scope generic-FK activated — exactly what SMS needs for campus-scoped principals and LMS for branch-scoped coordinators.
- **Override** — per-account allow/deny (already built).
- **Effective permission resolution** — keep the existing formula and Redis cache: `(∪ role perms at matching scopes ∪ allows) − denies`, superadmin bypass.
- **Entitlements (plan features)** — separate check: tenant-level feature flags (SMS `enabled_features`, LMS `features_access` normalized to role/tenant level). Evaluated alongside RBAC: *can this tenant use the feature* AND *can this user perform the action*.

### Canonical token contract (v2)

```json
{
  "iss": "https://auth.iak.ngo", "sub": "<account uuid>", "aud": "sms",
  "exp": 0, "iat": 0, "jti": "…", "token_type": "access", "ver": 3,
  "tenant_id": "<org uuid>",
  "persona": {"type": "teacher", "id": "<persona uuid>", "code": "C01-M-25-T-0045"},
  "scope_units": ["<campus uuid>"],
  "roles": ["teacher"],
  "email": "…", "name": "…",
  "ext": { }
}
```

- `ver` replaces SMS `token_version` (bump on role change → all old tokens die statelessly).
- `ext` is filled by the **per-service claim enricher plugin** — e.g., the SMS enricher maps `tenant_id→org_id`, `scope_units[0]→campus_id`, adds `username`; the LMS enricher adds legacy `role` casing. During migration the enrichers emit the **exact legacy claim names** so downstream services don't break.
- Signed RS256; **JWKS endpoint** (`/.well-known/jwks.json`) so keys rotate without redeploying 20 services.

---

## 5. Proposed Auth Service Architecture

**Recommendation: one deployable service, internally modularized (modular monolith), with plugins — not three services.** All three systems are Django/Python, share one ops team, and the coupling between authn/authz/identity is high; a physical split (IdP vs authz vs profile) would triple operational cost for no isolation benefit at this scale. The split that *does* matter is **evicting domain data** (HR payload, admissions, deposits) into the domain services that own it.

```
auth-platform (Django 5 + Ninja)
├── identity/        Account, Identifier, Person, Persona, lifecycle events
├── tenancy/         Tenant, OrgUnit tree, TenantConfig (policies, ID patterns)
├── authn/           Credentials, OTP, reset, lockout, sessions,
│                    RefreshToken, Blacklist, token minting (RS256 + JWKS)
├── authz/           Service registry, Permission, Role, RoleAssignment(scoped),
│                    Override, entitlements, decision API + Redis cache
├── audit/           (existing) auth + permission + admin action audit
├── provisioning/    SCIM-like API: create/activate/suspend accounts,
│                    bulk import, invitation flows (replaces UserCreationService,
│                    Google Sheets jobs become clients of this API)
├── events/          RabbitMQ publisher: account.created, persona.enrolled,
│                    role.assigned, account.suspended … (topic: auth.events)
└── plugins/         per-service adapters, registered in Service registry:
    ├── claims/      SmsClaimEnricher, LmsClaimEnricher, HdmsClaimEnricher
    ├── policies/    login gate hooks (SMS billing check via org-service API,
    │                LMS receipt-code activation check)
    └── idgen/       code generators (SMS pattern engine, AIT student-ID,
                     IAK employee-code) selected by TenantConfig
```

**What is shared (core, no per-system logic):** token issuance/verification, credentials & lockout, refresh/blacklist/versioning, OTP + reset, account/person/persona CRUD, org-unit tree, RBAC engine, audit, provisioning API, event publication.

**What is configurable (per tenant/service):** login identifier types, password policy, token TTLs, OTP vs link resets, ID-code patterns, role catalogs, feature entitlements, session limits.

**What is a plugin (unavoidable domain behavior):** claim enrichment per audience, login-gate policies (billing, admission status), ID generators, legacy-compat claim mapping. Plugins are in-process Python classes registered against the Service row — new system = new row + optional plugin, **never** a new login endpoint.

**What stays out (domain services own it):** student admission/fees/transfers (LMS admission-service, SMS student/fees services), teacher attendance, HR records (bank/education → future HRMS/staff-service), subscriptions/invoices (SMS org-service), dashboards' data-permission semantics (services interpret permission codenames).

### Integration surface

1. `POST /api/auth/token` (password grant, `aud` param) · `/refresh` · `/logout` · `/me` · JWKS.
2. Verification stays **stateless in consumers** — upgrade `ams-shared` and LMS `shared/common` to RS256+JWKS with legacy-claim compatibility; this preserves the best property both estates already have.
3. Decision API `GET /api/authz/permissions?aud=sms` for permission-set hydration (cached), plus optional `POST /check` for server-side checks.
4. `auth.events` topic → services sync local read models (replaces SMS's cross-DB SQL and org-mirror consumer with a sanctioned pattern).
5. Provisioning API consumed by SMS staff-service, LMS admission-service, and future ERP/CRM/HRMS.

### Can a single service satisfy all three?

Yes — with the plugin seams above. The escape hatch if it ever doesn't: because verification is stateless and the contract is OIDC-shaped, the platform can later be swapped for / federated with Keycloak or split into IdP + PDP without touching consumers.

> **Note:** adopting **Keycloak outright** was considered and rejected — the org-unit-scoped RBAC, tenant ID-pattern engines, and deep legacy-claim compatibility would push Keycloak into heavy SPI customization, and the team already has a working Django RS256 core to evolve.

---

## 6. Migration Strategy

**Pattern: Strangler fig + dual-issuance windows. Never a big-bang cutover; schools are live.**

### Guiding rules

1. Consumers change **only their shared auth lib**, never their business code (legacy claims preserved by enrichers).
2. Each phase is independently reversible; old and new paths run in parallel behind flags.
3. Data flows one way during migration: legacy systems remain **writers** of identity until their cutover phase completes; auth-platform mirrors via sync, then ownership flips.

### Sequence

*(LMS first — smaller, weaker security, biggest win; SMS second; ERP family last since it's already on the target.)*

| Phase | Description |
|---|---|
| **M0 — Contract freeze** | Publish token-claims v2 spec, JWKS, error contracts, event schemas. Sign-off from all three teams. |
| **M1 — Verifier upgrade** (no issuer change) | Ship `ams-shared` v2 and LMS `shared/common` v2 that verify **both** legacy HS256 and new RS256 tokens (try JWKS first, fall back to shared secret). Deploy to all ~20 services. Zero user impact; removes the LMS default-secret and email-heuristic vulnerabilities in the same release. |
| **M2 — Identity backfill** | ETL SMS `users_user` and LMS `users_user` into Account/Identifier/Person/Persona/Tenant/OrgUnit (password hashes are Django-format in all three — they migrate verbatim). Nightly reconciliation job + report until cutover. Duplicate humans across systems get linked by CNIC/email where confident, else remain separate accounts (merging is a post-migration cleanup, not a blocker). |
| **M3 — LMS login delegation** | LMS auth-service `/login` becomes a façade calling auth-platform (`aud=lms`); response shape unchanged. Writes (registration, password change) proxied through the provisioning API. Admission flow keeps creating students in LMS, which provisions accounts via API instead of local `User` rows. |
| **M4 — LMS RBAC + eviction** | Import role JSON dicts into Role/Permission; switch `roles_required` to token roles + decision API. Then relocate Student/ReceiptCode/Transfer/TeacherAttendance models to admission/course services (a domain refactor that can proceed independently once auth is out of the way). |
| **M5 — SMS login delegation** | Same façade pattern. SMS billing gate becomes a policy plugin calling org-service. The psycopg2 cross-DB campus lookup is replaced by the SMS claim enricher reading `scope_units` (populated from Persona/RoleAssignment at provisioning time). `token_version` maps to `ver`. |
| **M6 — SMS RBAC** | Migrate per-org RolePermission rows into tenant-scoped Role definitions; SMS keeps its permission-matrix admin UI but reads/writes via the auth-platform API. |
| **M7 — Ownership flip & decommission** | Legacy `User` tables become read-only caches synced from `auth.events`, then dropped where feasible (SMS services that FK to `users_user` keep a slim local mirror — id, name, role — maintained by events). Retire HS256 issuance; rotate secrets out. |
| **M8 — ERP family alignment** | Collapse `login-hdms/vms/sis` into the generic token endpoint with audiences; convert HdmsRole/VmsRole rows into RBAC Role assignments; move Employee HR payload out to the staff/HRMS boundary when that service exists. |

---

## 7. Risks & Trade-offs

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **Dual identity sources drift** during M2–M6 (user edited in legacy while mirrored in platform) | High | One-way ownership rule + nightly reconciliation with diff alerts; short phase windows per tenant |
| 2 | **Claim-contract regressions** break a downstream service silently (20+ consumers, some with fallback heuristics) | High | Contract tests: golden-token fixtures per audience run in every consumer's CI; enrichers emit legacy claims byte-compatible |
| 3 | SMS **login blocks** (billing/inactive org) accidentally lost or double-applied | Med | Policy plugin covered by explicit test matrix (paid/unpaid × role) before M5 |
| 4 | **Auth platform becomes a SPOF** for three estates | Med | Stateless verification means outages only block logins/refresh, not active sessions; HA deploy + Redis/Postgres replicas; JWKS cached in consumers |
| 5 | **Password hash / identifier collisions** in backfill (same email in SMS and LMS as different people) | Med | Identifier uniqueness is per-tenant; cross-tenant linking only on high-confidence match, manual review queue |
| 6 | LMS **domain eviction** (M4b) stalls and auth keeps admission tables | Med | Deliberately decoupled: login delegation (M3) doesn't depend on it; track as separate workstream |
| 7 | `token_version` semantics subtly differ from blacklist behavior (SMS expects instant invalidation on role switch) | Low | `ver` claim checked statelessly in shared lib, identical UX; add role-change → refresh-revocation in platform |
| 8 | Per-org **ID pattern engine** produces duplicate codes vs legacy GlobalCounter sequences | Med | Import counters' current values; generators are tenant-pluggable and seeded from max(existing) |
| 9 | Team capacity: three repos + live schools; migration fatigue | Med | Phases sized ≤2–3 weeks each with independent value; M1 alone fixes the worst security issues |
| 10 | **Trade-off — modular monolith vs microservice split:** slower to isolate scaling hot spots | Accepted | Authz decision path is cached/stateless; revisit split only if decision-API QPS demands it |
| 11 | **Trade-off — build vs Keycloak:** owning security-critical code | Accepted | Existing RS256 core is proven with HDMS/VMS; OIDC-shaped contract keeps the federation exit open |

---

## 8. Step-by-Step Implementation Roadmap

| Phase | Timeline | Work |
|---|---|---|
| **Phase 0 — Foundations** | week 1–2 | Claims v2 + event schema RFC; JWKS endpoint on existing Auth Service; contract-test harness with golden tokens; security fixes that can't wait (LMS secret from env, remove email-based role fallback behind a flag). |
| **Phase 1 — Core remodel in Auth Service** | week 2–5 | Introduce `identity/` (Account, Identifier, Person, Persona) and `tenancy/` (Tenant, OrgUnit, TenantConfig) apps; migrate Employee/SuperAdmin credentials onto Account (compat shims keep `/login`, HDMS/VMS/SIS untouched); generic token endpoint with `aud`; claim-enricher plugin interface; `auth.events` publisher. |
| **Phase 2 — Verifier rollout** | week 4–6 (overlaps) | `ams-shared` v2 + LMS `common` v2 dual-verify (RS256/JWKS → HS256 fallback); deploy across all services; contract tests green in every consumer CI. |
| **Phase 3 — Backfill & reconcile** | week 6–8 | ETL scripts for LMS then SMS (accounts, identifiers, personas, org units, role snapshots); nightly reconciliation + drift dashboard; provisioning API v1. |
| **Phase 4 — LMS cutover** | week 8–11 | Login façade → platform issuance for `aud=lms`; registration/receipt-activation as policy plugin + provisioning calls; role JSON → RBAC import; switch permission checks; monitor two weeks; stop local token issuance. |
| **Phase 5 — SMS cutover** | week 11–15 | Billing policy plugin; SMS claim enricher (org_id/campus_id/username/token_version-compat); login façade for `aud=sms`; per-org RolePermission → tenant Roles with scoped assignments (campus-scoped principals/coordinators); OTP flows moved to platform; monitor; stop local issuance. |
| **Phase 6 — Consolidation** | week 15–18 | Collapse `login-hdms/vms/sis` endpoints; HdmsRole/VmsRole → RBAC data migration; retire HS256 everywhere + secret rotation; legacy user tables → event-synced read models; drop cross-DB SQL in SMS login path. |
| **Phase 7 — Domain eviction & future-proofing** | ongoing | LMS admission/finance models out of auth; Employee HR payload toward HRMS boundary; entitlements API v2; onboarding playbook for ERP/CRM ("add Service row + enricher + role seed = live") — the acceptance test that the platform is truly domain-agnostic. |

### Immediate next actions (pre-approval)

1. Ratify §3–§4 canonical models with all three teams.
2. Confirm LMS-first ordering.
3. Then Phase 0 can start without touching any production behavior.

---

## Explicit Flags Before Approval

1. **Two live security vulnerabilities** in Phase 0 are worth fixing even if the rest of this plan changes:
   - LMS hardcoded default JWT secret (`AIT-LMS/lms-microservices/shared/common/jwt_utils.py`).
   - The *"email contains admin → ADMIN role"* fallback in `AIT-LMS/lms-microservices/shared/common/authentication.py:64-71` — a privilege-escalation path.
2. **The single biggest modeling decision being approved** is the **Account/Persona split with students as first-class identities** — it's what lets one service serve SMS (students are users), LMS (students are admission-driven users), and the ERP family (employees only) without forking logic.
