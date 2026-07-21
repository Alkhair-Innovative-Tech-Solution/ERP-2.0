"""
Permission utilities for notifications
"""
from rest_framework.permissions import BasePermission


class IsBroadcaster(BasePermission):
    """
    Allow admins, coordinators, and teachers to broadcast notifications.
    Teachers have additional restrictions handled during validation but
    still need access to the endpoint.
    """

    allowed_roles = {'ADMIN', 'COORDINATOR', 'TEACHER'}

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        role = str(getattr(user, 'role', '') or '').upper()
        return role in self.allowed_roles

