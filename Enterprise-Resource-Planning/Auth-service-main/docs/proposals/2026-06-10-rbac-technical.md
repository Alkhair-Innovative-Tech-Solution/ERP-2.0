# Role-Based Access Control — Technical Proposal

**Prepared by:** Muhammad Ubaid  
**Date:** June 10, 2026  
**Audience:** Technical Lead, Senior Developers, Architects  
**Status:** Awaiting Approval

---

## Problem Statement

### 1. Per-Service Hardcoded Role Models

`HdmsRole` and `VmsRole` are separate Django models with boolean permission fields baked into the schema. Every new service that requires roles demands a new model, a new migration, custom validation logic, and a new login endpoint. This pattern does not scale — adding HRMS, Finance, or any future service multiplies the engineering burden linearly.

### 2. No Internal RBAC on Auth-service

`ServiceAccess` gates which service an employee can enter, but once inside Auth-service there is no action-level control. Any employee with access can perform any operation — creating employees, managing org hierarchy, granting service access to others. There is no concept of an "Auth-service role."

### 3. Additional Design Issues

| Issue | Location | Severity |
|-------|----------|----------|
| `service` field is a string, not a FK | `ServiceAccess.service` | Medium |
| Permissions as hardcoded boolean columns | `HdmsRole` (can_view_all_tickets, etc.) | High |
| No granular permission audit trail | `PermissionAudit` (service-level only) | Medium |

---

## Proposed Architecture

### Data Model (ERD Overview)

Four new tables added to the `permissions` app:

```
Permission
├── codename (unique)     e.g. "employee.create"
├── name                  e.g. "Create Employee"
├── service               e.g. "auth"
└── description

Role
├── id (UUID)
├── name                  e.g. "HR Manager"
├── service               e.g. "auth"
├── is_default            pre-seeded default roles
├── description
└── permissions ──────────── M2M → Permission

EmployeeRole
├── id (UUID)
├── employee ─────────────── FK → Employee
├── role ─────────────────── FK → Role
├── scope_content_type ───── FK → ContentType  (null = global)
├── scope_object_id ──────── UUID              (null = global)
├── granted_by ──────────── FK → Employee
└── granted_at

EmployeePermissionOverride
├── id (UUID)
├── employee ─────────────── FK → Employee
├── permission ───────────── FK → Permission
├── is_allowed               True = grant | False = block
├── scope_content_type ───── FK → ContentType  (null = global)
├── scope_object_id ──────── UUID              (null = global)
├── granted_by ──────────── FK → Employee
└── granted_at
```

### Effective Permission Formula

```
effective_permissions = role_permissions ∪ allowed_overrides − denied_overrides
```

SuperAdmin bypasses all permission checks unconditionally.

### Key Components

| Component | Purpose |
|-----------|---------|
| `has_permission(employee, codename)` | Computes effective permissions for an employee |
| `@require_permission(codename)` | Django Ninja decorator — returns 403 if check fails |
| `seed_permissions` management command | Idempotent seeder — defines all Auth-service permissions as data |
| Redis cache (5-min TTL) | Caches computed permission set per employee — avoids DB hit per request |

### Auth-service Permissions (Initial Seed)

| Codename | Action |
|----------|--------|
| `employee.create` | Create Employee |
| `employee.edit` | Edit Employee |
| `employee.delete` | Delete Employee |
| `department.create` | Create Department |
| `department.edit` | Edit Department |
| `branch.create` | Create Branch |
| `institution.create` | Create Institution |
| `service_access.grant` | Grant Service Access |
| `service_access.revoke` | Revoke Service Access |
| `role.manage` | Manage Roles |
| `designation.create` | Create Designation |
| `organization.manage` | Manage Organization |

---

## Scope Field — Phase 2 Readiness

Both `EmployeeRole` and `EmployeePermissionOverride` carry nullable `scope` fields (GenericFK). In MVP these are always null — meaning permissions apply globally. In Phase 2, scope is filled to restrict a role or override to a specific Branch or Institution, with no model rewrite required.

---

## New API Endpoints

All under `permissions_router` (`/api/permissions/`):

| Method | Path | Action |
|--------|------|--------|
| `GET` | `/permissions/` | List all permissions by service |
| `GET/POST` | `/roles/` | List / create roles |
| `GET/PUT/DELETE` | `/roles/{id}/` | Role detail, update, soft-delete |
| `POST` | `/roles/{id}/assign/` | Assign role to employee |
| `DELETE` | `/roles/{id}/unassign/` | Remove role from employee |
| `GET` | `/employees/{id}/effective-permissions/` | Compute full permission set |
| `GET/POST` | `/employees/{id}/overrides/` | List / add permission overrides |
| `DELETE` | `/employees/{id}/overrides/{override_id}/` | Remove override |

