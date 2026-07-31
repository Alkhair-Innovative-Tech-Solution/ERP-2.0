"""
Permission checks reading claims off CentralAuthUser (see authentication.py).

Reusable template: SERVICE_CODE is the only per-service-value here. To
onboard another service, change SERVICE_CODE.

Framework note (not a template change): VMS's original template exposed
these as DRF `BasePermission` classes plugged in via
`permission_classes=[...]`, which DRF's view dispatch calls automatically.
Django Ninja has no `permission_classes` concept at all — there is nothing
for a DRF-style permission class to plug into here. So this file exposes
the *same* two checks (`user.has_service()` / `user.has_perm()` — both
plain methods on CentralAuthUser, not DRF-specific) as a Ninja-native
decorator instead. The underlying authorization logic is unchanged; only
how it attaches to a view differs, because it has to.
"""
import functools

from ninja.errors import HttpError

SERVICE_CODE = 'hdms'


def _check_authenticated_and_subscribed(request):
    user = getattr(request, 'user', None)
    if not getattr(user, 'is_authenticated', False):
        raise HttpError(401, 'Authentication credentials were not provided.')
    if not user.has_service(SERVICE_CODE):
        raise HttpError(403, 'Your organization does not have an active HDMS subscription.')
    return user


def require_permission(codename: str):
    """
    Decorator: 403 unless the token's `perms` claim grants `codename`
    (superadmin / '*' bypasses). Also applies the ServiceSubscribed gate
    first, same enforcement order VMS uses:
    IsAuthenticated -> ServiceSubscribed -> RequiresPermission(codename).

    Usage:
        @router.post("/{ticket_id}/assign", response=TicketOut)
        @require_permission('hdms.ticket.assign')
        def assign_ticket(request, ticket_id: str, payload: AssignTicketIn):
            ...
    """

    def decorator(view_func):
        @functools.wraps(view_func)
        def wrapper(request, *args, **kwargs):
            user = _check_authenticated_and_subscribed(request)
            if not user.has_perm(codename):
                raise HttpError(403, f'Missing required permission: {codename}.')
            return view_func(request, *args, **kwargs)

        return wrapper

    return decorator


def require_service_subscribed(view_func):
    """Decorator form of the bare ServiceSubscribed gate (no specific permission)."""

    @functools.wraps(view_func)
    def wrapper(request, *args, **kwargs):
        _check_authenticated_and_subscribed(request)
        return view_func(request, *args, **kwargs)

    return wrapper
