# RS256 JWT Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate JWT signing from HS256 (shared secret) to RS256 (asymmetric key pair) so Auth-service holds the private key and all consumer services (HDMS ticket/file/communication) verify using the public key only.

**Architecture:** Auth-service generates tokens using an RSA-4096 private key stored as a PEM file on the Auth-service host. HDMS services read a separate public key PEM file for verification only — they never see the private key. Key file paths are injected via `.env`. `jwt_utils.py` in Auth-service loads the private key at startup; HDMS `SIMPLE_JWT` settings load the public key at startup.

**Tech Stack:** PyJWT (`jwt` package, already installed), `cryptography` (RSA key generation), `rest_framework_simplejwt` (HDMS), Python `pathlib`

---

## File Map

| File | Change |
|---|---|
| `Auth-service/Backend/src/authentication/jwt_utils.py` | Load private key from file path; switch to RS256 |
| `Auth-service/Backend/src/core/settings.py` | Add `JWT_PRIVATE_KEY_PATH`, `JWT_ALGORITHM` env vars; remove hardcoded `HS256` |
| `Auth-service/Backend/src/employees/tests_api_hardening.py` | Add RS256 token roundtrip test |
| `HDMS/services/ticket-service/src/core/settings/base.py` | Load public key from file; set `VERIFYING_KEY`; `ALGORITHM=RS256` |
| `HDMS/services/file-service/src/core/settings/base.py` | Same as ticket-service |
| `HDMS/services/communication-service/src/core/settings/base.py` | Same as ticket-service |
| `erp_new/.env` | Add `JWT_ALGORITHM`, `JWT_PRIVATE_KEY_PATH`, `JWT_PUBLIC_KEY_PATH` |
| `Auth-service/docs/jwt-key-management.md` | Key generation, rotation, deployment guide |

---

## Task 1: Generate RSA-4096 Key Pair

**Files:**
- Create: `/home/ubaid/Desktop/AIT-Work/erp_new/config/jwt_private.pem` (outside all repos)
- Create: `/home/ubaid/Desktop/AIT-Work/erp_new/config/jwt_public.pem`

- [ ] **Step 1.1: Create config directory**

```bash
mkdir -p /home/ubaid/Desktop/AIT-Work/erp_new/config
```

- [ ] **Step 1.2: Generate RSA-4096 private key**

```bash
openssl genrsa -out /home/ubaid/Desktop/AIT-Work/erp_new/config/jwt_private.pem 4096
```

Expected: file created, ~3.2KB, starts with `-----BEGIN RSA PRIVATE KEY-----`

- [ ] **Step 1.3: Extract public key**

```bash
openssl rsa -in /home/ubaid/Desktop/AIT-Work/erp_new/config/jwt_private.pem \
  -pubout -out /home/ubaid/Desktop/AIT-Work/erp_new/config/jwt_public.pem
```

Expected: file created, starts with `-----BEGIN PUBLIC KEY-----`

- [ ] **Step 1.4: Restrict private key permissions**

```bash
chmod 600 /home/ubaid/Desktop/AIT-Work/erp_new/config/jwt_private.pem
chmod 644 /home/ubaid/Desktop/AIT-Work/erp_new/config/jwt_public.pem
```

- [ ] **Step 1.5: Add config/ to .gitignore (CRITICAL — never commit private key)**

```bash
echo "config/jwt_private.pem" >> /home/ubaid/Desktop/AIT-Work/erp_new/.gitignore
echo "config/jwt_public.pem" >> /home/ubaid/Desktop/AIT-Work/erp_new/.gitignore
```

Check `.gitignore` exists at `erp_new/` level:
```bash
cat /home/ubaid/Desktop/AIT-Work/erp_new/.gitignore
```

- [ ] **Step 1.6: Verify keys are readable**

```bash
python3 -c "
import jwt
private = open('/home/ubaid/Desktop/AIT-Work/erp_new/config/jwt_private.pem').read()
public = open('/home/ubaid/Desktop/AIT-Work/erp_new/config/jwt_public.pem').read()
token = jwt.encode({'test': 'ok'}, private, algorithm='RS256')
payload = jwt.decode(token, public, algorithms=['RS256'])
print('RS256 roundtrip OK:', payload)
"
```

