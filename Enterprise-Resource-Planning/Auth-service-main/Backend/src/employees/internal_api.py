"""
Internal service-to-service endpoints — not part of the public API surface.
Gated by a shared-secret header (X-Internal-Secret), the same convention
SMS's own auth-service uses for its /api/internal/create-user/ endpoint.

Phase B4: thin receiving side for SMS's staff-creation dual-write. Reuses
the exact B1 import logic (employees.sms_import.import_staff_records) for
a single record — batch (Phase B1's management command) and live (this
endpoint) share the same create/upsert code, nothing duplicated.
"""
from typing import List, Optional

from django.http import HttpRequest
from decouple import config
from ninja import Router, Schema

from employees.sms_import import import_staff_records

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
