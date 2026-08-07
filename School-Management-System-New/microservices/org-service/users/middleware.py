"""
Organization Tenant Middleware
Automatically filters querysets based on the logged-in user's organization.
Superadmin users bypass this filter.
Supports ASGI/Asyncio by using contextvars instead of threading.local.
"""
import jwt
from contextvars import ContextVar
from ams_shared.jwt.validator import ServiceJWTAuthentication
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
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Reset context variables for this request/coroutine
        token_org = _organization_var.set(None)
        token_user = _user_var.set(None)
        
        try:
            user = getattr(request, 'user', None)

            # If user is anonymous (common for JWT API calls at middleware level),
            # try to manually authenticate via stateless JWT (no DB lookup).
            if not user or not user.is_authenticated:
                try:
                    # Phase C11: this middleware does its OWN manual
                    # authentication (DRF's authentication_classes chain
                    # hasn't run yet at this point in the middleware
                    # stack — request.user is still Django's own
                    # AnonymousUser). It previously only knew about
                    # ServiceJWTAuthentication (HS256) — a central-auth
                    # (RS256) token would fail HS256 decoding, get
                    # swallowed by the broad except below, and leave the
                    # thread-local context vars unset for the entire
                    # request, making every OrganizationManager-backed
                    # `.objects` query blind for central-auth (the same
                    # C5-class hazard as everywhere else, manifesting via
                    # middleware instead of a queryset). Route on the
                    # token's own `alg` header, same as
                    # org_service.dual_auth.DualAuthentication.
                    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
                    is_central = False
                    if auth_header.startswith('Bearer '):
                        try:
                            is_central = jwt.get_unverified_header(
                                auth_header.split(' ', 1)[1]
                            ).get('alg') == 'RS256'
                        except jwt.InvalidTokenError:
                            is_central = False
                    if is_central:
                        from org_service.dual_auth import DualAuthentication
                        result = DualAuthentication().authenticate(request)
                    else:
                        result = ServiceJWTAuthentication().authenticate(request)
                    if result:
                        user = result[0]
                        if getattr(user, 'tenant_id', None) and getattr(user, 'organization', None) is None:
                            from .models import Organization
                            user.organization = Organization.all_objects.filter(
                                tenant_id=user.tenant_id
                            ).first()
                except (AuthenticationFailed, Exception):
                    user = None

            # Set context if we found a valid user
            if user and user.is_authenticated:
                # Block inactive organizations (bypass for superadmins)
                if user.organization and not user.organization.is_active and not user.is_superadmin():
                    from django.http import JsonResponse
                    return JsonResponse({
                        'error': 'Organization is inactive',
                        'detail': 'Your organization has been deactivated. Please contact the administrator.'
                    }, status=403)

                _user_var.set(user)
                _organization_var.set(getattr(user, 'organization', None))
            
            response = self.get_response(request)
            return response
            
        finally:
            # Clean up context variables after the request
            _organization_var.reset(token_org)
            _user_var.reset(token_user)