Expected: `RS256 roundtrip OK: {'test': 'ok'}`

---

## Task 2: Update `.env` with Key Paths

**Files:**
- Modify: `/home/ubaid/Desktop/AIT-Work/erp_new/.env`

- [ ] **Step 2.1: Add JWT config block to `.env`**

Open `/home/ubaid/Desktop/AIT-Work/erp_new/.env` and add this block (after existing JWT entries or at end):

```bash
# JWT RS256 Configuration
# Auth-service signs with private key; consumer services verify with public key only.
# Key files generated with: openssl genrsa -out jwt_private.pem 4096
# See: Auth-service/docs/jwt-key-management.md
JWT_ALGORITHM=RS256
JWT_PRIVATE_KEY_PATH=/home/ubaid/Desktop/AIT-Work/erp_new/config/jwt_private.pem
JWT_PUBLIC_KEY_PATH=/home/ubaid/Desktop/AIT-Work/erp_new/config/jwt_public.pem
```

> **Note for production/staging:** Change paths to absolute server paths (e.g. `/etc/erp/jwt_private.pem`). Copy key files to server manually — never via git.

---

## Task 3: Update Auth-Service `jwt_utils.py`

**Files:**
- Modify: `Auth-service/Backend/src/authentication/jwt_utils.py`

- [ ] **Step 3.1: Write failing test first**

Add to `Auth-service/Backend/src/employees/tests_api_hardening.py`:

```python
class TestRS256JWTRoundtrip:
    """JWT tokens must be signed with RS256 and verifiable with public key."""

    def test_access_token_uses_rs256_algorithm(self):
        import jwt as pyjwt
        from authentication.jwt_utils import generate_access_token, JWT_PUBLIC_KEY, JWT_ALGORITHM
        from employees.models import Employee, Organization
        # Use a mock-like object — no DB needed for token generation
        class FakeEmployee:
            id = "00000000-0000-0000-0000-000000000001"
            employee_code = "TEST-0001"
            employee_id = "IAK-0001"
            full_name = "Test User"
            org_email = "test@test.com"
            personal_email = None
            is_active = True
            is_superadmin = False
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
        from authentication.jwt_utils import generate_access_token, JWT_ALGORITHM

        class FakeEmployee:
            id = "00000000-0000-0000-0000-000000000002"
            employee_code = "TEST-0002"
            employee_id = "IAK-0002"
            full_name = "Fake"
            org_email = None
            personal_email = "fake@test.com"
            is_active = True
            is_superadmin = False
            department = None
            designation = None
            @property
            def email(self): return self.personal_email or ""

        token = generate_access_token(FakeEmployee())
        # Try to decode with a wrong public key — must fail
        import subprocess
        result = subprocess.run(
            ['openssl', 'genrsa', '2048'],
            capture_output=True, text=True
        )
        wrong_private = result.stdout
        wrong_pub_result = subprocess.run(
            ['openssl', 'rsa', '-pubout'],
            input=wrong_private, capture_output=True, text=True
        )
        wrong_public = wrong_pub_result.stdout
        with pytest.raises(pyjwt.InvalidSignatureError):
            pyjwt.decode(token, wrong_public, algorithms=['RS256'])
```

- [ ] **Step 3.2: Run test — verify it fails**

```bash
docker exec -u root \
  -e AUTH_DATABASE_URL=postgresql://erp_admin:erp_admin_password_change_me_in_prod@erp_postgres:5432/auth_db \
  auth_service \
  sh -c "cd /app && pytest employees/tests_api_hardening.py::TestRS256JWTRoundtrip -v 2>&1 | tail -15"
```

Expected: FAIL — `ImportError: cannot import name 'JWT_PUBLIC_KEY'` or `AssertionError: Expected RS256, got HS256`

- [ ] **Step 3.3: Rewrite `jwt_utils.py`**

Replace the full content of `Auth-service/Backend/src/authentication/jwt_utils.py` with:

