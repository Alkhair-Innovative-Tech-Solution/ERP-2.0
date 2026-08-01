"""
SMS staff user importer (Phase B1).

Reads SMS-shaped staff user records (see SMS_STAFF_RECORD_FIELDS below) and
upserts matching central-auth `Employee` identities into tenant `SMS01`,
carrying the password hash over as-is (never re-hashed) and recording the
original SMS user id as `Employee.legacy_user_id` for idempotent re-runs and
exact FK remapping in later phases.

This module has NO knowledge of SMS's database, HTTP APIs, or Docker
topology — it only knows the record shape below. Wiring it to the real SMS
DB later is a matter of producing an iterable of these dicts from a query
against `users_user` joined to the relevant profile table
(teachers.Teacher / principals.Principal / coordinator.Coordinator, by
`profile.user_id == user.id`) — nothing in this module needs to change.

SMS_STAFF_RECORD_FIELDS — the input contract:
    legacy_user_id  (int, required)  SMS users_user.id — the idempotency/match key.
    email           (str, required)  SMS users_user.email. Primary human-readable
                                      match key; must be unique per record.
    username        (str, required)  SMS users_user.username — kept only for
                                      reference (not stored centrally as an
                                      identity field; central auth authenticates
                                      by employee_code, not username).
    role            (str, required)  One of SMS's User.ROLE_CHOICES, staff
                                      roles only for B1 (e.g. 'teacher',
                                      'principal', 'coordinator', 'admin',
                                      'org_admin', 'accounts_officer',
                                      'admissions_counselor',
                                      'compliance_officer'). Mapped to a
                                      central-auth Designation under a shared
                                      "SMS Staff" Department — NOT into the
                                      permissions RBAC catalog (Role/
                                      EmployeeRole/ServiceAccess) — that
                                      wiring is Phase B3, deliberately
                                      deferred (see PHASE_B1_USER_IMPORT_RESULT.md).
    password_hash   (str, required)  The SMS-side Django password hash
                                      (django.contrib.auth.hashers.make_password
                                      output) — carried over verbatim into
                                      UserCredentials.password_hash. Never
                                      re-hashed; B0 confirmed both sides use
                                      Django's default hasher, so this is a
                                      direct, valid carry-over.
    full_name       (str, required)  From the SMS profile record
                                      (Teacher/Principal/Coordinator.full_name)
                                      — User itself has no full_name field in
                                      SMS, it's on the profile.
    cnic            (str, required)  From the SMS profile record. Must be
                                      unique across all Employee rows
                                      (Employee.cnic is a unique field).
    dob             (date|str, required) From the SMS profile record
                                      (YYYY-MM-DD if str).
    gender          (str, required)  'male' | 'female' | 'other' — from the
                                      SMS profile record.
    phone           (str, optional)  From the SMS profile record
                                      (contact_number).
    joining_date    (date|str, optional) From the SMS profile record. Defaults
                                      to today if absent.
    is_active       (bool, optional) Defaults to True.

Fields intentionally NOT in this contract: SMS's `campus` (SMS-local
profile data — Phase A1 mapped this as staying in SMS, not central
identity) and SMS's own `employee_code`/`username` (never used as the
central identity code — central auth generates its own via
EmployeeAssignment, same as every other Employee).
"""
from datetime import date, datetime

from django.db import transaction

from authentication.models import UserCredentials
from employees.models import Department, Designation, Employee, EmployeeAssignment, Organization, Tenant

SMS_STAFF_RECORD_FIELDS = (
    "legacy_user_id", "email", "username", "role", "password_hash",
    "full_name", "cnic", "dob", "gender", "phone", "joining_date", "is_active",
)

REQUIRED_FIELDS = (
    "legacy_user_id", "email", "username", "role", "password_hash",
    "full_name", "cnic", "dob", "gender",
)

SMS_STAFF_DEPARTMENT_CODE = "SMS"
SMS_STAFF_DEPARTMENT_NAME = "SMS Staff"


def _parse_date(value):
    if isinstance(value, date):
        return value
    return datetime.strptime(value, "%Y-%m-%d").date()


