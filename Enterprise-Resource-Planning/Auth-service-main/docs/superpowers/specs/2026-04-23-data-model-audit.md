# Data Model Audit & Cleanup — Auth-Service
**Date:** 2026-04-23  
**Scope:** Organization → Institution → Branch → Department → Designation → Employee → EmployeeAssignment  
**Decisions recorded from:** brainstorming session with Ubaid

---

## Summary of All Changes

| Layer | Change | Priority | Migration? |
|---|---|---|---|
| EmployeeAssignment | Remove `institution` FK | P1 — Critical | Yes |
| Employee | Fix hardcoded `IAK-` prefix → `org.org_code` | P2 — High | No (existing records stay, new ones fixed) |
| Department | Enforce one parent via `clean()` + fix `is_global` | P3 — High | No |
| Institution | Remove `inst_id`, `attribute_schema`, `extra_data`, `legacy_campus_id`; make `organization` required | P4 — Medium | Yes |
| Branch | Remove `domain_data`, `legacy_campus_id`; expose 7 hidden fields in API schemas | P5 — Medium | Yes |
| Organization | Add `email`, `phone`, `logo_url` | P6 — Low | Yes |
| Employee | Remove `is_superadmin`, remove `state` field | P7 — Low | Yes |

---

## P1 — EmployeeAssignment: Remove `institution` FK

### Problem
`EmployeeAssignment` carries both `institution` and `branch` as explicit FKs. These are derivable from the designation chain: `designation.department.branch.institution`. The `institution` field can produce "Impossible Assignments" where the stored institution disagrees with the one implied by the designation chain.

### Decision
- **Remove `institution` FK** from `EmployeeAssignment`.
- **Keep `branch` FK** — it is used in `employee_code` generation (line 562: `if self.branch: prefix = self.branch.branch_code`).
- Anywhere `asn.institution` is accessed in `api.py`, replace with `asn.designation.department.institution` or `asn.branch.institution if asn.branch else None`.

### Affected Code
- `employees/models.py` — delete `institution` field from `EmployeeAssignment`
- `employees/api.py` line ~976: `asn.institution.inst_code if asn.institution else None` → derive from chain
- `employees/models.py` line 139: `Institution.update_from_branches()` uses `EmployeeAssignment.objects.filter(institution=self)` → rewrite to `EmployeeAssignment.objects.filter(designation__department__institution=self)`
- Migration: `DROP COLUMN institution_id` on `employees_employeeassignment`

### Ripple check
- `api.py` line 706, 1160: `Institution.objects.filter(inst_code=payload.institutionCode)` — these are institution lookups for employee creation, not the assignment FK. Not affected.

---

## P2 — Employee: Fix Hardcoded `IAK-` Prefix

### Problem
```python
self.employee_id = f"IAK-{num:0{padding}d}"  # line 502
```
`IAK` is hardcoded. Every employee across all organizations gets `IAK-XXXX`. If a second organization is added, their employees will also be named `IAK-0123`.

### Decision
Use `self.organization.org_code` as prefix if available, fall back to `IAK` only if no org is linked.

### New Logic
```python
prefix = self.organization.org_code if self.organization else "IAK"
self.employee_id = f"{prefix}-{num:0{padding}d}"
```

### Migration note
Existing `employee_id` values are NOT changed (they are `editable=False` and already assigned). Only new employees going forward will get the correct prefix. No DB migration needed — just model logic change.

---

## P3 — Department: One Parent Enforcement + Fix `is_global`

### Problem 1 — Multiple parents allowed
```python
branch = FK(Branch, null=True)
organization = FK(Organization, null=True)
institution = FK(Institution, null=True)
```
No validation prevents all three from being set simultaneously.

### Decision
Add Django `clean()` method:
```python
def clean(self):
    parents = [self.branch, self.institution, self.organization]
    set_parents = [p for p in parents if p is not None]
    if len(set_parents) != 1:
        raise ValidationError("Department must have exactly one parent: branch, institution, or organization.")
```
Also call `full_clean()` in `save()` to trigger it.

### Problem 2 — `is_global` wrong
```python
# Current — wrong
@property
def is_global(self):
    return self.institution is None
```
A branch-linked department with `institution=None` would incorrectly return `True`.

### Decision
```python
@property
def is_global(self):
    return self.branch is None and self.institution is None and self.organization is not None
```

### No migration needed — model logic only.

---

## P4 — Institution: Cleanup 4 Fields + Make Org Required

### Changes

| Field | Action | Reason |
|---|---|---|
| `inst_id` | **Remove** | Not used in any code logic. UUID `id` is the system key. `inst_code` is the business key. Only cosmetic display in one frontend page. |
| `attribute_schema` | **Remove** | JSON blob, not queryable, unused in API or frontend |
| `extra_data` | **Remove** | Same — JSON blob. `update_from_branches()` writes `total_branches` + `total_employees` here; after removal, derive on-the-fly in API |
| `legacy_campus_id` | **Remove** | Migration tracking artifact — not used |
| `organization` FK | **Make required** (null=False) | An institution without an org is logically invalid |