```python
"""
JWT token utilities for authentication.

Handles:
- Access token generation (1 hour expiry) — signs with RSA private key
- Refresh token generation (7 days expiry)
- Token validation and decoding — verifies with RSA public key

Key management:
  JWT_PRIVATE_KEY_PATH — path to PEM file, Auth-service only
  JWT_PUBLIC_KEY_PATH  — path to PEM file, all consumer services
  See: docs/jwt-key-management.md
"""
import jwt
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from decouple import config


JWT_ALGORITHM = config('JWT_ALGORITHM', default='RS256')
ACCESS_TOKEN_EXPIRY = timedelta(hours=1)
REFRESH_TOKEN_EXPIRY = timedelta(days=7)


def _load_key(env_var: str) -> str:
    path = config(env_var, default='')
    if not path:
        raise ValueError(f"{env_var} not set in environment")
    key_path = Path(path)
    if not key_path.exists():
        raise FileNotFoundError(f"JWT key file not found: {key_path}")
    return key_path.read_text()


# Load keys once at module import — fail fast if misconfigured
JWT_PRIVATE_KEY = _load_key('JWT_PRIVATE_KEY_PATH')
JWT_PUBLIC_KEY = _load_key('JWT_PUBLIC_KEY_PATH')


def generate_access_token(user, **kwargs) -> str:
    """
    Generate JWT access token signed with RSA private key.

    Token claims: user_id, code, full_name, email, is_superadmin,
                  is_active, exp, iat, token_type, sub, jti
    """
    is_superadmin = getattr(user, 'is_superadmin', False)

    payload = {
        'user_id': str(user.id),
        'code': getattr(user, 'superadmin_code', None) or getattr(user, 'employee_code', None),
        'full_name': user.full_name,
        'email': user.email,
        'is_superadmin': is_superadmin,
        'is_active': user.is_active,
        'exp': datetime.utcnow() + ACCESS_TOKEN_EXPIRY,
        'iat': datetime.utcnow(),
        'token_type': 'access',
        'sub': str(user.id),
        'jti': str(uuid.uuid4()),
    }

    if hasattr(user, 'employee_code'):
        dept = getattr(user, 'department', None)
        pos = getattr(user, 'designation', None)
        payload.update({
            'employee_code': user.employee_code,
            'employee_id': getattr(user, 'employee_id', None),
            'department_id': str(dept.id) if dept else None,
            'department_name': dept.dept_name if dept else 'N/A',
            'designation': pos.position_name if pos else 'N/A',
        })

    payload.update(kwargs)
    return jwt.encode(payload, JWT_PRIVATE_KEY, algorithm=JWT_ALGORITHM)


def generate_refresh_token(user) -> str:
    """Generate JWT refresh token signed with RSA private key."""
    payload = {
        'user_id': str(user.id),
        'code': getattr(user, 'superadmin_code', None) or getattr(user, 'employee_code', None),
        'exp': datetime.utcnow() + REFRESH_TOKEN_EXPIRY,
        'iat': datetime.utcnow(),
        'token_type': 'refresh',
        'jti': str(uuid.uuid4()),
    }
    return jwt.encode(payload, JWT_PRIVATE_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and verify JWT token using RSA public key."""
    try:
        return jwt.decode(token, JWT_PUBLIC_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise ValueError("Token has expired")
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Invalid token: {e}")


def verify_access_token(token: str):
    """Verify access token. Returns (user_id, is_superadmin) or None."""
    try:
        payload = decode_token(token)
        if payload.get('token_type') != 'access':
            return None
        return payload.get('user_id'), payload.get('is_superadmin', False)
    except Exception:
        return None


def verify_refresh_token(token: str):
    """Verify refresh token. Returns (user_id, is_superadmin) or None."""
    try:
        payload = decode_token(token)
        if payload.get('token_type') != 'refresh':
            return None
        return payload.get('user_id'), payload.get('is_superadmin', False)
    except Exception:
        return None


def get_token_expiry(token: str):
    """Get expiry datetime from token."""
    try:
        payload = decode_token(token)
        exp = payload.get('exp')
        return datetime.fromtimestamp(exp) if exp else None
    except Exception:
        return None
```

- [ ] **Step 3.4: Update `settings.py` — remove `JWT_SECRET`, add key path config**

