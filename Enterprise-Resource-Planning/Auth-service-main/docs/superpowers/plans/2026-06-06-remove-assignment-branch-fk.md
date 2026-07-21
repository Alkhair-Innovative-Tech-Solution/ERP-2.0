# Remove `branch` FK from `EmployeeAssignment` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant `branch` ForeignKey from `EmployeeAssignment`; derive branch from `designation.department.branch` everywhere it was used.

**Architecture:** `EmployeeAssignment` already has `department` and `designation` FKs. Since `designation → department → branch` is a guaranteed chain, storing `branch` separately creates a second source of truth that can silently diverge. We delete the column, update all read/write paths to traverse the chain, write a migration, then cover every touched path with tests.

**Tech Stack:** Django 5, Django Ninja, pytest-django, Python 3.11

---

## Files to touch

| File | What changes |
|------|-------------|
| `Backend/src/employees/models.py` | Remove `branch` FK, fix `save()` and `__str__()` |
| `Backend/src/employees/api.py` | Fix `_assignment_institution()`, `_assignment_response()`, both schemas, `create_assignment()`, `update_assignment()`, `create_employee()`, both `prefetch_related` calls, inline branch reads in `get_employee()` |
| `Backend/src/employees/migrations/0018_remove_employeeassignment_branch.py` | Drop column migration |
| `Backend/src/employees/tests_assignment_branch.py` | New test file — unit + integration tests |
| `Backend/src/conftest.py` | Add correct fixtures needed by new tests |

---

## Task 1: Write failing unit tests for model `save()` and `__str__()`

**Files:**
- Create: `Backend/src/employees/tests_assignment_branch.py`
- Modify: `Backend/src/conftest.py`

- [ ] **Step 1: Add correct fixtures to conftest.py**

The existing fixtures in `conftest.py` use stale fields (`dept_sector`, old Employee fields). Add new ones that match the current models. Open `Backend/src/conftest.py` and append:

```python
import uuid
from employees.models import Organization, Institution, Branch, Department, Designation, Employee, EmployeeAssignment
from datetime import date as _date


@pytest.fixture
def org(db):
    return Organization.objects.create(name="Test Org", org_code="TORG")


@pytest.fixture
def institution(db, org):
    return Institution.objects.create(
        organization=org, inst_code="TINST", name="Test Institution", inst_type="educational"
    )


@pytest.fixture
def branch(db, institution):
    return Branch.objects.create(
        institution=institution, branch_code="TB01", branch_name="Test Branch"
    )


@pytest.fixture
def dept_with_branch(db, branch):
    return Department.objects.create(
        branch=branch, dept_code="TDWB", dept_name="Dept With Branch"
    )


@pytest.fixture
def dept_global(db, org):
    return Department.objects.create(
        organization=org, dept_code="TGLB", dept_name="Global Dept"
    )


@pytest.fixture
def desig_branch(db, dept_with_branch):
    return Designation.objects.create(
        department=dept_with_branch, position_code="TB", position_name="Branch Role"
    )


@pytest.fixture
def desig_global(db, dept_global):
    return Designation.objects.create(
        department=dept_global, position_code="TG", position_name="Global Role"
    )


@pytest.fixture
def employee(db, org):
    return Employee.objects.create(
        organization=org,
        full_name="Ali Hassan",
        cnic=f"{uuid.uuid4().int % 10**13:013d}",
        dob=_date(1990, 6, 1),
        gender="male",
    )
```

- [ ] **Step 2: Create the test file with failing tests**

Create `Backend/src/employees/tests_assignment_branch.py`:

