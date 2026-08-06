"""
JWT token utilities for authentication.

Handles:
- Access token generation (1 hour expiry) — signs with RSA private key (RS256)
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
    """Load RSA key from file path set in env var. Fail fast if missing."""
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

    Identity claims: user_id, code, full_name, email, is_superadmin, is_active,
                      exp, iat, token_type, sub, jti, employee_code, employee_id
    Multi-tenant/authorization claims: tenant_id, services, perms, perm_version
      - tenant_id: the employee's tenant (null for superadmin — not tenant-scoped)
      - services: service codes the tenant has an ACTIVE subscription for
                  (superadmin gets every active service — bypasses the gate anyway)
      - perms: effective global permission codenames (["*"] sentinel for superadmin)
      - perm_version: monotonic counter — downstream services use it to detect a
                      token minted before a permission change (see permissions.rbac)

    HR fields (department/designation) are deliberately NOT included — this token
    is an auth/authorization artifact, not an HR profile. Consumers needing HR data
    should call the employees API.
    """
    is_superadmin = getattr(user, 'is_superadmin', False)
    principal_type = _detect_principal_type(user)

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

    # Existing employee/superadmin detection — kept exactly as-is (untouched
    # by the fix below, so an employee token's claim set is byte-identical).
    if hasattr(user, 'employee_code'):
        payload.update({
            'employee_code': user.employee_code,
            'employee_id': getattr(user, 'employee_id', None),
        })
    elif principal_type == 'non_staff':
        # Mirrors the employee_code/employee_id block above, minus the
        # employee-only fields — a student (NonStaffIdentity) has no
        # employee_code/employee_id, only identity_code/person_type.
        payload.update({
            'identity_code': getattr(user, 'identity_code', None),
            'person_type': getattr(user, 'person_type', None),
        })

    payload.update(_build_authz_claims(user, is_superadmin, principal_type))

    payload.update(kwargs)
    return jwt.encode(payload, JWT_PRIVATE_KEY, algorithm=JWT_ALGORITHM)


def _detect_principal_type(user) -> str:
    """Robust principal-type detection for permissions.rbac's
    get_effective_permissions()/get_perm_version() — isinstance-based, not
    `hasattr(user, 'employee_code')` (which a NonStaffIdentity trivially
    fails, since it has no such attribute at all, silently defaulting every
    student token to principal_type='employee' and resolving ZERO
    permissions regardless of what's actually assigned — the bug found in
    Phase C4, see docs/FIX_JWT_NONSTAFF_PERMS_RESULT.md).

    Only 'non_staff' vs 'employee' — get_effective_permissions has no
    'superadmin' principal_type (superadmins bypass it entirely, see
    _build_authz_claims's is_superadmin branch below, unaffected either way).
    """
    from authentication.nonstaff_models import NonStaffIdentity
    return 'non_staff' if isinstance(user, NonStaffIdentity) else 'employee'


def _build_authz_claims(user, is_superadmin: bool, principal_type: str = 'employee') -> dict:
    """tenant_id / services / perms / perm_version claims.
    Imported lazily to avoid a circular import at Django app-loading time
    (permissions.rbac already imports authentication.superadmin_models).

    principal_type routes get_effective_permissions()/get_perm_version() to
    the right principal — 'employee' (default, unchanged) or 'non_staff'.
    Passing the explicit default for an Employee caller is a no-op (identical
    to the old no-argument call), so employee token output is unaffected."""
    from django.db.models import Q
    from django.utils import timezone
    from permissions.models import Service, Subscription
    from permissions.rbac import get_effective_permissions, get_perm_version

    if is_superadmin:
        return {
            'tenant_id': None,
            'services': list(Service.objects.filter(is_active=True).values_list('code', flat=True)),
            'perms': ['*'],
            'perm_version': 0,
        }

    tenant_id = getattr(user, 'tenant_id', None)
    services = []
    if tenant_id:
        now = timezone.now()
        services = list(
            Subscription.objects.filter(tenant_id=tenant_id, status='active', is_deleted=False)
            .filter(Q(ends_at__isnull=True) | Q(ends_at__gte=now))
            .values_list('service__code', flat=True)
        )

    return {
        'tenant_id': str(tenant_id) if tenant_id else None,
        'services': services,
        'perms': sorted(get_effective_permissions(str(user.id), principal_type=principal_type)),
        'perm_version': get_perm_version(str(user.id), principal_type=principal_type),
    }


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
