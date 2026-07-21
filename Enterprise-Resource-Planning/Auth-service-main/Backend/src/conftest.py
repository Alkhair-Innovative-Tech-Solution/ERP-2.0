"""
Pytest fixtures for auth-service tests.
"""
import pytest
import uuid
from django.test import Client
from employees.models import Department, Designation, Employee, Organization, Institution, Branch, EmployeeAssignment
from datetime import date, date as _date


@pytest.fixture
def api_client():
    """Django test client for API calls"""
    return Client()


@pytest.fixture
def sample_department(db):
    """Create a sample department for testing"""
    dept = Department.objects.create(
        dept_code="TEST",
        dept_name="Test Department",
        dept_sector="other",
        description="Test department for unit tests"
    )
    return dept


@pytest.fixture
def sample_designation(db, sample_department):
    """Create a sample designation for testing"""
    designation = Designation.objects.create(
        department=sample_department,
        position_code="TST",
        position_name="Tester",
        description="Test designation"
    )
    return designation


@pytest.fixture
def sample_employee(db, sample_department, sample_designation):
    """Create a sample employee for testing"""
    employee = Employee.objects.create(
        full_name="Test Employee",
        email="test@example.com",
        phone="1234567890",
        cnic="1234567890123",
        dob=date(1990, 1, 1),
        gender="male",
        residential_address="Test Address",
        department=sample_department,
        designation=sample_designation,
        joining_date=date.today(),
        bank_name="Test Bank",
        account_number="1234567890"
    )
    return employee


# ── New fixtures matching current models ─────────────────────────────────────

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


@pytest.fixture
def auth_client(db, employee):
    """Django test client pre-loaded with a valid Bearer token for `employee`."""
    from authentication.jwt_utils import generate_access_token
    token = generate_access_token(employee)
    client = Client()
    client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {token}'
    return client, employee


@pytest.fixture
def superadmin(db):
    from authentication.superadmin_models import SuperAdmin
    return SuperAdmin.objects.create(
        superadmin_code="S-26-0001",
        full_name="Test SuperAdmin",
        email="superadmin@test.com",
        is_active=True,
    )


@pytest.fixture
def superadmin_auth_client(db, superadmin):
    from authentication.jwt_utils import generate_access_token
    token = generate_access_token(superadmin)
    client = Client()
    client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {token}'
    return client, superadmin