```python
"""
Tests for EmployeeAssignment after branch FK removal.
Covers: model save() employee_code generation, __str__(), _assignment_institution() helper,
and API endpoints POST/PUT/GET for assignments.
"""
import json
import pytest
from datetime import date
from employees.models import EmployeeAssignment
from employees.api import _assignment_institution


# ── Unit: model save() ────────────────────────────────────────────────────────

class TestAssignmentSaveEmployeeCode:

    @pytest.mark.django_db
    def test_primary_assignment_generates_employee_code_from_branch(
        self, employee, desig_branch
    ):
        """save() derives branch_code from designation.department.branch for employee_code."""
        asn = EmployeeAssignment.objects.create(
            employee=employee,
            department=desig_branch.department,
            designation=desig_branch,
            joining_date=date(2026, 1, 1),
            is_primary=True,
            shift='general',
        )
        employee.refresh_from_db()
        # branch_code "TB01", shift G, year 26, position_code TB
        assert employee.employee_code.startswith("TB01-G-26-TB-")

    @pytest.mark.django_db
    def test_primary_assignment_generates_employee_code_from_global_dept(
        self, employee, desig_global
    ):
        """save() uses dept_code as prefix when department has no branch."""
        asn = EmployeeAssignment.objects.create(
            employee=employee,
            department=desig_global.department,
            designation=desig_global,
            joining_date=date(2026, 1, 1),
            is_primary=True,
            shift='general',
        )
        employee.refresh_from_db()
        # dept_code "TGLB", shift G, year 26, position_code TG
        assert employee.employee_code.startswith("TGLB-G-26-TG-")

    @pytest.mark.django_db
    def test_non_primary_assignment_does_not_change_employee_code(
        self, employee, desig_branch, desig_global
    ):
        """Non-primary assignment must not overwrite employee_code."""
        EmployeeAssignment.objects.create(
            employee=employee,
            department=desig_branch.department,
            designation=desig_branch,
            joining_date=date(2026, 1, 1),
            is_primary=True,
            shift='general',
        )
        employee.refresh_from_db()
        code_before = employee.employee_code

        EmployeeAssignment.objects.create(
            employee=employee,
            department=desig_global.department,
            designation=desig_global,
            joining_date=date(2026, 1, 1),
            is_primary=False,
            shift='morning',
        )
        employee.refresh_from_db()
        assert employee.employee_code == code_before


# ── Unit: __str__() ───────────────────────────────────────────────────────────

class TestAssignmentStr:

    @pytest.mark.django_db
    def test_str_uses_branch_code_when_dept_has_branch(self, employee, desig_branch):
        asn = EmployeeAssignment.objects.create(
            employee=employee,
            department=desig_branch.department,
            designation=desig_branch,
            joining_date=date(2026, 1, 1),
            is_primary=True,
            shift='general',
        )
        assert "TB01" in str(asn)

    @pytest.mark.django_db
    def test_str_uses_global_when_dept_has_no_branch(self, employee, desig_global):
        asn = EmployeeAssignment.objects.create(
            employee=employee,
            department=desig_global.department,
            designation=desig_global,
            joining_date=date(2026, 1, 1),
            is_primary=True,
            shift='general',
        )
        assert "Global" in str(asn)


# ── Unit: _assignment_institution() helper ───────────────────────────────────

class TestAssignmentInstitution:

    @pytest.mark.django_db
    def test_derives_institution_from_department_branch(
        self, employee, desig_branch, institution
    ):
        asn = EmployeeAssignment.objects.create(
            employee=employee,
            department=desig_branch.department,
            designation=desig_branch,
            joining_date=date(2026, 1, 1),
            is_primary=True,
            shift='general',
        )
        result = _assignment_institution(asn)
        assert result is not None
        assert result.inst_code == institution.inst_code

    @pytest.mark.django_db
    def test_returns_none_for_global_department(self, employee, desig_global):
        asn = EmployeeAssignment.objects.create(
            employee=employee,
            department=desig_global.department,
            designation=desig_global,
            joining_date=date(2026, 1, 1),
            is_primary=True,
            shift='general',
        )
        result = _assignment_institution(asn)
        assert result is None
```

- [ ] **Step 3: Run tests — confirm they FAIL (model still has branch FK)**

```bash
cd /home/ubaid/Desktop/AIT-Work/erp_new/Auth-service/Backend/src
pytest employees/tests_assignment_branch.py -v 2>&1 | tail -30
```

Expected: tests fail with errors (branch field still on model, `_assignment_institution` still uses `asn.branch`).

- [ ] **Step 4: Commit the failing tests**

```bash
git add Backend/src/employees/tests_assignment_branch.py Backend/src/conftest.py
git commit -m "test(assignment): add failing tests for branch FK removal"
```

---

## Task 2: Update the model

**Files:**
- Modify: `Backend/src/employees/models.py`

- [ ] **Step 1: Remove the `branch` FK field**

In `Backend/src/employees/models.py`, find lines 431–438 (inside `EmployeeAssignment`):

```python
    branch = models.ForeignKey(
        'Branch',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='assignments',
        help_text="Branch where employee works (for branch-specific roles)"
    )
```

Delete those 8 lines entirely.

- [ ] **Step 2: Update `save()` — derive branch from designation chain**

Find the `save()` method's prefix logic (around line 468). Replace:

