"""
Organization context middleware for microservices.
Extracts org_id and campus_id from JWT token and makes them available
to all service code via thread-local storage.
"""
import threading
import logging
from django.db import models

logger = logging.getLogger(__name__)

_context = threading.local()


def get_current_org_id():
    """Get the current organization ID from context."""
    return getattr(_context, 'org_id', None)


def get_current_user_id():
    """Get the current user ID from context."""
    return getattr(_context, 'user_id', None)


def get_current_user_role():
    """Get the current user role from context."""
    return getattr(_context, 'user_role', None)


def set_current_context(org_id=None, user_id=None, user_role=None, campus_id=None):
    """Set context variables for the current request."""
    _context.org_id = org_id
    _context.user_id = user_id
    _context.user_role = user_role
    _context.campus_id = campus_id


def clear_current_context():
    """Clear all context variables."""
    _context.org_id = None
    _context.user_id = None
    _context.user_role = None
    _context.campus_id = None


class OrganizationMiddleware:
    """
    Django middleware that extracts org_id from the request headers
    (injected by API Gateway) and sets it in thread-local context.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Extract org_id from headers (injected by API Gateway)
        org_id = request.headers.get('X-Org-Id')
        user_id = request.headers.get('X-User-Id')
        user_role = request.headers.get('X-User-Role')
        campus_id = request.headers.get('X-Campus-Id')

        # Debug logging
        print(f"[OrganizationMiddleware] Path: {request.path}, X-Org-Id: {org_id}, X-Campus-Id: {campus_id}")

        set_current_context(
            org_id=org_id,
            user_id=user_id,
            user_role=user_role,
            campus_id=campus_id
        )

        response = self.get_response(request)

        clear_current_context()

        return response


class OrganizationManager(models.Manager):
    """
    Custom manager that auto-filters querysets by organization_id.
    Use on any model that has an organization_id field.
    """
    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = get_current_org_id()
        if org_id and hasattr(self.model, 'organization_id'):
            queryset = queryset.filter(organization_id=org_id)
        return queryset