---

## Migration Path

### Phase 1 — MVP (this proposal)
- 4 new tables via standard Django migrations
- Zero changes to `HdmsRole`, `VmsRole`, `ServiceAccess`
- No data migration — new tables start empty
- All existing employees and service flows unaffected

### Phase 2 — Future
- HDMS/VMS permissions defined in the new `Permission` table
- `HdmsRole` / `VmsRole` rows migrated to `EmployeeRole` + `EmployeePermissionOverride` via data migration script
- HDMS backend updated to call `/employees/{id}/effective-permissions/` instead of reading `HdmsRole` directly
- `HdmsRole` / `VmsRole` deprecated and eventually dropped

### Why Two Phases Instead of One?

| Concern | Phase 1 Only | One Big Bang |
|---------|-------------|--------------|
| Scope | Auth-service only | Auth-service + HDMS + VMS |
| Risk | Low — isolated, no HDMS/VMS disruption | High — HDMS production affected if anything goes wrong |
| Delivery time | ~3 weeks | ~6–8 weeks |
| HDMS coordination needed | No | Yes — HDMS team must update their auth integration simultaneously |
| Rollback | Simple | Complex — multiple services affected |

**Recommendation:** Phase 1 first. Validate the permission engine on Auth-service, then extend to HDMS/VMS with confidence.

---

## Frontend Changes

All changes to the existing `/service` page (`frontend/src/app/service/page.tsx`):

1. **Auth subsystem tab** — Added alongside existing HDMS / VMS tabs
2. **Roles sub-tab** — Role CRUD with permission checkbox grid (grouped by resource)
3. **Dynamic role dropdown** — Replace hardcoded `serviceRoles` object with API call to `/api/permissions/roles?service={service}`
4. **Per-employee overrides panel** — Expand employee row → show assigned roles + add/block individual permissions

---

## Milestones

**Start Date:** June 16, 2026 (1 developer)

| Week | Dates | Deliverable |
|------|-------|-------------|
| **Week 1** | June 16–20 | 4 new DB models + migration + `seed_permissions` command |
| **Week 2** | June 23–27 | All API endpoints + `has_permission()` + `@require_permission` + unit tests |
| **Week 3** | June 30–July 4 | Frontend `/service` page update + integration tests + internal review |
| **Buffer** | July 7–8 | Bug fixes, staging deploy, stakeholder demo |

**Target completion:** July 8, 2026

---

## Acceptance Criteria

The feature is considered complete when ALL of the following pass:

### Roles & Permissions Management
- [ ] Admin can create a new role with a custom name and selected permissions — no code deployment required
- [ ] Admin can edit an existing role's permissions — changes reflected immediately for all assigned employees
- [ ] Admin can delete a role — employees previously assigned that role lose its permissions
- [ ] Permissions list is seeded and visible in the UI; no manual DB insertion required

### Role Assignment
- [ ] Admin can assign a role to an employee from the Services page
- [ ] Admin can remove a role from an employee
- [ ] An employee with no role assigned receives 403 on any protected action

### Individual Permission Overrides
- [ ] Admin can grant an extra permission to an individual employee beyond their role
- [ ] Admin can block a specific permission for an individual employee (even if their role includes it)
- [ ] Effective permissions = role permissions + allowed overrides − denied overrides (verified by test)

### Enforcement
- [ ] An employee with `employee.create` permission can create employees successfully (200/201)
- [ ] An employee without `employee.create` permission receives 403
- [ ] SuperAdmin bypasses all permission checks
- [ ] Permission check does not noticeably slow down API response (Redis cache active)

### Stability
- [ ] `seed_permissions` command run twice produces no duplicate Permission rows
- [ ] All existing HDMS / VMS flows work without modification
- [ ] All 11 existing passing tests continue to pass

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| N+1 on permission check per request | High | Redis cache (5-min TTL), invalidated on role/override change |
| Admin assigns wrong role | Medium | Audit log records every change; roles reassignable immediately |
| Phase 2 HDMS migration breaks existing flows | High | Phase 2 gated behind HDMS-side API update; rollback plan exists |

---

*Document prepared by Muhammad Ubaid — June 10, 2026*  
*Revised: June 12, 2026 (PM feedback incorporated)*