```python
            if self.department.is_global:
                prefix = self.department.dept_code
            else:
                if self.branch:
                    prefix = self.branch.branch_code
                elif self.department.institution:
                    prefix = self.department.institution.inst_code
                else:
                    prefix = self.department.organization.org_code if self.department.organization else self.department.dept_code
```

With:

```python
            dept = self.designation.department
            if dept.is_global:
                prefix = dept.dept_code
            elif dept.branch_id:
                prefix = dept.branch.branch_code
            elif dept.institution_id:
                prefix = dept.institution.inst_code
            else:
                prefix = dept.organization.org_code if dept.organization_id else dept.dept_code
```

- [ ] **Step 3: Update `__str__()` — remove `self.branch` reference**

Find `__str__()` at the bottom of `EmployeeAssignment`. Replace:

```python
    def __str__(self):
        if self.branch:
            scope = self.branch.branch_code
        elif self.department.institution:
            scope = self.department.institution.inst_code
        else:
            scope = "Global"
        return f"{self.employee.full_name} - {self.designation.position_name} ({scope})"
```

With:

```python
    def __str__(self):
        dept = self.designation.department
        if dept.branch_id:
            scope = dept.branch.branch_code
        elif dept.institution_id:
            scope = dept.institution.inst_code
        else:
            scope = "Global"
        return f"{self.employee.full_name} - {self.designation.position_name} ({scope})"
```

- [ ] **Step 4: Also fix `Institution.employee_count()` — it uses the old FK**

In `Institution.employee_count()` (around line 110):

```python
    def employee_count(self):
        from .models import EmployeeAssignment
        return EmployeeAssignment.objects.filter(
            branch__institution=self, is_deleted=False
        ).values('employee').distinct().count()
```

Replace with:

```python
    def employee_count(self):
        from .models import EmployeeAssignment
        return EmployeeAssignment.objects.filter(
            department__branch__institution=self, is_deleted=False
        ).values('employee').distinct().count()
```

- [ ] **Step 5: Run unit tests — should pass now**

```bash
cd /home/ubaid/Desktop/AIT-Work/erp_new/Auth-service/Backend/src
pytest employees/tests_assignment_branch.py::TestAssignmentSaveEmployeeCode employees/tests_assignment_branch.py::TestAssignmentStr -v
```

Expected: All 5 tests PASS.

- [ ] **Step 6: Commit model changes**

```bash
git add Backend/src/employees/models.py
git commit -m "refactor(model): remove branch FK from EmployeeAssignment, derive from designation chain"
```

---

## Task 3: Create the migration

**Files:**
- Create: `Backend/src/employees/migrations/0018_remove_employeeassignment_branch.py`

- [ ] **Step 1: Auto-generate migration**

```bash
cd /home/ubaid/Desktop/AIT-Work/erp_new/Auth-service/Backend/src
python manage.py makemigrations employees --name remove_employeeassignment_branch
```

Expected output: `Migrations for 'employees': employees/migrations/0018_remove_employeeassignment_branch.py`

- [ ] **Step 2: Verify migration content**

```bash
cat Backend/src/employees/migrations/0018_remove_employeeassignment_branch.py
```

Must contain `RemoveField(model_name='employeeassignment', name='branch')`. No `AddField`. If it shows anything else, do not apply it — re-check the model change.

- [ ] **Step 3: Apply migration**

```bash
cd /home/ubaid/Desktop/AIT-Work/erp_new/Auth-service/Backend/src
python manage.py migrate employees
```

Expected: `Applying employees.0018_remove_employeeassignment_branch... OK`

- [ ] **Step 4: Commit migration**

```bash
git add Backend/src/employees/migrations/0018_remove_employeeassignment_branch.py
git commit -m "migration: drop branch FK from EmployeeAssignment (0018)"
```

---

## Task 4: Update the API

**Files:**
- Modify: `Backend/src/employees/api.py`

- [ ] **Step 1: Fix `_assignment_institution()` helper (line ~573)**

Replace:

```python
def _assignment_institution(asn):
    """Derive institution from an assignment without using a stored FK.
    Priority: branch.institution → department.institution → None (global).
    """
    if asn.branch_id and asn.branch.institution_id:
        return asn.branch.institution
    if asn.department_id and asn.department.institution_id:
        return asn.department.institution
    return None
```

With:

```python
def _assignment_institution(asn):
    """Derive institution from assignment via designation.department chain."""
    dept = asn.designation.department
    if dept.branch_id and dept.branch.institution_id:
        return dept.branch.institution
    if dept.institution_id:
        return dept.institution
    return None
```

