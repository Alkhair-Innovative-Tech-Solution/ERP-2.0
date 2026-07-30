"""
DRF authentication backend for central-auth-issued JWTs.

Verifies the RS256 signature locally against the auth-service's public key
(fetched once via JWKS, cached — see jwks.py). No per-request network call.
request.user is built entirely from the token's own claims; there is no
"/me" round trip and no fallback path — an unverifiable token is rejected.

Reusable template: this file plus jwks.py and permissions.py are the whole
auth-glue surface. To onboard another service, copy all three unchanged and
point AUTH_SERVICE_URL at the same auth-service.

Ticket-service-specific note (framework adapter, not a template change):
this service uses Django Ninja, not DRF, for its routers. Ninja's
`Router(auth=...)` expects a plain callable(request) -> auth_value|None,
not DRF's `authenticate(self, request) -> (user, token)|None` convention.
The `__call__` method below is the adapter — it wraps `authenticate()`
unchanged and follows the exact same pattern already used in this codebase
by `hdms_core.authentication.RemoteJWTAuthentication.__call__`. The
verification logic itself (JWKS fetch, signature check, claims parsing) is
byte-identical to VMS's copy.
"""
import jwt
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .jwks import JWKSUnavailable, get_signing_key

ALGORITHM = 'RS256'


class CentralAuthUser:
    """
    Lightweight user object built from verified token claims.
    Read-only view of the token — no DB lookups, no /me call.
    """

    def __init__(self, claims: dict):
        self.claims = claims
        self.id = claims.get('user_id')
        self.employee_id = claims.get('employee_id', '')
        self.employee_code = claims.get('employee_code') or claims.get('code', '')
        self.full_name = claims.get('full_name', '')
        self.email = claims.get('email', '')
        self.is_superadmin = bool(claims.get('is_superadmin', False))
        self.is_active = claims.get('is_active', True)
        self.tenant_id = claims.get('tenant_id')
        self.services = claims.get('services') or []
        self.perms = claims.get('perms') or []
        self.perm_version = claims.get('perm_version')
        self.vms_role = claims.get('role')
        self.is_authenticated = True

    def has_service(self, service_code: str) -> bool:
        return self.is_superadmin or service_code in self.services

    def has_perm(self, codename: str) -> bool:
        return self.is_superadmin or '*' in self.perms or codename in self.perms

    def __str__(self):
        return self.full_name or self.employee_code


class CentralAuthAuthentication(BaseAuthentication):
    """
    Authenticates requests bearing a central-auth-issued RS256 JWT.

    No fallback: if the token is missing, malformed, expired, or fails
    signature verification, the request is rejected. There is no local
    token-issuance path in this service — login always happens at
    auth-service, so any token reaching here must be verifiable against
    its JWKS key.
    """

    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return None

        token = auth_header.split(' ', 1)[1]

        try:
            header = jwt.get_unverified_header(token)
        except jwt.InvalidTokenError as exc:
            raise AuthenticationFailed('Malformed token.') from exc

        try:
            public_key = get_signing_key(header.get('kid'))
        except JWKSUnavailable as exc:
            raise AuthenticationFailed(
                'Cannot verify token: auth-service signing key unavailable.'
            ) from exc

        try:
            claims = jwt.decode(token, key=public_key, algorithms=[ALGORITHM])
        except jwt.ExpiredSignatureError as exc:
            raise AuthenticationFailed('Token has expired.') from exc
        except jwt.InvalidTokenError as exc:
            raise AuthenticationFailed('Invalid token.') from exc

        if claims.get('token_type') != 'access':
            raise AuthenticationFailed('Not an access token.')

        return CentralAuthUser(claims), token

    def __call__(self, request):
        """
        Ninja compatibility adapter: Ninja's Router(auth=...) expects a
        callable(request) returning the auth value (or None/raising for
        failure), not DRF's authenticate() tuple convention. Mirrors
        hdms_core.authentication.RemoteJWTAuthentication.__call__.
        """
        from ninja.errors import HttpError

        try:
            auth_result = self.authenticate(request)
        except AuthenticationFailed as exc:
            raise HttpError(401, str(exc))

        if auth_result is None:
            raise HttpError(401, 'Authentication credentials were not provided.')

        user, token = auth_result
        request.user = user
        return user
