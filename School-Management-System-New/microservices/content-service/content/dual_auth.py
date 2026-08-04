"""
Phase C1: dual-run auth/permission glue for content-service.

NOT part of the reusable central_auth/ template (that stays byte-for-byte
copy-paste — see central_auth/*.py). This file is what's genuinely
service-specific about running two token schemes side by side during the
Phase C migration window: SMS's legacy shared-HS256 token
(ams_shared.jwt.validator.ServiceJWTAuthentication) and central auth's
RS256/JWKS token (central_auth.authentication.CentralAuthAuthentication).

Two real problems this solves, found while wiring C1 (documented in
docs/PHASE_C1_CONTENT_SERVICE_RESULT.md, "Recipe" section — every future
C2-C13 service on dual-run needs the equivalent of this file, even though
its CONTENTS will look nearly identical each time):

1. DRF authentication classes don't "fall through" on a mismatched scheme
   — both ServiceJWTAuthentication.authenticate() and
   CentralAuthAuthentication.authenticate() RAISE AuthenticationFailed
   (not return None) when handed a token signed for the other scheme.
   Registering both directly in DEFAULT_AUTHENTICATION_CLASSES would mean
   whichever runs second never gets a chance — the first one's exception
   short-circuits DRF's authentication chain entirely. DualAuthentication
   below inspects the JWT's own `alg` header first (unverified, cheap) and
   dispatches to the matching authenticator, so each one only ever sees
   tokens actually meant for it.

2. The shared `users.middleware.OrganizationMiddleware` (copied into all
   13 services via Dockerfile — NOT touched here, out of scope) always
   attempts ServiceJWTAuthentication itself, at the Django-middleware
   layer, before DRF's own authentication runs. For a central-auth
   (RS256) token it fails, is caught, and the middleware simply never
   populates its org/user contextvars for that request. Models using the
   default `OrganizationManager` (Module, Lesson, StudentContentProgress)
   read those same contextvars and return an EMPTY queryset when they're
   unset ("no user -> return none, very secure"). So central-auth-
   authenticated requests must not rely on `Model.objects` (the
   OrganizationManager-filtered default) — views.py uses `Model.all_objects`
   plus explicit tenant_id filtering for the CentralAuthUser branch
   instead. See views.py's get_queryset() methods.
"""
import jwt
from rest_framework.authentication import BaseAuthentication
from rest_framework.permissions import BasePermission

from ams_shared.jwt.validator import ServiceJWTAuthentication
from central_auth.authentication import CentralAuthAuthentication, CentralAuthUser


class DualAuthentication(BaseAuthentication):
    """Routes to CentralAuthAuthentication (RS256) or the legacy
    ServiceJWTAuthentication (HS256) based on the token's own `alg`
    header — never tries the wrong one, so dual-run tokens coexist
    without one scheme's rejection blocking the other."""

    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return None
        token = auth_header.split(' ', 1)[1]

        try:
            header = jwt.get_unverified_header(token)
        except jwt.InvalidTokenError:
            return None  # malformed — let the underlying authenticator report it normally on retry, or fall through to unauthenticated

        if header.get('alg') == 'RS256':
            return CentralAuthAuthentication().authenticate(request)
        return ServiceJWTAuthentication().authenticate(request)

    def authenticate_header(self, request):
        return 'Bearer'


class DualServiceSubscribed(BasePermission):
    """ServiceSubscribed, but only enforced for central-auth tokens.
    Legacy SMS tokens no-op here (True) — their own service already
    gates who reaches this app; this is a NEW gate that only applies to
    the new token type, not a replacement for the old one's checks."""
    message = 'Your organization does not have an active SMS subscription.'

    def has_permission(self, request, view):
        user = request.user
        if not isinstance(user, CentralAuthUser):
            return True
        return bool(user.is_authenticated and user.has_service('sms'))


def DualRequiresPermission(codename: str):
    """Same idea as central_auth.permissions.RequiresPermission, but
    no-ops (True) for legacy SMS tokens — those keep being gated by the
    view's own pre-existing role check (_is_content_manager /
    _is_student in views.py), unchanged. Only CentralAuthUser requests
    are checked against the token's `perms` claim."""

    class _DualRequiresPermission(BasePermission):
        message = f'Missing required permission: {codename}.'

        def has_permission(self, request, view):
            user = request.user
            if not isinstance(user, CentralAuthUser):
                return True
            return bool(user.is_authenticated and user.has_perm(codename))

    _DualRequiresPermission.__name__ = f'DualRequiresPermission_{codename}'
    return _DualRequiresPermission
