"""
Internal service-to-service endpoints — not part of the public API surface.
Gated by a shared-secret header (X-Internal-Secret), the same convention
SMS's own auth-service uses for its /api/internal/create-user/ endpoint.

Phase B4: thin receiving side for SMS's staff-creation dual-write. Reuses
the exact B1 import logic (employees.sms_import.import_staff_records) for
a single record — batch (Phase B1's management command) and live (this
endpoint) share the same create/upsert code, nothing duplicated.

Phase D-b2: same shape for students — thin receiving side for SMS's
student-creation dual-write, reusing the exact B2 import logic
(employees.sms_import.import_student_records). Mirrors sms-staff exactly:
same secret/gate logic, same fail-closed behavior, only the record shape
and import fn differ (no HR fields; see import_student_records's own
SMS_STUDENT_RECORD_FIELDS docstring).

Phase D-b5: sms-org-sync — receiving side for org-service's org name/
active-status dual-write. Unlike staff/student, org-admin provisioning
itself reuses sms-staff above (role='org_admin', see
docs/PHASE_D_B5_ORG_PROVISIONING_RESULT.md for why); this endpoint is only
for the Organization record's own name/is_active fields, matched by the
new Organization.legacy_org_id (mirrors legacy_user_id's idempotency
pattern, added this phase since none existed before).
"""
from typing import List, Optional

from django.http import HttpRequest
from decouple import config
from ninja import Router, Schema

from employees.sms_import import import_staff_records, import_student_records
from employees.models import Organization, Tenant

router = Router(tags=["Internal"])

INTERNAL_SECRET = config('SMS_INTERNAL_SECRET', default='')


class SmsStaffSyncIn(Schema):
    legacy_user_id: int
    email: str
    username: str
    role: str
    password_hash: str
    full_name: str
    cnic: str
    dob: str
    gender: str
    phone: Optional[str] = None
    joining_date: Optional[str] = None
    is_active: bool = True


class SmsStaffSyncOut(Schema):
    created: int
    updated: int
    errors: List[str]


class ErrorOut(Schema):
    error: str


@router.post("/sms-staff", response={200: SmsStaffSyncOut, 401: ErrorOut})
def sync_sms_staff(request: HttpRequest, payload: SmsStaffSyncIn):
    """Upsert one SMS staff member into central auth's SMS01 tenant.
    Fails closed: if SMS_INTERNAL_SECRET isn't configured, every request
    is rejected (there's no way to "accidentally" leave this open)."""
    secret = request.headers.get('X-Internal-Secret', '')
    if not INTERNAL_SECRET or secret != INTERNAL_SECRET:
        return 401, {"error": "Invalid or missing internal secret"}

    record = payload.dict()
    summary = import_staff_records([record], tenant_code="SMS01")
    return 200, {
        "created": summary["created"],
        "updated": summary["updated"],
        "errors": [f"{r.get('legacy_user_id')}: {msg}" for r, msg in summary["errors"]],
    }


class SmsStudentSyncIn(Schema):
    legacy_user_id: int
    email: str
    username: str
    password_hash: str
    full_name: str
    role: str = "student"
    is_active: bool = True


class SmsStudentSyncOut(Schema):
    created: int
    updated: int
    errors: List[str]


@router.post("/sms-student", response={200: SmsStudentSyncOut, 401: ErrorOut})
def sync_sms_student(request: HttpRequest, payload: SmsStudentSyncIn):
    """Upsert one SMS student into central auth's SMS01 tenant, as a
    NonStaffIdentity. Mirrors sync_sms_staff exactly — same secret check,
    same fail-closed behavior — only the import fn differs
    (import_student_records instead of import_staff_records)."""
    secret = request.headers.get('X-Internal-Secret', '')
    if not INTERNAL_SECRET or secret != INTERNAL_SECRET:
        return 401, {"error": "Invalid or missing internal secret"}

    record = payload.dict()
    summary = import_student_records([record], tenant_code="SMS01")
    return 200, {
        "created": summary["created"],
        "updated": summary["updated"],
        "errors": [f"{r.get('legacy_user_id')}: {msg}" for r, msg in summary["errors"]],
    }


class SmsOrgSyncIn(Schema):
    legacy_org_id: int
    name: Optional[str] = None
    is_active: Optional[bool] = None


class SmsOrgSyncOut(Schema):
    created: bool
    updated: bool


@router.post("/sms-org-sync", response={200: SmsOrgSyncOut, 401: ErrorOut})
def sync_sms_org(request: HttpRequest, payload: SmsOrgSyncIn):
    """Upsert an SMS org-service Organization's name/active-status into
    central auth, matched idempotently by legacy_org_id. Fields are
    optional — only what's present gets applied, so a partial update (e.g.
    just is_active on invoice approval) doesn't clobber name with null.
    Same secret check, same fail-closed behavior as sms-staff/sms-student.

    Always lands under tenant SMS01's existing Organization set — creates
    a new Organization row on first sync for a given legacy_org_id (org_code
    derived from it, since org-service's own Organization has no code of
    its own to reuse), updates it on every subsequent call.
    """
    secret = request.headers.get('X-Internal-Secret', '')
    if not INTERNAL_SECRET or secret != INTERNAL_SECRET:
        return 401, {"error": "Invalid or missing internal secret"}

    tenant = Tenant.objects.get(tenant_code="SMS01")
    org = Organization.all_objects.filter(legacy_org_id=payload.legacy_org_id).first()
    created = org is None
    if created:
        org = Organization(
            tenant=tenant,
            legacy_org_id=payload.legacy_org_id,
            org_code=f"SO{payload.legacy_org_id}"[:10],
            name=payload.name or f"SMS Org {payload.legacy_org_id}",
        )
    if payload.name is not None:
        org.name = payload.name
    if payload.is_active is not None:
        org.is_active = payload.is_active
    org.save()

    return 200, {"created": created, "updated": not created}
