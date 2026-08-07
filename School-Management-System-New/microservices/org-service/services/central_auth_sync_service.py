"""
Phase D-b5: dual-write org-admin provisioning and org name/active-status to
central auth's SMS01 tenant, in addition to org-service's existing auth-8001
calls (untouched — auth-8001 is still what org-admins actually log into
until the retirement phase repoints them).

Mirrors staff-service's services/central_auth_sync_service.py (Phase B4)
and student-service's (Phase D-b2): same SYNC_TO_CENTRAL_AUTH env flag (one
switch now controls staff, student, AND org-admin/org sync), same
CENTRAL_AUTH_URL/SMS_INTERNAL_SECRET config, same "never raises" contract.

Org-admin provisioning reuses B4's existing POST /api/internal/sms-staff
(import_staff_records) with role='org_admin' — see
docs/PHASE_D_B5_ORG_PROVISIONING_RESULT.md for why this needed sentinel
cnic/dob/gender values (org-admin signup collects none of those) rather
than a bespoke endpoint. Org-sync is new: central auth's Organization model
had no way to idempotently match an org-service Organization at all (no
legacy_org_id-style field, unlike Employee/NonStaffIdentity) and no
is_active concept — both added additively this phase, receiving side at
POST /api/internal/sms-org-sync.
"""
import os
import json
import urllib.request
import urllib.error

# Employee model constraints (unique cnic, non-nullable dob, no "n/a" gender
# option) force placeholder values for data an org-admin signup never
# collects. Deliberately obvious placeholders, not real HR data — derived
# from the org-service User's own id, which is unique, so cnic stays unique
# across every org-admin. Flagged in the result doc as a real, if minor,
# gap: these Employee rows carry synthetic HR fields forever unless a later
# phase gives org-admin its own leaner central-auth shape.
def _placeholder_cnic(local_user_id: int) -> str:
    return f"00000-{local_user_id:07d}-0"


PLACEHOLDER_DOB = "1900-01-01"
PLACEHOLDER_GENDER = "other"


def sync_org_admin_to_central_auth(*, local_user_id, email, username, password_hash, full_name, is_active=True):
    """Provisions an org-admin as an Employee in central auth's SMS01
    tenant by reusing POST /api/internal/sms-staff (role='org_admin') — the
    exact same receiving endpoint/import function B4's staff sync uses.
    Returns (ok: bool, message: str). Never raises."""
    if os.getenv('SYNC_TO_CENTRAL_AUTH', 'false').lower() != 'true':
        return False, "disabled (SYNC_TO_CENTRAL_AUTH not set)"

    central_auth_url = os.getenv('CENTRAL_AUTH_URL', 'http://host.docker.internal:8000')
    secret = os.getenv('SMS_INTERNAL_SECRET', '')

    payload = json.dumps({
        'legacy_user_id': local_user_id,
        'email': email,
        'username': username,
        'role': 'org_admin',
        'password_hash': password_hash,
        'full_name': full_name,
        'cnic': _placeholder_cnic(local_user_id),
        'dob': PLACEHOLDER_DOB,
        'gender': PLACEHOLDER_GENDER,
        'is_active': is_active,
    }).encode()

    return _post(f'{central_auth_url}/api/internal/sms-staff', payload, secret, email)


def sync_org_to_central_auth(*, legacy_org_id, name=None, is_active=None):
    """Pushes org name/active-status to central auth via the new
    POST /api/internal/sms-org-sync (this phase). Fields are optional —
    only what changed needs to be sent; the receiver only updates fields
    that are present. Returns (ok: bool, message: str). Never raises."""
    if os.getenv('SYNC_TO_CENTRAL_AUTH', 'false').lower() != 'true':
        return False, "disabled (SYNC_TO_CENTRAL_AUTH not set)"

    central_auth_url = os.getenv('CENTRAL_AUTH_URL', 'http://host.docker.internal:8000')
    secret = os.getenv('SMS_INTERNAL_SECRET', '')

    body = {'legacy_org_id': legacy_org_id}
    if name is not None:
        body['name'] = name
    if is_active is not None:
        body['is_active'] = is_active
    payload = json.dumps(body).encode()

    return _post(f'{central_auth_url}/api/internal/sms-org-sync', payload, secret, f'org {legacy_org_id}')


def _post(url, payload, secret, label):
    req = urllib.request.Request(
        url, data=payload,
        headers={'Content-Type': 'application/json', 'X-Internal-Secret': secret},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = resp.read().decode()
            print(f"[CENTRAL-AUTH-SYNC] {label} -> {body}")
            return True, body
    except urllib.error.HTTPError as e:
        msg = f"HTTP {e.code}: {e.read().decode()[:200]}"
        print(f"[CENTRAL-AUTH-SYNC] Warning: {msg}")
        return False, msg
    except Exception as e:
        print(f"[CENTRAL-AUTH-SYNC] Could not reach central auth: {e}")
        return False, str(e)
