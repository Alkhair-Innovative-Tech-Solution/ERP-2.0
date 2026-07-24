"""
VmsHybridAuthentication — DRF authentication class that handles two token types:

1. Auth-Service JWT (has 'employee_code' claim):
   Validated via auth-service /api/auth/me (Redis-cached 5 min).

2. Local fallback Simple JWT (no 'employee_code' claim):
   Validated locally — issued only when auth-service is unreachable at login.

Returns a request.user compatible object in both cases.
"""
import jwt
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth.models import AnonymousUser
from .auth_service_client import verify_token, AuthServiceUnavailable


class AuthServiceUser:
    """
    Lightweight user object built from auth-service /me response.
    Fulfills the interface that DRF permission classes expect.
    """
    def __init__(self, data: dict):
        self.id = data.get('id')
        self.employee_id = data.get('employee_id', '')
        self.employee_code = data.get('employee_code') or data.get('code', '')
        self.full_name = data.get('full_name', '')
        self.email = data.get('email', '')
        self.department = data.get('department', '')
        self.vms_role = data.get('role', None)  # populated from JWT claim via generate_access_token
        self.is_authenticated = True
        self.is_active = data.get('is_active', True)
        self._raw = data

    def __str__(self):
        return self.full_name or self.employee_code


class LocalFallbackUser:
    """
    Minimal user wrapper for local Simple JWT fallback tokens.
    Wraps Django's built-in User object.
    """
    def __init__(self, django_user):
        self._user = django_user
        self.id = str(django_user.id)
        self.employee_code = None
        self.full_name = django_user.get_full_name() or django_user.username
        self.email = django_user.email
        self.vms_role = _get_local_role(django_user)
        self.is_authenticated = True
        self.is_active = django_user.is_active
        self.is_staff = django_user.is_staff

    def __str__(self):
        return self.full_name


def _get_local_role(user) -> str:
    """Derive VMS role from Django user groups for local fallback users."""
    groups = set(user.groups.values_list('name', flat=True))
    if 'admin' in groups or user.is_staff:
        return 'admin'
    if 'receptionist' in groups:
        return 'receptionist'
    if 'security_staff' in groups:
        return 'security_staff'
    return 'receptionist'  # safe default


def _is_auth_service_token(token: str) -> bool:
    """
    Check if token is from auth-service by peeking at unverified claims.
    Auth-service tokens include 'employee_code'; local Simple JWT tokens do not.
    """
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        return bool(payload.get('employee_code'))
    except Exception:
        return False


class VmsHybridAuthentication(BaseAuthentication):
    """
    Authenticate requests using either auth-service JWTs or local fallback JWTs.
    """

    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return None

        token = auth_header.split(' ', 1)[1]

        if _is_auth_service_token(token):
            return self._authenticate_auth_service_token(token)
        else:
            return self._authenticate_local_token(token)

    def _authenticate_auth_service_token(self, token: str):
        """Validate via auth-service /me (Redis cached)."""
        try:
            user_data = verify_token(token)
        except AuthServiceUnavailable:
            raise AuthenticationFailed(
                "Auth Service is currently unavailable. Please try again later.",
                code='auth_service_unavailable'
            )

        if user_data is None:
            raise AuthenticationFailed("Invalid or expired token.")

        return AuthServiceUser(user_data), token

    def _authenticate_local_token(self, token: str):
        """Validate using Simple JWT locally (fallback path)."""
        from rest_framework_simplejwt.authentication import JWTAuthentication
        from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

        jwt_auth = JWTAuthentication()
        try:
            validated_token = jwt_auth.get_validated_token(token)
            django_user = jwt_auth.get_user(validated_token)
            return LocalFallbackUser(django_user), token
        except (InvalidToken, TokenError):
            raise AuthenticationFailed("Invalid or expired token.")