In `Auth-service/Backend/src/core/settings.py`, replace lines 20-22:
```python
# JWT Configuration
JWT_SECRET = os.getenv('JWT_SECRET', SECRET_KEY)
JWT_ALGORITHM = 'HS256'
```

With:
```python
# JWT Configuration — RS256 asymmetric signing
# jwt_utils.py loads key files directly from env vars JWT_PRIVATE_KEY_PATH / JWT_PUBLIC_KEY_PATH
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'RS256')
```

- [ ] **Step 3.5: Run tests inside container**

Copy key files into running container so jwt_utils.py can load them:
```bash
docker cp /home/ubaid/Desktop/AIT-Work/erp_new/config/jwt_private.pem auth_service:/tmp/jwt_private.pem
docker cp /home/ubaid/Desktop/AIT-Work/erp_new/config/jwt_public.pem auth_service:/tmp/jwt_public.pem
```

Run tests:
```bash
docker exec -u root \
  -e AUTH_DATABASE_URL=postgresql://erp_admin:erp_admin_password_change_me_in_prod@erp_postgres:5432/auth_db \
  -e JWT_PRIVATE_KEY_PATH=/tmp/jwt_private.pem \
  -e JWT_PUBLIC_KEY_PATH=/tmp/jwt_public.pem \
  -e JWT_ALGORITHM=RS256 \
  auth_service \
  sh -c "cd /app && pytest employees/tests_api_hardening.py -v 2>&1 | tail -15"
```

Expected: ALL 10 tests PASS

- [ ] **Step 3.6: Commit Auth-service changes**

```bash
cd /home/ubaid/Desktop/AIT-Work/erp_new/Auth-service
git add \
  Backend/src/authentication/jwt_utils.py \
  Backend/src/core/settings.py \
  Backend/src/employees/tests_api_hardening.py
git commit -m "feat(auth): migrate JWT signing to RS256 asymmetric keys

- jwt_utils.py loads RSA private key (signing) and public key (verification)
  from paths set in JWT_PRIVATE_KEY_PATH / JWT_PUBLIC_KEY_PATH env vars
- Algorithm now RS256 (was HS256) — consumer services only need public key
- Removed JWT_SECRET / hardcoded HS256
- Tests: RS256 roundtrip passes, wrong-key rejection verified

See docs/jwt-key-management.md for key generation + rotation procedure."
```

---

## Task 4: Update HDMS 3 Services

**Files:**
- Modify: `HDMS/services/ticket-service/src/core/settings/base.py`
- Modify: `HDMS/services/file-service/src/core/settings/base.py`
- Modify: `HDMS/services/communication-service/src/core/settings/base.py`

All 3 files have identical `SIMPLE_JWT` blocks. Same change in all 3.

- [ ] **Step 4.1: Update ticket-service `SIMPLE_JWT`**

In `HDMS/services/ticket-service/src/core/settings/base.py`, replace:

```python
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=config('ACCESS_TOKEN_LIFETIME', default=60, cast=int)),
    'REFRESH_TOKEN_LIFETIME': timedelta(minutes=config('REFRESH_TOKEN_LIFETIME', default=1440, cast=int)),
    'ALGORITHM': config('JWT_ALGORITHM', default='HS256'),
    'SIGNING_KEY': config('JWT_SECRET_KEY', default=SECRET_KEY),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}
```

With:

```python
def _load_jwt_public_key() -> str:
    """Load RSA public key for JWT verification. Fail fast if misconfigured."""
    import os
    from pathlib import Path
    path = os.getenv('JWT_PUBLIC_KEY_PATH', '')
    if not path:
        raise ValueError("JWT_PUBLIC_KEY_PATH not set — required for RS256 token verification")
    key_path = Path(path)
    if not key_path.exists():
        raise FileNotFoundError(f"JWT public key not found: {key_path}")
    return key_path.read_text()


SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=config('ACCESS_TOKEN_LIFETIME', default=60, cast=int)),
    'REFRESH_TOKEN_LIFETIME': timedelta(minutes=config('REFRESH_TOKEN_LIFETIME', default=1440, cast=int)),
    'ALGORITHM': config('JWT_ALGORITHM', default='RS256'),
    'SIGNING_KEY': None,        # This service never signs tokens
    'VERIFYING_KEY': _load_jwt_public_key(),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}
```