### `update_from_branches()` rewrite
After removing `extra_data`, this method becomes unnecessary. The counts will be computed live in the `GET /institutions` API response (add `branch_count` + `employee_count` as computed fields in `InstitutionSchema`).

### Migration
- `ALTER COLUMN organization_id SET NOT NULL` — safe only after verifying no existing null rows
- `DROP COLUMN inst_id, attribute_schema, extra_data, legacy_campus_id`

### Frontend changes
- Remove `inst_id` from TypeScript interfaces and display
- `institution.inst_code` is already the display key everywhere — no routing change needed

---

## P5 — Branch: Remove `domain_data` + `legacy_campus_id` + Expose 7 Fields

### Fields to remove from model

| Field | Reason |
|---|---|
| `domain_data` | JSON blob for school/hospital/kitchen specifics — unqueryable, not in API |
| `legacy_campus_id` | Migration artifact |

### Fields already in model but missing from API schemas

These 7 fields exist in `Branch` but are absent from `BranchCreateSchema` and `BranchUpdateSchema`:

| Field | Type | Required? |
|---|---|---|
| `branch_head_contact` | CharField(50) | Optional |
| `branch_head_email` | EmailField | Optional |
| `secondary_contact` | CharField(20) | Optional |
| `district` | CharField(100) | Optional |
| `postal_code` | CharField(20) | Optional |
| `established_year` | PositiveIntegerField | Optional |
| `registration_number` | CharField(100) | Optional |

**Decision:** All optional. Add to `BranchCreateSchema`, `BranchUpdateSchema`, `BranchSchema` (response), and the frontend branch modal.

### `branch_head_name`
Keep as `CharField` (string). No FK to Employee — it creates a circular dependency (Employee needs Branch, Branch needs Employee). A string is sufficient for now.

### Migration
- `DROP COLUMN domain_data, legacy_campus_id`

---

## P6 — Organization: Add Contact Fields

### Fields to add

| Field | Type | Required? |
|---|---|---|
| `email` | EmailField | Optional |
| `phone` | CharField(20) | Optional |
| `logo_url` | URLField | Optional |

### Migration
- `ALTER TABLE employees_organization ADD COLUMN email, phone, logo_url`

### API + Frontend
- Add to `OrganizationSchema` (response)
- Add to organization create/update schemas
- Add to organization form/display in frontend

---

## P7 — Employee: Remove `is_superadmin` + `state`

### `is_superadmin`
A separate `SuperAdmin` model exists in `authentication/superadmin_models.py`. The `is_superadmin` flag on `Employee` is redundant.

**Safe to remove.** All usages in `authentication/api.py` and `jwt_utils.py` use `getattr(user, 'is_superadmin', False)` — the `getattr` default means removing the field from `Employee` automatically returns `False` for employees (correct), while `SuperAdmin` objects retain their own `is_superadmin` property. JWT payload `is_superadmin` key continues to work — it reads from the `SuperAdmin` model, not `Employee`. No auth logic changes needed alongside this removal.

### `state` field
Pakistan has provinces, not states. Since `city` is already captured, `state`/`province` is unnecessary for the current use case. Remove it.

### Migration
- `DROP COLUMN is_superadmin, state`

---

## What Breaks When

### P1 (Remove EmployeeAssignment.institution)
- `api.py` line ~976 breaks — `asn.institution` reference
- `Institution.update_from_branches()` breaks — depends on this FK
- Fix both in same PR as the migration

### P4 (Remove Institution.inst_id)
- Frontend `institutions/[id]/page.tsx` line 166: `institution.inst_id` display breaks
- `InstitutionSchema` in `api.py` line 44 has `inst_id: str` — remove it

### P4 (Make org required)
- Must verify `SELECT COUNT(*) FROM employees_institution WHERE organization_id IS NULL` = 0 before migration runs

### P2 (Employee prefix fix)
- No breakage — only affects newly created employees going forward

---

## What Does NOT Change

- `branch` FK on `EmployeeAssignment` — stays (used in employee_code prefix logic)
- `employee_code` generation logic — stays as-is
- All route URLs — no API path changes
- `inst_code` — stays as the business identifier everywhere
- `branch_head_name` as string — no FK conversion

---

## Migrations Summary

| Migration | Model | Operation |
|---|---|---|
| 0006 | EmployeeAssignment | Remove `institution` FK |
| 0007 | Institution | Remove 4 columns, make org required |
| 0008 | Branch | Remove `domain_data`, `legacy_campus_id` |
| 0009 | Organization | Add `email`, `phone`, `logo_url` |
| 0010 | Employee | Remove `is_superadmin`, `state` |

Each migration is independent. Run in order. Each one needs a data-safety check before ALTER NOT NULL.
