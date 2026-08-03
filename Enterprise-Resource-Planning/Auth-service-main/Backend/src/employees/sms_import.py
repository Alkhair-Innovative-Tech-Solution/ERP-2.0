"""
SMS user importer (Phase B1 staff, Phase B2 students).

Reads SMS-shaped user records and upserts matching central-auth identities
into tenant `SMS01`, carrying the password hash over as-is (never re-hashed)
and recording the original SMS user id as `legacy_user_id` for idempotent
re-runs and exact FK remapping in later phases. Staff become `Employee`
identities (`import_staff_records`); students become `NonStaffIdentity`
identities (`import_student_records`) — same mechanism, same upsert-by-
legacy_user_id-then-email logic, same hash-carry-over, shared via
`_run_batch`/`_upsert_credentials` below. They differ only in target model,
person_type, and the presence/absence of HR fields (staff get a Designation
via EmployeeAssignment; students get neither — that's the whole point of
NonStaffIdentity, see docs/PHASE_A2_STUDENT_IDENTITY_RESULT.md).

This module has NO knowledge of SMS's database, HTTP APIs, or Docker
topology — it only knows the record shapes documented below. Wiring it to
the real SMS DB later is a matter of producing an iterable of these dicts
from a query — nothing in this module needs to change.

SMS_STAFF_RECORD_FIELDS — the staff input contract:
    legacy_user_id  (int, required)  SMS users_user.id — the idempotency/match key.
    email           (str, required)  SMS users_user.email. Primary human-readable
                                      match key; must be unique per record.
    username        (str, required)  SMS users_user.username — kept only for
                                      reference (not stored centrally as an
                                      identity field; central auth authenticates
                                      by employee_code, not username).
    role            (str, required)  One of SMS's User.ROLE_CHOICES, staff
                                      roles only (e.g. 'teacher', 'principal',
                                      'coordinator', 'admin', 'org_admin',
                                      'accounts_officer',
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

Fields intentionally NOT in the staff contract: SMS's `campus` (SMS-local
profile data — Phase A1 mapped this as staying in SMS, not central
identity) and SMS's own `employee_code`/`username` (never used as the
central identity code — central auth generates its own via
EmployeeAssignment, same as every other Employee).

SMS_STUDENT_RECORD_FIELDS — the student input contract (deliberately
smaller — students have no HR fields, no department/branch, no
profile-level cnic/dob/gender requirement the way staff do; central auth
only needs enough to authenticate them, per A2's identity-only design):
    legacy_user_id  (int, required)  SMS users_user.id — the idempotency/match key.
    email           (str, required)  SMS users_user.email. Primary match key.
    username        (str, required)  SMS users_user.username / Student.student_id
                                      (Phase A1: the student's login identifier
                                      lives on the Student profile, not User)
                                      — kept for reference only, not stored as
                                      the central identity code (central auth
                                      generates its own identity_code).
    password_hash   (str, required)  Carried over verbatim, same as staff.
    full_name       (str, required)  From the SMS Student profile record.
    role            (str, optional)  Defaults to 'student'. Stored on
                                      NonStaffIdentity.role as a label only —
                                      no RBAC wiring, same deferral as A2/B1.
    is_active       (bool, optional) Defaults to True.
"""
from datetime import date, datetime

from django.db import transaction

from authentication.models import UserCredentials
from authentication.nonstaff_models import NonStaffIdentity
from employees.models import Department, Designation, Employee, EmployeeAssignment, Organization, Tenant

SMS_STAFF_RECORD_FIELDS = (
    "legacy_user_id", "email", "username", "role", "password_hash",
    "full_name", "cnic", "dob", "gender", "phone", "joining_date", "is_active",
)
STAFF_REQUIRED_FIELDS = (
    "legacy_user_id", "email", "username", "role", "password_hash",
    "full_name", "cnic", "dob", "gender",
)