- [ ] **Step 4.2: Update file-service `SIMPLE_JWT`**

In `HDMS/services/file-service/src/core/settings/base.py`, make the same replacement as Step 4.1 (identical change).

- [ ] **Step 4.3: Update communication-service `SIMPLE_JWT`**

In `HDMS/services/communication-service/src/core/settings/base.py`, make the same replacement as Step 4.1 (identical change).

- [ ] **Step 4.4: Verify HDMS containers can load the key**

Copy public key into HDMS containers:
```bash
docker cp /home/ubaid/Desktop/AIT-Work/erp_new/config/jwt_public.pem hdms_ticket_service:/tmp/jwt_public.pem
docker cp /home/ubaid/Desktop/AIT-Work/erp_new/config/jwt_public.pem hdms_file_service:/tmp/jwt_public.pem
docker cp /home/ubaid/Desktop/AIT-Work/erp_new/config/jwt_public.pem hdms_comms_service:/tmp/jwt_public.pem
```

Check container names:
```bash
docker ps --format "{{.Names}}" | grep hdms
```

Adjust names above to match actual container names. Then test public key loads:
```bash
docker exec -e JWT_PUBLIC_KEY_PATH=/tmp/jwt_public.pem -e JWT_ALGORITHM=RS256 hdms_ticket_service \
  python -c "
import os; os.environ['JWT_PUBLIC_KEY_PATH']='/tmp/jwt_public.pem'
from django.conf import settings
print('VERIFYING_KEY loaded, length:', len(settings.SIMPLE_JWT['VERIFYING_KEY']))
print('ALGORITHM:', settings.SIMPLE_JWT['ALGORITHM'])
"
```

Expected: `VERIFYING_KEY loaded, length: <number>` and `ALGORITHM: RS256`

- [ ] **Step 4.5: Commit HDMS changes**

```bash
cd /home/ubaid/Desktop/AIT-Work/erp_new/HDMS
git add \
  services/ticket-service/src/core/settings/base.py \
  services/file-service/src/core/settings/base.py \
  services/communication-service/src/core/settings/base.py
git commit -m "feat(auth): migrate JWT verification to RS256 public key

All 3 HDMS services (ticket/file/communication):
- Load RSA public key from JWT_PUBLIC_KEY_PATH env var
- VERIFYING_KEY set to public key PEM content
- SIGNING_KEY=None (these services never issue tokens)
- ALGORITHM=RS256 (from JWT_ALGORITHM env var, default RS256)

Auth-service holds the private key only. HDMS never sees it."
```

---

## Task 5: End-to-End Integration Test

- [ ] **Step 5.1: Restart Auth-service container with new env vars**

**Warning:** This restarts the running Auth-service. Existing HS256 tokens will be immediately invalid — any logged-in user will be logged out.

```bash
cd /home/ubaid/Desktop/AIT-Work/erp_new/Auth-service
docker compose down auth-service
docker compose up -d auth-service
```

Check startup logs — look for errors loading key files:
```bash
docker logs auth_service 2>&1 | grep -E "Error|error|Exception|KEY|key" | head -10
```

Expected: no errors about key files.

- [ ] **Step 5.2: Login and capture token**

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"employee_code": "AIT01-G-26-T-0001", "password": "12345"}' \
  | python3 -m json.tool | grep access_token | cut -d'"' -f4)
echo "Token: ${TOKEN:0:50}..."
```

- [ ] **Step 5.3: Decode token header — verify RS256**

```bash
echo $TOKEN | cut -d'.' -f1 | python3 -c "
import sys, base64, json
h = sys.stdin.read().strip()
padded = h + '=' * (4 - len(h) % 4)
print(json.loads(base64.b64decode(padded)))
"
```

Expected: `{'alg': 'RS256', 'typ': 'JWT'}`

- [ ] **Step 5.4: Call Auth-service API with token**

```bash
curl -s http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -10
```

Expected: 200 with user data.

- [ ] **Step 5.5: Test Auth-service full test suite**

```bash
docker exec -u root \
  -e AUTH_DATABASE_URL=postgresql://erp_admin:erp_admin_password_change_me_in_prod@erp_postgres:5432/auth_db \
  auth_service \
  sh -c "cd /app && pytest employees/tests_api_hardening.py -v 2>&1 | tail -10"
