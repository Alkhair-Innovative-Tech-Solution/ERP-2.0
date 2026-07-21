"""Regression tests for API hardening work (2026-04-22)."""
import json
import pytest
from employees.models import Department, Designation, Institution, Organization


@pytest.fixture
def org(db):
    return Organization.objects.create(org_code="IAK", name="Alkhair")


@pytest.fixture
def institution(db, org):
    return Institution.objects.create(
        organization=org, inst_code="T-INST", name="Test Institution", inst_type="educational"
    )


@pytest.fixture
def department(db, institution):
    return Department.objects.create(
        institution=institution, dept_code="TDEPT", dept_name="Test Dept"
    )


@pytest.fixture
def designation(db, department):
    return Designation.objects.create(
        department=department, position_code="TPOS", position_name="Test Position"
    )


class TestOptionalNullUpdates:
    """Pydantic schemas must accept explicit null for optional fields."""

    @pytest.mark.django_db
    def test_designation_update_accepts_null_description(self, api_client, designation):
        response = api_client.put(
            f"/api/employees/designations/{designation.id}",
            data=json.dumps({"position_name": "Renamed", "description": None}),
            content_type="application/json",
        )
        assert response.status_code == 200, response.content
        designation.refresh_from_db()
        assert designation.position_name == "Renamed"
        assert designation.description is None

    @pytest.mark.django_db
    def test_department_update_accepts_null_description(self, api_client, department):
        response = api_client.put(
            f"/api/employees/departments/{department.dept_code}",
            data=json.dumps({"dept_name": "Renamed", "description": None, "institution_code": None}),
            content_type="application/json",
        )
        assert response.status_code == 200, response.content


class TestBodySchemaRouting:
    """Endpoints accept JSON bodies, validate required fields, and surface per-field errors."""

    @pytest.mark.django_db
    def test_create_institution_rejects_missing_name(self, api_client, org):
        response = api_client.post(
            "/api/employees/institutions",
            data=json.dumps({"organization_code": "IAK", "inst_code": "X-INST"}),
            content_type="application/json",
        )
        assert response.status_code == 422, response.content
        body = response.json()
        assert "detail" in body
        locs = [".".join(str(p) for p in err.get("loc", [])) for err in body["detail"]]
        assert any("name" in loc for loc in locs), locs

    @pytest.mark.django_db
    def test_create_institution_success(self, api_client, org):
        response = api_client.post(
            "/api/employees/institutions",
            data=json.dumps({
                "organization_code": "IAK",
                "inst_code": "X-INST",
                "name": "X Institution",
                "inst_type": "educational",
            }),
            content_type="application/json",
        )
        assert response.status_code == 201, response.content
        assert response.json()["inst_code"] == "X-INST"

    @pytest.mark.django_db
    def test_create_branch_rejects_missing_branch_name(self, api_client, institution):
        response = api_client.post(
            "/api/employees/branches",
            data=json.dumps({"branch_code": "X-BR", "institution_code": institution.inst_code}),
            content_type="application/json",
        )
        assert response.status_code == 422, response.content
        locs = [".".join(str(p) for p in err.get("loc", [])) for err in response.json()["detail"]]
        assert any("branch_name" in loc for loc in locs), locs

    @pytest.mark.django_db
    def test_update_branch_accepts_partial_payload(self, api_client, institution):
        from employees.models import Branch
        branch = Branch.objects.create(
            institution=institution, branch_code="X-BR", branch_name="Before"
        )
        response = api_client.put(
            f"/api/employees/branches/{branch.branch_code}",
            data=json.dumps({"branch_name": "After"}),
            content_type="application/json",
        )
        assert response.status_code == 200, response.content
        branch.refresh_from_db()
        assert branch.branch_name == "After"


class TestAssignmentInstitutionRemoval:
    """Regression tests proving EmployeeAssignment.institution FK must be removed."""

    @pytest.mark.django_db
    def test_assignment_has_no_institution_field(self):
        from employees.models import EmployeeAssignment
        field_names = [f.name for f in EmployeeAssignment._meta.get_fields()]
        assert 'institution' not in field_names, \
            "EmployeeAssignment.institution FK must be removed — it causes impossible assignments"

    @pytest.mark.django_db
    def test_get_employee_returns_institution_derived_from_branch(self, api_client, designation):
        import datetime
        from employees.models import Employee, Organization, EmployeeAssignment
        org = Organization.objects.first()
        emp = Employee.objects.create(
            organization=org,
            full_name="Derive Test",
            cnic="42201-9999999-9",
            dob=datetime.date(1990, 1, 1),
            gender="male",
        )
        asn = EmployeeAssignment.objects.create(
            employee=emp,
            department=designation.department,
            designation=designation,
            joining_date=datetime.date(2026, 1, 1),
            is_primary=True,
        )
        # Force-set employee_code so GET lookup works
        emp.employee_code = f"DERIVE-TEST-{emp.employee_id}"
        emp.save(update_fields=["employee_code"])

        response = api_client.get(f"/api/employees/employees/{emp.employee_code}")
        assert response.status_code == 200, response.content
        body = response.json()
        assignments = body.get("assignments", [])
        assert len(assignments) >= 1
        # institution_code must come from department.institution chain (not a stored FK)
        expected = designation.department.institution.inst_code if designation.department.institution else None
        assert assignments[0]["institution_code"] == expected


class TestRS256JWTRoundtrip:
    """JWT tokens must be signed with RS256 and verifiable with public key only."""

    def test_access_token_uses_rs256_algorithm(self):
        import jwt as pyjwt
        from authentication.jwt_utils import generate_access_token, JWT_PUBLIC_KEY, JWT_ALGORITHM

        class FakeEmployee:
            id = "00000000-0000-0000-0000-000000000001"
            employee_code = "TEST-0001"
            employee_id = "IAK-0001"
            full_name = "Test User"
            org_email = "test@test.com"
            personal_email = None
            is_active = True
            department = None
            designation = None
            @property
            def email(self): return self.org_email or ""

        token = generate_access_token(FakeEmployee())
        assert JWT_ALGORITHM == 'RS256', f"Expected RS256, got {JWT_ALGORITHM}"
        payload = pyjwt.decode(token, JWT_PUBLIC_KEY, algorithms=['RS256'])
        assert payload['user_id'] == "00000000-0000-0000-0000-000000000001"
        assert payload['token_type'] == 'access'

    def test_token_rejected_with_wrong_key(self):
        import jwt as pyjwt
        import subprocess
        from authentication.jwt_utils import generate_access_token

        class FakeEmployee:
            id = "00000000-0000-0000-0000-000000000002"
            employee_code = "TEST-0002"
            employee_id = "IAK-0002"
            full_name = "Fake"
            org_email = None
            personal_email = "fake@test.com"
            is_active = True
            department = None
            designation = None
            @property
            def email(self): return self.personal_email or ""

        token = generate_access_token(FakeEmployee())
        # Generate a different key pair — token must not verify with it
        wrong_priv = subprocess.run(['openssl', 'genrsa', '2048'], capture_output=True, text=True).stdout
        wrong_pub = subprocess.run(['openssl', 'rsa', '-pubout'], input=wrong_priv, capture_output=True, text=True).stdout
        with pytest.raises(pyjwt.exceptions.InvalidSignatureError):
            pyjwt.decode(token, wrong_pub, algorithms=['RS256'])
