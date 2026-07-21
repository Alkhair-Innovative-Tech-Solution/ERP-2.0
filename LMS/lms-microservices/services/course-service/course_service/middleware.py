"""
Custom middleware to exempt CSRF for API endpoints
"""
from django.utils.deprecation import MiddlewareMixin
from django.conf import settings


class DisableCSRFForAPI(MiddlewareMixin):
    """
    Disable CSRF protection for API endpoints
    """
    def process_request(self, request):
        # Check if path should be exempt from CSRF
        exempt_paths = getattr(settings, 'CSRF_EXEMPT_PATHS', [])
        for path in exempt_paths:
            if request.path.startswith(path):
                setattr(request, '_dont_enforce_csrf_checks', True)
                break
        return None