- [ ] **Step 2: Remove `branch_code` from `EmployeeAssignmentCreateSchema` (line ~1454)**

Replace:

```python
class EmployeeAssignmentCreateSchema(BaseModel):
    branch_code: Optional[str] = None
    department_code: str
    designation_code: str
    joining_date: Optional[str] = None
    shift: str = 'general'
    is_primary: bool = False
```

With:

```python
class EmployeeAssignmentCreateSchema(BaseModel):
    department_code: str
    designation_code: str
    joining_date: Optional[str] = None
    shift: str = 'general'
    is_primary: bool = False
```

- [ ] **Step 3: Remove `branch_code` from `EmployeeAssignmentUpdateSchema` (line ~1470)**

Replace:

```python
class EmployeeAssignmentUpdateSchema(BaseModel):
    branch_code: Optional[str] = None
    department_code: Optional[str] = None
    designation_code: Optional[str] = None
    joining_date: Optional[str] = None
    shift: Optional[str] = None
    is_primary: Optional[bool] = None
    is_active: Optional[bool] = None
```

With:

```python
class EmployeeAssignmentUpdateSchema(BaseModel):
    department_code: Optional[str] = None
    designation_code: Optional[str] = None
    joining_date: Optional[str] = None
    shift: Optional[str] = None
    is_primary: Optional[bool] = None
    is_active: Optional[bool] = None
```

- [ ] **Step 4: Fix `_assignment_response()` (line ~1489)**

Replace:

```python
def _assignment_response(asn) -> dict:
    inst = _assignment_institution(asn)
    return {
        'id': str(asn.id),
        'institution': inst.name if inst else None,
        'institution_code': inst.inst_code if inst else None,
        'branch_name': asn.branch.branch_name if asn.branch else None,
        'branch_code': asn.branch.branch_code if asn.branch else None,
        ...
    }
```

With:

```python
def _assignment_response(asn) -> dict:
    inst = _assignment_institution(asn)
    dept = asn.designation.department
    branch = dept.branch if dept.branch_id else None
    return {
        'id': str(asn.id),
        'institution': inst.name if inst else None,
        'institution_code': inst.inst_code if inst else None,
        'branch_name': branch.branch_name if branch else None,
        'branch_code': branch.branch_code if branch else None,
        'department': asn.department.dept_name,
        'department_code': asn.department.dept_code,
        'designation': asn.designation.position_name,
        'designation_code': asn.designation.position_code,
        'shift': asn.shift,
        'joining_date': asn.joining_date.isoformat() if asn.joining_date else None,
        'is_primary': asn.is_primary,
        'is_active': asn.is_active,
    }
```

- [ ] **Step 5: Fix `create_assignment()` (line ~1513) — remove branch lookup + create arg**

Find this block inside `create_assignment()` and delete it entirely:

```python
    branch = None
    if payload.branch_code:
        branch = Branch.objects.filter(branch_code=payload.branch_code, is_deleted=False).first()
        if not branch:
            return 400, {'error': f"Branch '{payload.branch_code}' not found"}
```

Then in `EmployeeAssignment.objects.create(...)`, remove the line:

```python
        branch=branch,
```

- [ ] **Step 6: Fix `update_assignment()` (line ~1594) — remove branch_code block**

Find and delete this block inside `update_assignment()`:

```python
    if payload.branch_code is not None:
        if payload.branch_code:
            branch = Branch.objects.filter(branch_code=payload.branch_code, is_deleted=False).first()
            if not branch:
                return 400, {'error': f"Branch '{payload.branch_code}' not found"}
            asn.branch = branch
        else:
            asn.branch = None
```

- [ ] **Step 7: Fix `create_employee()` (line ~868) — remove `branch=branch` from EmployeeAssignment.objects.create()**

Find `EmployeeAssignment.objects.create(` inside the `create_employee` endpoint. It looks like:

```python
            EmployeeAssignment.objects.create(
                employee=employee,
                branch=branch,
                department=dept,
                designation=designation,
                joining_date=joining_date,
                is_primary=True,
                shift=payload.shift or 'general'
            )
```

Remove the `branch=branch,` line. (The `branch` variable looked up from `payload.branchCode` is no longer needed either — delete that lookup too at line ~820.)

- [ ] **Step 8: Fix `get_employee()` prefetch_related (line ~1082)**

Replace:

```python
        employee = Employee.objects.prefetch_related(
            'assignments',
            'assignments__branch',
            'assignments__branch__institution',
            'assignments__department',
            'assignments__department__institution',
            'assignments__designation',
        )
```

With:

```python
        employee = Employee.objects.prefetch_related(
            'assignments',
            'assignments__department',
            'assignments__department__branch',
            'assignments__department__branch__institution',
            'assignments__department__institution',
            'assignments__designation',
            'assignments__designation__department',
            'assignments__designation__department__branch',
            'assignments__designation__department__branch__institution',
        )
```

- [ ] **Step 9: Fix inline branch reads in `get_employee()` response (line ~1099)**

Replace:

```python
                'branch_name': asn.branch.branch_name if asn.branch else "N/A",
                'branch_code': asn.branch.branch_code if asn.branch else None,
```

With:

```python
                'branch_name': asn.designation.department.branch.branch_name if asn.designation.department.branch_id else "N/A",
                'branch_code': asn.designation.department.branch.branch_code if asn.designation.department.branch_id else None,
```

- [ ] **Step 10: Fix list employees prefetch (line ~969)**

Replace:

```python
        query = Employee.objects.filter(is_deleted=False).prefetch_related(
            'assignments',
            'assignments__department',
            'assignments__department__institution',
            'assignments__designation',
            'assignments__branch',
            'assignments__branch__institution',
        )
```

With:

```python
        query = Employee.objects.filter(is_deleted=False).prefetch_related(
            'assignments',
            'assignments__department',
            'assignments__department__branch',
            'assignments__department__branch__institution',
            'assignments__department__institution',
            'assignments__designation',
            'assignments__designation__department',
            'assignments__designation__department__branch',
        )
```

- [ ] **Step 11: Commit API changes**

```bash
git add Backend/src/employees/api.py
git commit -m "refactor(api): derive assignment branch from designation chain, remove branch_code from schemas"
```

---

## Task 5: Write and run integration tests

**Files:**
- Modify: `Backend/src/employees/tests_assignment_branch.py` (append integration tests)

- [ ] **Step 1: Append integration tests to `tests_assignment_branch.py`**

```python
# ── Integration: POST /api/employees/{key}/assignments ───────────────────────

class TestCreateAssignmentAPI:

    @pytest.mark.django_db
    def test_create_assignment_returns_branch_from_department(
        self, api_client, employee, desig_branch, branch
    ):
        """POST assignment returns branch_name/branch_code derived from department."""
        url = f"/api/employees/{employee.employee_id}/assignments"
        payload = {
            "department_code": desig_branch.department.dept_code,
            "designation_code": desig_branch.position_code,
            "joining_date": "2026-01-01",
            "shift": "general",
            "is_primary": True,
        }
        resp = api_client.post(url, data=json.dumps(payload), content_type="application/json")
        assert resp.status_code == 201, resp.json()
        data = resp.json()
        assert data["branch_code"] == branch.branch_code
        assert data["branch_name"] == branch.branch_name

    @pytest.mark.django_db
    def test_create_assignment_branch_null_for_global_dept(
        self, api_client, employee, desig_global
    ):
        """POST assignment returns null branch fields when department is global."""
        url = f"/api/employees/{employee.employee_id}/assignments"
        payload = {
            "department_code": desig_global.department.dept_code,
            "designation_code": desig_global.position_code,
            "joining_date": "2026-01-01",
            "shift": "general",
            "is_primary": True,
        }
        resp = api_client.post(url, data=json.dumps(payload), content_type="application/json")
        assert resp.status_code == 201, resp.json()
        data = resp.json()
        assert data["branch_code"] is None
        assert data["branch_name"] is None

    @pytest.mark.django_db
    def test_create_assignment_rejects_branch_code_field(
        self, api_client, employee, desig_branch, branch
    ):
        """POST with branch_code in body must still succeed — field is ignored (not a 422)."""
        url = f"/api/employees/{employee.employee_id}/assignments"
        payload = {
            "branch_code": branch.branch_code,   # should be silently ignored
            "department_code": desig_branch.department.dept_code,
            "designation_code": desig_branch.position_code,
            "joining_date": "2026-01-01",
            "shift": "general",
            "is_primary": True,
        }
        resp = api_client.post(url, data=json.dumps(payload), content_type="application/json")
        assert resp.status_code == 201, resp.json()


# ── Integration: GET /api/employees/{id} ─────────────────────────────────────

class TestGetEmployeeAssignmentBranch:

    @pytest.mark.django_db
    def test_get_employee_returns_branch_info_derived_from_dept(
        self, api_client, employee, desig_branch, branch
    ):
        """GET employee — assignments[].branch_code derived from dept.branch."""
        EmployeeAssignment.objects.create(
            employee=employee,
            department=desig_branch.department,
            designation=desig_branch,
            joining_date=date(2026, 1, 1),
            is_primary=True,
            shift='general',
        )
        resp = api_client.get(f"/api/employees/{employee.employee_id}")
        assert resp.status_code == 200, resp.json()
        asns = resp.json()["assignments"]
        assert len(asns) == 1
        assert asns[0]["branch_code"] == branch.branch_code

    @pytest.mark.django_db
    def test_get_employee_branch_na_for_global_dept(
        self, api_client, employee, desig_global
    ):
        """GET employee — assignments[].branch_name is 'N/A' when dept is global."""
        EmployeeAssignment.objects.create(
            employee=employee,
            department=desig_global.department,
            designation=desig_global,
            joining_date=date(2026, 1, 1),
            is_primary=True,
            shift='general',
        )
        resp = api_client.get(f"/api/employees/{employee.employee_id}")
        assert resp.status_code == 200, resp.json()
        asns = resp.json()["assignments"]
        assert asns[0]["branch_name"] == "N/A"
        assert asns[0]["branch_code"] is None
```

