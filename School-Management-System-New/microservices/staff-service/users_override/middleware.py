"""
Phase C12: staff-service-only override of the vendored users/middleware.py
(sourced from auth-service — shared by every service that vendors `users`,
so it can't be edited in place without affecting all of them). Copied over
the vendored file LAST in the Dockerfile, same "re-copy to override"
pattern already used there for `services/`.

Only change from the vendored original: the manual authentication
fallback (this middleware runs before DRF's authentication_classes chain
has executed — request.user is still Django's own AnonymousUser at this
point) only knew about ServiceJWTAuthentication (legacy HS256). A
central-auth (RS256) token would fail HS256 decoding, get swallowed by the
existing broad except, and leave the thread-local context vars
(get_current_user()/get_current_organization()) unset for the entire
request — making every OrganizationManager-backed `.objects` query blind
for central-auth (Teacher.objects, Principal.objects, Coordinator.objects,
User.objects, RolePermission.objects all use it). Same C5-class hazard as
every prior phase's queryset, manifesting through middleware instead of a
manager directly — same fix as Phase C11 (org-service) applied here:
route on the token's own `alg` header, and resolve `.organization` via
`Organization.tenant_id` for a central token (that field doesn't exist on
this vendored Organization model yet — see docs/PHASE_C12_STAFF_SERVICE_RESULT.md's
audit table — so this resolves to None for central tokens today; queryset-
level tenant scoping in teachers/principals/coordinator's views.py is what
actually does the tenant isolation, same as C11's `central_tenant_qs`
pattern applied via `all_objects` there instead of relying on this
manager).
"""
from contextvars import ContextVar
from rest_framework.exceptions import AuthenticationFailed

# Context variables to hold the current organization and user.
# These are safer for ASGI/Asyncio (Daphne/Uvicorn) than threading.local.
_organization_var = ContextVar('organization', default=None)
_user_var = ContextVar('user', default=None)


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
    Uses stateless JWT (ServiceJWTAuthentication) so it works across all
    microservices without requiring the user to exist in the local DB.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Reset context variables for this request/coroutine
        token_org = _organization_var.set(None)
        token_user = _user_var.set(None)

        try:
            user = getattr(request, 'user', None)

            # Phase D-R4: legacy HS256 (ServiceJWTAuthentication) fallback
            # removed — central auth (RS256) is the only live path, same
            # as staff_service.dual_auth.DualAuthentication, which this
            # now delegates to directly. See
            # docs/PHASE_D_R4R6_REMOVAL_RESULT.md.
            if not user or not user.is_authenticated:
                try:
                    from staff_service.dual_auth import DualAuthentication
                    result = DualAuthentication().authenticate(request)
                    if result:
                        user = result[0]
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
