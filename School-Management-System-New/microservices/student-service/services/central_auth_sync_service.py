"""
Phase D-b2: dual-write student creation to central auth (SMS01 tenant), in
addition to student-service's own local legacy account
(students/views.py's _ensure_student_user_account, which stays untouched —
that's still what a legacy-authenticated request's student login runs
against; this is preparation for retiring it later).

Mirrors staff-service's services/central_auth_sync_service.py (Phase B4)
exactly: same SYNC_TO_CENTRAL_AUTH env flag (one switch controls both staff
and student sync), same CENTRAL_AUTH_URL/SMS_INTERNAL_SECRET config,
same low-level-fn-plus-convenience-wrapper shape, same "never raises"
contract. Central auth's own receiving endpoint
(POST /api/internal/sms-student) reuses the exact B2 import_student_records()
function (see Auth-service-main/.../employees/internal_api.py), same as
staff's POST /api/internal/sms-staff reuses import_staff_records() — so the
whole path, both sides, is one create implementation reached through
different entry points, not duplicated.
"""
import os
import json
import urllib.request
import urllib.error

DEFAULT_PASSWORD = '12345'


def sync_student_to_central_auth(*, legacy_user_id, email, username, password_hash,
                                   full_name, role='student', is_active=True):
    """Low-level: takes plain values matching central auth's
    SMS_STUDENT_RECORD_FIELDS contract exactly (Phase B2). Both call sites
    (the entity wrapper below, for the legacy branch which has a local
    users.User to draw a real password hash from; and students/views.py's
    central-auth branch directly, which has no local users.User at all)
    build these values from their own data source, then call this ONE
    function — the HTTP/payload logic lives here exactly once, same
    principle as staff's sync_staff_to_central_auth.

    password_hash must be the ALREADY-HASHED value — carried over verbatim,
    never re-hashed, same principle as B1/B2/B4.

    Returns (ok: bool, message: str). Never raises — a central-auth outage
    must not block the local SMS write, which already happened by the time
    every call site invokes this.
    """
    if os.getenv('SYNC_TO_CENTRAL_AUTH', 'false').lower() != 'true':
        return False, "disabled (SYNC_TO_CENTRAL_AUTH not set)"

    central_auth_url = os.getenv('CENTRAL_AUTH_URL', 'http://host.docker.internal:8000')
    secret = os.getenv('SMS_INTERNAL_SECRET', '')

    payload = json.dumps({
        'legacy_user_id': legacy_user_id,
        'email': email,
        'username': username,
        'password_hash': password_hash,
        'full_name': full_name,
        'role': role,
        'is_active': is_active,
    }).encode()

    req = urllib.request.Request(
        f'{central_auth_url}/api/internal/sms-student',
        data=payload,
        headers={'Content-Type': 'application/json', 'X-Internal-Secret': secret},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = resp.read().decode()
            print(f"[CENTRAL-AUTH-SYNC] {email} -> {body}")
            return True, body
    except urllib.error.HTTPError as e:
        msg = f"HTTP {e.code}: {e.read().decode()[:200]}"
        print(f"[CENTRAL-AUTH-SYNC] Warning: {msg}")
        return False, msg
    except Exception as e:
        print(f"[CENTRAL-AUTH-SYNC] Could not reach central auth: {e}")
        return False, str(e)


def sync_student_entity_to_central_auth(user, student):
    """Convenience wrapper for the legacy-branch case: a local users.User
    (created/found by _ensure_student_user_account) plus its Student
    entity. Extracts fields and delegates to sync_student_to_central_auth()
    — the student equivalent of staff's sync_staff_entity_to_central_auth.
    """
    return sync_student_to_central_auth(
        legacy_user_id=user.id,
        email=user.email,
        username=user.username,
        password_hash=user.password,
        full_name=student.full_name or user.username,
        role='student',
        is_active=getattr(user, 'is_active', True),
    )
