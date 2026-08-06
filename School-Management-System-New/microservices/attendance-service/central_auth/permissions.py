"""
DRF permission classes reading claims off CentralAuthUser (see authentication.py).

Reusable template: SERVICE_CODE is the only VMS-specific constant here.
To onboard another service, copy this file and change SERVICE_CODE.
"""
from rest_framework.permissions import BasePermission

SERVICE_CODE = 'sms'


class ServiceSubscribed(BasePermission):
    """
    403 if the token's tenant does not have an active subscription for this
    service. Superadmin bypasses (CentralAuthUser.has_service already
    accounts for is_superadmin).
    """
    message = 'Your organization does not have an active SMS subscription.'

    def has_permission(self, request, view):
        user = request.user
        return bool(getattr(user, 'is_authenticated', False) and user.has_service(SERVICE_CODE))


def RequiresPermission(codename: str):
    """
    Factory: returns a DRF permission class enforcing a single vms.* codename
    from the token's `perms` claim. Superadmin / '*' bypasses.

    Usage: permission_classes([ServiceSubscribed, RequiresPermission('vms.visit.create')])
    """

    class _RequiresPermission(BasePermission):
        message = f'Missing required permission: {codename}.'

        def has_permission(self, request, view):
            user = request.user
            return bool(getattr(user, 'is_authenticated', False) and user.has_perm(codename))

    _RequiresPermission.__name__ = f'RequiresPermission_{codename}'
    return _RequiresPermission