- [ ] **Step 2: Run all tests in the file**

```bash
cd /home/ubaid/Desktop/AIT-Work/erp_new/Auth-service/Backend/src
pytest employees/tests_assignment_branch.py -v
```

Expected: All tests PASS. If any fail, read the error — it points to a missed API change from Task 4.

- [ ] **Step 3: Run full test suite to check for regressions**

```bash
cd /home/ubaid/Desktop/AIT-Work/erp_new/Auth-service/Backend/src
pytest --tb=short 2>&1 | tail -30
```

Expected: No new failures beyond any pre-existing ones.

- [ ] **Step 4: Commit integration tests**

```bash
git add Backend/src/employees/tests_assignment_branch.py
git commit -m "test(assignment): integration tests for branch-derived-from-dept paths"
```

---

## Task 6: Update PROJECT_LOG.md

**Files:**
- Modify: `Auth-service/PROJECT_LOG.md`

- [ ] **Step 1: Add entry**

Append to the top of the change history section in `Auth-service/PROJECT_LOG.md`:

```markdown
### 2026-06-06 — Remove redundant `branch` FK from `EmployeeAssignment`

**Problem:** `EmployeeAssignment.branch` FK was a second source of truth. `designation.department.branch`
already provides the branch. Two stored values can silently diverge (impossible assignments).

**Changes:**
- `employees/models.py`: Removed `branch` FK. `save()` and `__str__()` now derive branch via
  `designation.department.branch`. `Institution.employee_count()` updated to use `department__branch__institution`.
- `employees/api.py`: `_assignment_institution()`, `_assignment_response()`, `create_assignment()`,
  `update_assignment()`, `create_employee()`, both `prefetch_related` calls, and inline branch reads
  updated. `branch_code` removed from Create/Update schemas.
- Migration `0018_remove_employeeassignment_branch`: Drops the column.

**Tests:** `employees/tests_assignment_branch.py` — 10 tests (unit + integration). All green.
```

- [ ] **Step 2: Commit log**

```bash
git add Auth-service/PROJECT_LOG.md
git commit -m "docs: update PROJECT_LOG for branch FK removal"
```

---

## Self-Review Checklist

- [x] Model `save()` — all 3 prefix cases (branch, institution, global/org) covered
- [x] `__str__()` updated
- [x] `Institution.employee_count()` updated (was using `branch__institution` filter)
- [x] `_assignment_institution()` updated
- [x] `_assignment_response()` updated
- [x] `EmployeeAssignmentCreateSchema` — `branch_code` removed
- [x] `EmployeeAssignmentUpdateSchema` — `branch_code` removed
- [x] `create_assignment()` — branch lookup removed, `branch=branch` removed from create call
- [x] `update_assignment()` — branch_code block removed
- [x] `create_employee()` — `branch=branch` removed from EmployeeAssignment.objects.create(), branch lookup removed
- [x] `get_employee()` — prefetch updated, inline branch reads updated
- [x] `list_employees()` — prefetch updated
- [x] Migration generated and applied
- [x] Unit tests: save() x3, __str__() x2, _assignment_institution() x2
- [x] Integration tests: POST x3, GET x2