SMS_STUDENT_RECORD_FIELDS = (
    "legacy_user_id", "email", "username", "password_hash", "full_name", "role", "is_active",
)
STUDENT_REQUIRED_FIELDS = (
    "legacy_user_id", "email", "username", "password_hash", "full_name",
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


def _upsert_credentials(password_hash, **link_kwargs):
    """Shared by staff and students: get-or-create UserCredentials linked via
    whichever kwarg identifies the identity type (employee=... or
    non_staff_identity=...), then write the carried-over hash directly —
    never through set_password(), which would re-hash an already-hashed
    value."""
    creds, _ = UserCredentials.objects.get_or_create(**link_kwargs)
    creds.password_hash = password_hash
    creds.save(update_fields=["password_hash"])
    return creds


def _run_batch(records, tenant_code, required_fields, import_one_fn):
    """Shared batch runner: per-record validation, one transaction.atomic()
    each (so one bad record can't corrupt the batch or block the rest),
    created/updated/errors summary. import_one_fn(record, tenant, org) must
    return True for a newly-created identity, False for an update."""
    tenant, org = _get_sms_org(tenant_code)
    summary = {"created": 0, "updated": 0, "errors": []}

    for record in records:
        missing = [f for f in required_fields if not record.get(f) and record.get(f) != 0]
        if missing:
            summary["errors"].append((record, f"Missing required field(s): {missing}"))
            continue

        try:
            with transaction.atomic():
                is_new = import_one_fn(record, tenant, org)
        except Exception as e:
            summary["errors"].append((record, str(e)))
            continue

        summary["created" if is_new else "updated"] += 1

    return summary


# ─────────────────────────── Staff (Phase B1) ───────────────────────────

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
    SMS_STAFF_RECORD_FIELDS) into central auth as Employee identities.
    Matches existing Employees by legacy_user_id first, then by email —
    re-running never duplicates.

    Returns a summary dict: {"created": int, "updated": int, "errors": [(record, message), ...]}.
    """
    tenant, org = _get_sms_org(tenant_code)
    department = _get_or_create_staff_department(org)

    def _one(record, tenant, org):
        return _import_staff_one(record, org, department)

    return _run_batch(records, tenant_code, STAFF_REQUIRED_FIELDS, _one)


def _import_staff_one(record, org, department):
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

    _upsert_credentials(record["password_hash"], employee=employee)

    return is_new


# ─────────────────────────── Students (Phase B2) ───────────────────────────

SMS_STUDENT_IDENTITY_CODE_INFIX = "STU"


def _next_student_identity_code(org):
    """NonStaffIdentity.identity_code has no auto-generation of its own (A2
    deliberately left it a plain unique CharField — no EmployeeAssignment-
    style chain to derive it from). Scoped by org prefix from the start,
    so this doesn't inherit the class of bug _import_staff_one worked
    around for Employee.employee_id (see comment there) — there's no
    shared/legacy generation method here to collide with."""
    prefix = f"{org.org_code}-{SMS_STUDENT_IDENTITY_CODE_INFIX}"
    last = NonStaffIdentity.objects.filter(identity_code__startswith=f"{prefix}-").order_by("identity_code").last()
    num = (int(last.identity_code.rsplit("-", 1)[-1]) + 1) if last else 1
    padding = 4 if num < 10000 else len(str(num))
    return f"{prefix}-{num:0{padding}d}"


def import_student_records(records, tenant_code="SMS01"):
    """Idempotently import an iterable of SMS student dicts (see
    SMS_STUDENT_RECORD_FIELDS) into central auth as NonStaffIdentity
    (person_type='student') identities. Matches existing identities by
    legacy_user_id first, then by email — re-running never duplicates.

    Returns a summary dict: {"created": int, "updated": int, "errors": [(record, message), ...]}.
    """
    return _run_batch(records, tenant_code, STUDENT_REQUIRED_FIELDS, _import_student_one)


def _import_student_one(record, tenant, org):
    identity = NonStaffIdentity.objects.filter(legacy_user_id=record["legacy_user_id"]).first()
    if not identity:
        identity = NonStaffIdentity.objects.filter(email__iexact=record["email"]).first()

    is_new = identity is None
    if is_new:
        identity = NonStaffIdentity(tenant=tenant, identity_code=_next_student_identity_code(org))

    identity.legacy_user_id = record["legacy_user_id"]
    identity.full_name = record["full_name"]
    identity.email = record["email"]
    identity.person_type = "student"
    identity.role = record.get("role") or "student"
    identity.is_active = record.get("is_active", True)
    identity.save()

    _upsert_credentials(record["password_hash"], non_staff_identity=identity)

    return is_new