def _get_sms_org(tenant_code="SMS01"):
    tenant = Tenant.objects.get(tenant_code=tenant_code)
    org = tenant.organizations.first()
    if not org:
        raise Organization.DoesNotExist(f"No Organization found under tenant '{tenant_code}'")
    return tenant, org


def _get_or_create_staff_department(org):
    department, _ = Department.objects.get_or_create(
        organization=org,
        dept_code=SMS_STAFF_DEPARTMENT_CODE,
        defaults={"dept_name": SMS_STAFF_DEPARTMENT_NAME},
    )
    return department


def _get_or_create_role_designation(department, role):
    position_code = role[:10].upper()
    position_name = role.replace("_", " ").title()
    designation, _ = Designation.objects.get_or_create(
        department=department,
        position_code=position_code,
        defaults={"position_name": position_name},
    )
    return designation


def import_staff_records(records, tenant_code="SMS01"):
    """Idempotently import an iterable of SMS staff dicts (see
    SMS_STAFF_RECORD_FIELDS) into central auth. Matches existing Employees by
    legacy_user_id first, then by email — re-running never duplicates.

    Returns a summary dict: {"created": int, "updated": int, "errors": [(record, message), ...]}.
    """
    tenant, org = _get_sms_org(tenant_code)
    department = _get_or_create_staff_department(org)

    summary = {"created": 0, "updated": 0, "errors": []}

    for record in records:
        missing = [f for f in REQUIRED_FIELDS if not record.get(f) and record.get(f) != 0]
        if missing:
            summary["errors"].append((record, f"Missing required field(s): {missing}"))
            continue

        try:
            with transaction.atomic():
                is_new = _import_one(record, org, department)
        except Exception as e:
            summary["errors"].append((record, str(e)))
            continue

        if is_new:
            summary["created"] += 1
        else:
            summary["updated"] += 1

    return summary


def _import_one(record, org, department):
    employee = Employee.objects.filter(legacy_user_id=record["legacy_user_id"]).first()
    if not employee:
        employee = Employee.objects.filter(org_email__iexact=record["email"]).first()

    is_new = employee is None
    if is_new:
        employee = Employee()
        # Employee.save() auto-generates employee_id from
        # Employee.all_objects.all().order_by('employee_id').last() — a
        # pre-existing bug: that lookup is global and string-lexicographic,
        # NOT scoped per-organization, so once employees with other org
        # prefixes exist (e.g. 'VMST-0002'), every new SMS01 employee
        # collides on the same computed id ('S' < 'V', so 'VMST-...' always
        # wins the ordering and its number gets reused for every SMS01
        # row). Not fixed here — shared code, used by VMS/HDMS too, out of
        # scope for this increment. Worked around by pre-computing a
        # correctly org-scoped id ourselves; Employee.save() only
        # auto-generates when employee_id is falsy, so setting it here
        # short-circuits the buggy path entirely.
        prefix = org.org_code
        last = Employee.all_objects.filter(employee_id__startswith=f"{prefix}-").order_by("employee_id").last()
        num = (int(last.employee_id.rsplit("-", 1)[-1]) + 1) if last else 1
        padding = 4 if num < 10000 else len(str(num))
        employee.employee_id = f"{prefix}-{num:0{padding}d}"

    employee.legacy_user_id = record["legacy_user_id"]
    employee.full_name = record["full_name"]
    employee.cnic = record["cnic"]
    employee.dob = _parse_date(record["dob"])
    employee.gender = record["gender"]
    employee.org_email = record["email"]
    if record.get("phone"):
        employee.personal_phone = record["phone"]
    employee.organization = org
    employee.is_active = record.get("is_active", True)
    employee.save()

    designation = _get_or_create_role_designation(department, record["role"])
    joining_date = _parse_date(record["joining_date"]) if record.get("joining_date") else date.today()
    EmployeeAssignment.objects.get_or_create(
        employee=employee,
        department=department,
        designation=designation,
        defaults={"joining_date": joining_date, "is_primary": True},
    )

    creds, _ = UserCredentials.objects.get_or_create(employee=employee)
    creds.password_hash = record["password_hash"]
    creds.save(update_fields=["password_hash"])

    return is_new
