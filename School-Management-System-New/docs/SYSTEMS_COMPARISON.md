# Honest Systems Comparison — SMS vs AIT-LMS vs Auth Service

> **Purpose:** An honest, per-concern comparison of the three systems to answer: is any one comprehensive and extensible enough to serve as the base of a unified platform — such that even partially-used functionality sits ready for adoption — and can they be unified in a microservices format?
>
> **Companion doc:** [`AUTH_PLATFORM_STRATEGY.md`](SMS/docs/AUTH_PLATFORM_STRATEGY.md) (auth-only architecture & migration plan). This document extends that analysis to the whole-platform question.
>
> **Status:** Assessment — no code modified. **Date:** 2026-07-17

---

## Table of Contents

1. [Key Finding From Deeper Inspection](#1-key-finding-from-deeper-inspection)
2. [Scorecard](#2-scorecard)
3. [Honest Verdict Per System](#3-honest-verdict-per-system)
4. [Is Any System a Superset?](#4-is-any-system-a-superset)
5. [Unified Microservices Topology (Recommended)](#5-unified-microservices-topology-recommended)
6. [The "Ready to Be Used" Dividend](#6-the-ready-to-be-used-dividend)
7. [Sequencing & Honest Caution](#7-sequencing--honest-caution)

---

## 1. Key Finding From Deeper Inspection

A fairness pass over the domain services (not just the auth modules) surfaced one fact that changes the picture:

- **LMS's `course-service` is also a mega-service.** Beyond courses it contains fee structures, student fee records, payment transactions, deposits, attendance, rooms, and class scheduling (`FeeStructure`, `StudentFeeRecord`, `FeePaymentTransaction`, `StudentDeposit`, `Attendance`, `Room`, `ScheduledClass` — all in `courses/models.py`). So LMS's domain-dumping is not limited to its auth service; **it is the pattern of the whole repository.**
- **SMS's services are genuinely single-domain** (student, attendance, result, fees, timetable, content, support each own only their domain) — though every service carries copy-pasted `_FakeQuerySet` / `_FakeManager` / `Notification` shims, showing the shared-library discipline is only partial.
- **LMS's admission-service holds genuinely unique functionality** none of the other systems have: entrance tests with question banks, test attempts, interviews, and a lead-to-enrollment funnel.

---

## 2. Scorecard

Grades are honest, not diplomatic. **Bold** = best of the three in that row.

| Dimension | SMS | AIT-LMS | Auth Service |
|---|---|---|---|
| Microservice boundaries | **A−** (16 services, DB-per-service, one domain each) | D (6 services, but course-service holds fees/attendance/scheduling; auth holds admissions/finance) | B (single service, but that's correct for its scope) |
| Identity model | C (User + role enum, profiles scattered) | C− (User + role enum, student data fused in) | **A−** (Org→Inst→Branch→Dept→Designation, credentials separated, multi-assignment) |
| AuthZ / RBAC | C+ (per-org permission matrix, but hardcoded codenames) | D (JSON dict per role, ADMIN bypasses all) | **A−** (Permission/Role/scoped-assignment/override + Redis cache) |
| Token security | C (HS256 one shared secret in 16 services; leak = total compromise) | F (HS256 with hardcoded default secret, email→ADMIN fallback, no revocation) | **A** (RS256, private key isolated, JWKS-ready, refresh revocation + blacklist) |
| Multi-tenancy | **A** (true SaaS: orgs, plans, billing gates, per-org config, row-level managers) | D (single org, flat branches) | B− (deep org tree, but single tenant) |
| Business functionality breadth | **A** (students, attendance incl. biometric, results, fees, timetable, subjects, content, support, AI, notifications) | B− (admission funnel with entrance tests/interviews, courses, certification — genuinely unique features) | C (identity/HR only — by design) |
| Eventing / integration | **B+** (RabbitMQ topic exchange, real consumers, stateless token validation lib) | C (RabbitMQ exists, gateway is proxy-only) | C− (no events; HTTP-only consumers, but 3 real external systems already integrate) |
| Extensibility for new systems | C (everything assumes "school") | D (everything assumes "AIT institute") | **A−** (Service registry + typed institutions built explicitly for ERP/CRM/HRMS expansion) |
| Code hygiene / discipline | B− (clean boundaries, but cross-DB psycopg2 hacks in login, copy-paste shims) | D+ (duplicated shared lib, seed scripts and credentials.json in repo, mega-models) | B+ (docs, audit trail, migration reports, tests for RBAC — but one-off scripts litter `src/`) |

---

## 3. Honest Verdict Per System

### SMS — the best *platform*

- The **only true multi-tenant SaaS** of the three: organizations, subscription plans, billing-gated login, per-org configuration (`enabled_features`, ID-code patterns), row-level tenancy managers.
- The **widest functionality**: students, biometric attendance, results, fees/vouchers, timetables, subjects, content, support desk, AI service, notifications.
- The **only correctly-factored microservices estate**: DB-per-service, topic events, stateless token validation via a shared library.
- **Its weakest module is auth**: an enum-role monolith user table, HS256 with one shared secret across 16 services, and login code that reaches into other services' databases with raw psycopg2 SQL.

**If the question is "whose *architecture pattern* should the unified system live in?" — the answer is SMS's pattern.** Not its auth.

### Auth Service — the best *identity & authorization core*, the only one designed for extension

- The **only system where "add a new consuming application" is an explicit, tested concept**: Service registry + ServiceAccess grants, with HDMS, VMS, and SIS already integrating in production.
- The **only real token security**: RS256 with an isolated private key, refresh-token revocation, blacklist, per-device sessions.
- Its **scoped RBAC is a strict superset** of both SMS's permission matrix and LMS's JSON dicts.
- Its gaps — no students, no multi-tenancy, no OTP/reset flows — are **additive, not structural**. Nothing has to be torn down to add them.

### AIT-LMS — honestly the weakest system; a feature contributor, not a foundation

- Should **not** be a foundation for anything: duplicated shared library, hardcoded default JWT secret, an email-substring → ADMIN role fallback, no token revocation, mega-models, credentials/seed files committed to the repo.
- Its value is **features, not architecture**. Functionality that exists nowhere else:
  - **Admission funnel**: entrance tests with question banks, test attempts, interviews, leads → receipt codes → enrollment.
  - **Certification** service.
  - **Course delivery** with progress tracking, submissions, and ratings.
- These are worth **extracting**. The scaffolding around them is not worth keeping.

---

## 4. Is Any System a Superset?

**No.** No single system contains the others. Each is best at exactly one concern:

| Concern | Winner | What the others contribute |
|---|---|---|
| Identity, AuthN, AuthZ | **Auth Service** | SMS: tenancy model, OTP flows, `token_version`; LMS: nothing structural |
| Platform architecture & tenancy | **SMS** | Auth Service: org-unit tree depth; LMS: nothing |
| Unique domain features | **LMS** (admissions, certification, course delivery) | SMS: everything else school-related |

Therefore the unification must be **per concern**, not by crowning one repository wholesale.

---

## 5. Unified Microservices Topology (Recommended)

```
                    ┌─────────────────────────────┐
                    │  auth-platform               │  ← base: Auth Service
                    │  (identity, RBAC, tokens,    │    + SMS's tenancy/OTP/token_version
                    │   tenancy, provisioning)     │    + students-as-personas
                    └──────────────┬──────────────┘
                     JWKS / events / provisioning API
        ┌──────────────┬───────────┼────────────┬──────────────┐
   org-service    student/staff   fees      attendance    timetable/subject/
   (plans,billing) services      service    (biometric)   content/result/support
        └───────── SMS estate (platform backbone) ──────────────┘
        ┌──────────────┬────────────────┬─────────────────┐
   admission-service  course-service   certification      ← LMS features, re-homed
   (tests,interviews, (delivery,       service              as tenant-aware services
    leads,receipts)    progress)                            on the SMS backbone
```

**Division of roles:**

1. **Auth Service → unified identity plane** (exactly as specified in `AUTH_PLATFORM_STRATEGY.md`): accounts, personas, tenancy, RBAC, tokens, provisioning, identity events.
2. **SMS estate → unified platform backbone**: the microservices pattern (DB-per-service, `ams.events` topic exchange, stateless verification lib) becomes the standard every service follows; org-service remains the billing/subscription owner consulted by auth via policy hook.
3. **LMS → decomposed, not adopted**: admission-service, course-service (delivery/progress only — fees and attendance move to the backbone's fees/attendance services), and certification-service are re-homed as **tenant-aware services on the SMS backbone**. LMS's auth service, FastAPI gateway, and duplicated shared library are retired.

**Is microservices unification feasible? Yes** — all three are Django/Python, all speak RabbitMQ or can, and the auth strategy already standardizes tokens/claims across the estate. The unification is enabled by the auth layer: once both systems share accounts, personas, and org units, merging the platforms becomes a **data-migration problem instead of an architecture problem**.

---

## 6. The "Ready to Be Used" Dividend

Adopting the unified topology yields dormant-but-ready functionality in both directions:

**From the Auth Service (unused capacity, already built):**

- **Scoped role assignments** — the generic-FK scope on `EmployeeRole` is built and dormant; activating it gives SMS campus-scoped principals and LMS branch-scoped coordinators with zero new schema.
- **Typed institution tree** — `healthcare`, `social_welfare`, `technical` institution types are already modeled; a hospital or vocational center onboards without schema changes.
- **Service registry** — `sms` and `lms` become registry rows; future ERP/CRM/HRMS are "add a row + claim enricher + role seed = live."

**From the SMS backbone (switched off per tenant, ready to enable):**

- Once LMS runs as a **tenant** on the backbone, AIT automatically has fee vouchers, biometric attendance, timetables, results, and the support desk **available but disabled** via the existing `enabled_features` flags — functionality LMS half-built inside course-service and can now delete.
- Conversely, any SMS school tenant can enable LMS-origin features (entrance testing, certification, course delivery) the same way.

This is precisely the "even if some of it is used, extra functionality is ready" property — achieved through **tenant feature flags on a shared backbone**, not through one repo absorbing the others' code.

---

## 7. Sequencing & Honest Caution

**This is a bigger commitment than the auth-only migration.** Unifying the *platforms* (making LMS a tenant of the SMS backbone) requires:

1. Multi-tenanting the LMS feature services (adding `tenant_id`/org scoping to admission, course, certification).
2. Reconciling two student models (SMS student-service vs LMS Student/enrollment data).
3. Migrating LMS fee/attendance data out of course-service into the backbone's fees/attendance services.

**Recommended order:**

| Stage | What | Depends on |
|---|---|---|
| 1 | Auth unification — phases M0–M8 of `AUTH_PLATFORM_STRATEGY.md` | Approval of that doc |
| 2 | LMS feature services re-homed as tenant-aware backbone services | Stage 1 complete (shared accounts/personas/org-units exist) |
| 3 | LMS student/fee/attendance data merged into backbone services; LMS-specific infra retired | Stage 2 |
| 4 | Single admin/tenant console; per-tenant feature-flag catalog formalized | Stage 3 |

Platform unification (stages 2–4) is a phase **after** M8, not parallel to it. Attempting both at once multiplies migration risk across live schools for no schedule gain.

**Bottom line:** No single system wins outright — Auth Service is the most extensible *core*, SMS is the most comprehensive *platform*, LMS is a *feature donor*. Unify per concern in microservices format: Auth Service as the identity plane, SMS's estate as the backbone, LMS decomposed into tenant-aware feature services. The auth migration already on the table is the enabler for all of it.
