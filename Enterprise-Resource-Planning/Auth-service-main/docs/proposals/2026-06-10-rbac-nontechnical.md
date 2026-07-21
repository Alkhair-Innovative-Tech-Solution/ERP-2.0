# Role-Based Access Control — Business Proposal

**Prepared by:** Muhammad Ubaid  
**Date:** June 10, 2026  
**Audience:** Project Managers, Business Stakeholders, Team Leads  
**Status:** Awaiting Approval

---

## Executive Summary

Today, any employee who has access to the HR Management System can perform any action — create employees, modify departments, grant access to other systems, and more. There is no way to limit what a specific person can do based on their job. This proposal introduces a **Role-Based Access Control (RBAC)** system that allows administrators to define job-specific roles (e.g., "HR Manager", "Branch Admin"), assign them to employees, and fine-tune individual access — all without any software deployment or developer involvement.

---

## The Problem

### 1. No Control Over Who Can Do What

Once an employee is given access to the system, they can perform every action available — adding employees, editing records, granting access to other services, creating departments, and more. There is no difference between an HR assistant and an HR manager. **Everyone has full access.**

This is a security and compliance risk. If one account is compromised, the attacker has full system control.

### 2. Adding Roles Requires a Developer

The current system has roles for HDMS (Help Desk) and VMS (Visitor Management), but these roles are **hardcoded into the software**. Every time a new service needs roles, an engineer must write code, test it, and deploy a new version. This creates a permanent dependency on the engineering team for what should be a simple admin task.

### 3. No Clear Record of Who Has What Role

There is no consolidated view of which employees have which roles and when those roles were assigned or changed. Answering "who had access to what on a given date" is not straightforward.

---

## Proposed Solution

A flexible, admin-managed system built on three simple concepts:

### Permissions — Individual Actions
A permission is one named action (e.g., "Create Employee", "Create Department", "Grant System Access"). Defined once by engineering — never changes unless a genuinely new feature is added.

### Roles — Bundles of Permissions
A role is a named group of permissions. Examples:

| Role | Permissions Included |
|------|----------------------|
| HR Manager | Create Employee, Edit Employee, Delete Employee, Grant System Access |
| HR Assistant | Create Employee, Edit Employee |
| Branch Admin | Create Department, Create Branch, Edit Branch |
| Read-Only Viewer | View Employees only |

Administrators create and modify roles from the existing Services page — **no developer needed.**

### Individual Overrides — Fine-Tuning Per Person
When one specific person needs more or less than their role provides:
- Ali (HR Assistant) also needs "Create Department" → add it just for Ali
- Fatima (HR Manager) should NOT delete employees → block that permission for Fatima only

**Effective access = Role permissions + individual additions − individual blocks**

---

## How Administrators Use This

All management from the existing **Services page** — no new screens:

1. **Create a Role** → Services → Auth tab → Roles → New Role → name it, tick permissions → Save
2. **Assign a Role** → Find employee in Services page → Assign Role → Select → Save
3. **Individual Override** → Find employee → add or block a specific permission

No code. No deployments. Done in minutes.

---

## Business Benefits

| Benefit | Detail |
|---------|--------|
| **Security** | Employees can only do what their job requires |
| **Self-Service** | Admins manage roles without engineering support |
| **Scalability** | New services get roles as data, not code |
| **Compliance** | Full audit trail: who was granted what role, by whom, on what date |
| **Flexibility** | Individual overrides handle exceptions without changing the whole role |

---

## What Is NOT Changing

- HDMS (Help Desk) and VMS (Visitor Management) roles are **untouched** in this phase
- Employee data, org hierarchy, and the login flow are unchanged
- Existing employees continue working normally throughout rollout

---

## Why Two Phases Instead of One?

| | Phase 1 (this proposal) | One Big Bang |
|-|------------------------|--------------|
| Scope | Auth-service only | Auth-service + HDMS + VMS together |
| Delivery | ~3 weeks | ~6–8 weeks |
| Risk | Low | High — HDMS production affected if anything fails |
| Recommended? | ✅ Yes | ❌ No |

Phase 2 (HDMS/VMS migration) follows after Phase 1 is stable. The two phases are independent — Phase 2 does not break Phase 1.

---

## Milestones

**Start Date:** June 16, 2026 (1 developer)

| Milestone | Target Date | Deliverable |
|-----------|-------------|-------------|
| **M1 — Foundation** | June 20, 2026 | Database design complete, permission definitions in place |
| **M2 — Backend Complete** | June 27, 2026 | All API logic working, permission engine tested |
| **M3 — Frontend Complete** | July 4, 2026 | Services page updated, roles manageable from UI |
| **M4 — Internal Review** | July 8, 2026 | Staging deploy, bug fixes, stakeholder demo |

**Target completion:** July 8, 2026

---

## Acceptance Criteria

The project is complete when all of the following are confirmed:

### Admin Capabilities
- [ ] Admin can create a role with a custom name and permissions — no developer required
- [ ] Admin can edit a role's permissions — changes apply immediately
- [ ] Admin can delete a role
- [ ] Admin can assign or remove a role from any employee
- [ ] Admin can grant an extra permission to a specific employee
- [ ] Admin can block a permission for a specific employee (even if their role includes it)

### Employee Experience
- [ ] Employee with "Create Employee" permission can create employees successfully
- [ ] Employee without that permission receives an "Access Denied" response
- [ ] An employee with no role assigned cannot perform any protected action
- [ ] SuperAdmin retains full access regardless of roles

### Stability
- [ ] All existing HDMS and VMS role flows work without any change
- [ ] All existing employees continue to work normally post-deployment
- [ ] Permission checks do not slow down the application noticeably

---

## Effort Summary

| Phase | Scope | Duration | Team |
|-------|-------|----------|------|
| **Phase 1 — MVP** | Auth-service RBAC | ~3 weeks | 1 developer |
| **Phase 2 — Future** | HDMS/VMS migration | ~3 weeks | 1 developer |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Existing users affected during rollout | No existing data changed in Phase 1 — fully additive |
| Admin assigns wrong role | Every change is logged with timestamp and who made it; roles reassignable immediately |
| Performance impact | Permission results are cached — no noticeable slowdown |

---

## Recommendation

Approve Phase 1 MVP. Phase 2 can be planned after Phase 1 is stable in production.

**Approval requested from:** Project Manager, Technical Lead

---

*Document prepared by Muhammad Ubaid — June 10, 2026*  
*Revised: June 12, 2026 (PM feedback incorporated)*
