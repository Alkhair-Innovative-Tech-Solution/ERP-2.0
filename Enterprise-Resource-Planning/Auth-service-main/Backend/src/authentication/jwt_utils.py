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