```

Expected: 10/10 PASS

---

## Task 6: Write Documentation

**Files:**
- Create: `Auth-service/docs/jwt-key-management.md`

- [ ] **Step 6.1: Create documentation file**

Create `Auth-service/docs/jwt-key-management.md` with this content:

```markdown
# JWT Key Management

Auth-service uses RS256 (RSA asymmetric) JWT signing.

## Algorithm

| | Value |
|---|---|
| Algorithm | RS256 |
| Key size | RSA-4096 |
| Access token lifetime | 1 hour |
| Refresh token lifetime | 7 days |

## Key Files

| File | Who reads it | Purpose |
|---|---|---|
| `jwt_private.pem` | Auth-service ONLY | Signing new tokens |
| `jwt_public.pem` | Auth-service + all HDMS services | Verifying token signatures |

**NEVER commit key files to git.**
**NEVER share the private key with HDMS or any consumer service.**

## Generating Keys (First Time or Rotation)

```bash
# Generate 4096-bit RSA private key
openssl genrsa -out jwt_private.pem 4096

# Extract public key
openssl rsa -in jwt_private.pem -pubout -out jwt_public.pem

# Restrict permissions
chmod 600 jwt_private.pem
chmod 644 jwt_public.pem
```

## Environment Variables

```bash
JWT_ALGORITHM=RS256
JWT_PRIVATE_KEY_PATH=/path/to/jwt_private.pem   # Auth-service only
JWT_PUBLIC_KEY_PATH=/path/to/jwt_public.pem     # All services
```

Current dev paths: `erp_new/config/jwt_private.pem` and `erp_new/config/jwt_public.pem`

For production: copy to `/etc/erp/jwt_private.pem` (Auth-service host only) and `/etc/erp/jwt_public.pem` (all hosts).

## Key Rotation Procedure

> **Warning:** Rotating the private key invalidates ALL existing tokens. All users across all services will be logged out simultaneously.

1. Generate new key pair (new files)
2. Update `JWT_PRIVATE_KEY_PATH` on Auth-service host → new private key
3. Update `JWT_PUBLIC_KEY_PATH` on ALL service hosts → new public key
4. Restart Auth-service first
5. Restart HDMS services
6. Verify login works
7. Delete old key files

## Services Using This Key

| Service | Reads | Usage |
|---|---|---|
| Auth-service | Private + Public | Signs tokens, verifies own tokens |
| HDMS ticket-service | Public only | Verifies incoming tokens |
| HDMS file-service | Public only | Verifies incoming tokens |
| HDMS communication-service | Public only | Verifies incoming tokens |
```

- [ ] **Step 6.2: Commit documentation**

```bash
cd /home/ubaid/Desktop/AIT-Work/erp_new/Auth-service
git add docs/jwt-key-management.md docs/superpowers/plans/2026-04-25-rs256-jwt-migration.md
git commit -m "docs: JWT RS256 key management guide + migration plan

Covers: key generation, env vars, rotation procedure,
which services read private vs public key."
```

---

## Self-Review

- [x] Task 1: key generation with correct file permissions
- [x] Task 2: `.env` entries with inline comments explaining purpose
- [x] Task 3: full `jwt_utils.py` rewrite — no placeholders, fail-fast `_load_key()`
- [x] Task 4: all 3 HDMS services covered with identical `_load_jwt_public_key()` helper
- [x] Task 5: E2E test verifies token header `alg=RS256` explicitly
- [x] Task 6: docs cover rotation procedure (the non-obvious operational need)
- [x] No `JWT_SECRET_KEY` fallback left anywhere — fail-fast on misconfiguration
- [x] `SIGNING_KEY=None` in HDMS blocks accidental token issuance
- [x] `.gitignore` entry for private key in Task 1
