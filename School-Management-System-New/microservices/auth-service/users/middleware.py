"""
Organization Tenant Middleware
Automatically filters querysets based on the logged-in user's organization.
Superadmin users bypass this filter.
Supports ASGI/Asyncio by using contextvars instead of threading.local.
"""
from contextvars import ContextVar
from central_auth.authentication import CentralAuthAuthentication, CentralAuthUser
from rest_framework.exceptions import AuthenticationFailed

# Context variables to hold the current organization and user.
# These are safer for ASGI/Asyncio (Daphne/Uvicorn) than threading.local.
_organization_var = ContextVar('organization', default=None)
_user_var = ContextVar('user', default=None)


class _BoolCallable:
    """Behaves as a bool in a truthy/`or` context (`__bool__`) AND as a
    zero-arg callable returning that same bool (`__call__`). Same trick as
    org-service/staff-service's Phase C11/C12 wrappers."""

    __slots__ = ('_value',)

    def __init__(self, value):
        self._value = bool(value)

    def __bool__(self):
        return self._value

    def __call__(self):
        return self._value

    def __repr__(self):
        return repr(self._value)


class _VendoredCentralAuthUser(CentralAuthUser):
    """Wraps a raw CentralAuthUser to duck-type this vendored
    users/managers.py's expectations (`user.is_superadmin()` — a CALLABLE
    here and on the local User model, vs a plain bool claim on
    CentralAuthUser; `user.role` — no equivalent on CentralAuthUser at
    all). Same fix as org-service's OrgCentralAuthUser / staff-service's
    StaffCentralAuthUser (Phase C11/C12), needed here for the first time in
    Phase D-R6: this middleware previously only ever tried legacy HS256
    (which always failed for an RS256 token, leaving get_current_user()
    None) — `.is_superadmin()` was never actually invoked against a real
    CentralAuthUser through this vendored path before, so this crash
    (`TypeError: 'bool' object is not callable`) was latent, not
    previously reachable. `role = None` fails closed the same way as
    everywhere else in this codebase (never matches 'admin', falls through
    to the org_id-scoped branch below)."""

    def __init__(self, claims: dict):
        super().__init__(claims)
        self.is_superadmin = _BoolCallable(self.is_superadmin)
        self.role = None


def get_current_organization():
    """Get the current organization from context variables"""
    return _organization_var.get()


def get_current_user():
    """Get the current user from context variables"""
    return _user_var.get()


class OrganizationMiddleware:
    """
    Middleware that sets the current organization on each request.
    This allows models and querysets to automatically filter by organization.

    Phase D-R6: legacy HS256 (ServiceJWTAuthentication) manual-auth fallback
    removed — central auth (RS256) is the only live path, same as this
    service's own <service>.dual_auth.DualAuthentication. This file is
    vendored verbatim into every service that copies
    microservices/auth-service/users/ at Docker build time (attendance,
    campus, content, fees, notification, result, student, subject, support,
    timetable — org-service and staff-service each override this file
    instead, see their own users/middleware.py or
    users_override/middleware.py). See docs/PHASE_D_R4R6_REMOVAL_RESULT.md.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Reset context variables for this request/coroutine
        token_org = _organization_var.set(None)
        token_user = _user_var.set(None)

        try:
            user = getattr(request, 'user', None)

            if not user or not user.is_authenticated:
                try:
                    auth = CentralAuthAuthentication()
                    result = auth.authenticate(request)
                    if result:
                        user = _VendoredCentralAuthUser(result[0].claims)
                except (AuthenticationFailed, Exception):
                    user = None

            if user and user.is_authenticated:
                # Resolve organization object from org_id claim when the user is
                # a stateless _TokenUser (organization attr is None by default).
                org = getattr(user, 'organization', None)
                if org is None:
                    org_id = getattr(user, 'org_id', None)
                    if org_id:
                        try:
                            from users.models import Organization
                            org = Organization.all_objects.filter(pk=org_id).first()
                            if org is None:
                                # Org exists in auth/org-service but not synced here yet.
                                # Create a minimal placeholder so FK constraints work.
                                org, _ = Organization.all_objects.get_or_create(
                                    id=org_id,
                                    defaults={'name': f'Org-{org_id}'}
                                )
                        except Exception:
                            org = None

                # Block inactive organizations (bypass for superadmins)
                if org and not org.is_active and not user.is_superadmin():
                    from django.http import JsonResponse
                    return JsonResponse({
                        'error': 'Organization is inactive',
                        'detail': 'Your organization has been deactivated. Please contact the administrator.'
                    }, status=403)

                _user_var.set(user)
                _organization_var.set(org)

            response = self.get_response(request)
            return response

        finally:
            # Clean up context variables after the request
            _organization_var.reset(token_org)
            _user_var.reset(token_user)
