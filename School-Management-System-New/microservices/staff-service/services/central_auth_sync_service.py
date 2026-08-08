"""
Phase B4: dual-write staff creation to central auth (SMS01 tenant). Phase
D-R6: this is now the ONLY write path — auth-8001 (what this module's
docstring originally described as staying untouched) has been retired. See
docs/PHASE_D_R4R6_REMOVAL_RESULT.md.

Controlled by SYNC_TO_CENTRAL_AUTH env flag — no-ops entirely when unset/
false, so it's off by default and per-environment controllable without a
code change.

Every staff-creation entry point in staff-service (live signals via
UserCreationService, the sync_staff_to_auth batch command, and the CSV
importer) calls sync_staff_to_central_auth() — the one low-level function
that actually builds the payload and makes the HTTP call. Nothing about
the central-auth create logic is duplicated per call site; central auth's
own receiving endpoint (POST /api/internal/sms-staff) reuses the exact B1
import_staff_records() function too (see Auth-service-main/.../employees/
internal_api.py) — so the whole path, both sides, batch and live, is one
create implementation reached through different entry points, not several.
"""
import os
import json
import urllib.request
import urllib.error


def sync_staff_to_central_auth(*, legacy_user_id, email, username, role, password_hash,
                                 full_name, cnic, dob, gender, phone=None,
                                 joining_date=None, is_active=True):
    """Low-level: takes plain values matching central auth's
    SMS_STAFF_RECORD_FIELDS contract exactly (Phase B1). Both entity-based
    (live) and raw-SQL-based (batch) call sites build these values from
    their own data source, then call this ONE function — the HTTP/payload
    logic lives here exactly once.

    password_hash must be the ALREADY-HASHED value (e.g. user.password) —
    carried over verbatim, never re-hashed, same principle as B1.

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
        'role': role,
        'password_hash': password_hash,
        'full_name': full_name,
        'cnic': cnic,
        'dob': str(dob) if dob else None,
        'gender': gender or 'other',
        'phone': phone,
        'joining_date': str(joining_date) if joining_date else None,
        'is_active': is_active,
    }).encode()

    req = urllib.request.Request(
        f'{central_auth_url}/api/internal/sms-staff',
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


def sync_staff_entity_to_central_auth(user, entity, entity_type):
    """Convenience wrapper for the common case: a Django `users.User` +
    profile entity object (Teacher/Principal/Coordinator all have
    cnic/dob/gender/joining_date/contact_number). Extracts fields and
    delegates to sync_staff_to_central_auth()."""
    full_name = f"{user.first_name} {user.last_name}".strip() or user.username
    return sync_staff_to_central_auth(
        legacy_user_id=user.id,
        email=user.email,
        username=user.username,
        role=entity_type,
        password_hash=user.password,
        full_name=full_name,
        cnic=getattr(entity, 'cnic', None),
        dob=getattr(entity, 'dob', None),
        gender=getattr(entity, 'gender', None),
        phone=getattr(entity, 'contact_number', None),
        joining_date=getattr(entity, 'joining_date', None),
        is_active=getattr(user, 'is_active', True),
    )
