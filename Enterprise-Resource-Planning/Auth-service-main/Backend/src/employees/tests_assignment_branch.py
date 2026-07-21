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
        # Regression guard: global-dept path is unchanged by this refactor — passes before and after.
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
        # Regression guard: global-dept path is unchanged by this refactor — passes before and after.
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
        # Regression guard: global-dept path is unchanged by this refactor — passes before and after.
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
        # Regression guard: global-dept path is unchanged by this refactor — passes before and after.
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


# ── Integration: POST /api/employees/{key}/assignments ───────────────────────

class TestCreateAssignmentAPI:

    @pytest.mark.django_db
    def test_create_assignment_returns_branch_from_department(
        self, auth_client, desig_branch, branch
    ):
        client, employee = auth_client
        url = f"/api/employees/employees/{employee.employee_id}/assignments"
        payload = {
            "department_code": desig_branch.department.dept_code,
            "designation_code": desig_branch.position_code,
            "joining_date": "2026-01-01",
            "shift": "general",
            "is_primary": True,
        }
        resp = client.post(url, data=json.dumps(payload), content_type="application/json")
        assert resp.status_code == 201, resp.content
        data = resp.json()
        assert data["branch_code"] == branch.branch_code
        assert data["branch_name"] == branch.branch_name

    @pytest.mark.django_db
    def test_create_assignment_branch_null_for_global_dept(
        self, auth_client, desig_global
    ):
        # Regression guard: global-dept path is unchanged by this refactor — passes before and after.
        client, employee = auth_client
        url = f"/api/employees/employees/{employee.employee_id}/assignments"
        payload = {
            "department_code": desig_global.department.dept_code,
            "designation_code": desig_global.position_code,
            "joining_date": "2026-01-01",
            "shift": "general",
            "is_primary": True,
        }
        resp = client.post(url, data=json.dumps(payload), content_type="application/json")
        assert resp.status_code == 201, resp.content
        data = resp.json()
        assert data["branch_code"] is None
        assert data["branch_name"] is None


# ── Integration: GET /api/employees/{id} ─────────────────────────────────────

class TestGetEmployeeAssignmentBranch:

    @pytest.mark.django_db
    def test_get_employee_returns_branch_info_derived_from_dept(
        self, auth_client, desig_branch, branch
    ):
        client, employee = auth_client
        EmployeeAssignment.objects.create(
            employee=employee,
            department=desig_branch.department,
            designation=desig_branch,
            joining_date=date(2026, 1, 1),
            is_primary=True,
            shift='general',
        )
        resp = client.get(f"/api/employees/employees/{employee.employee_id}")
        assert resp.status_code == 200, resp.content
        asns = resp.json()["assignments"]
        assert len(asns) == 1
        assert asns[0]["branch_code"] == branch.branch_code

    @pytest.mark.django_db
    def test_get_employee_branch_na_for_global_dept(
        self, auth_client, desig_global
    ):
        # Regression guard: global-dept path is unchanged by this refactor — passes before and after.
        client, employee = auth_client
        EmployeeAssignment.objects.create(
            employee=employee,
            department=desig_global.department,
            designation=desig_global,
            joining_date=date(2026, 1, 1),
            is_primary=True,
            shift='general',
        )
        resp = client.get(f"/api/employees/employees/{employee.employee_id}")
        assert resp.status_code == 200, resp.content
        asns = resp.json()["assignments"]
        assert asns[0]["branch_name"] == "N/A"
        assert asns[0]["branch_code"] is None
