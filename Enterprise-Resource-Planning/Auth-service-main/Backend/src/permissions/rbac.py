from functools import wraps
from django.core.cache import cache
from ninja.errors import HttpError
from authentication.superadmin_models import SuperAdmin
from permissions.models import Permission, EmployeeRole, EmployeePermissionOverride

CACHE_TTL = 300  # 5 minutes
_CACHE_KEY = "rbac:emp:{}:permissions"


def get_effective_permissions(employee_id: str) -> set:
    """
    Compute effective permissions for an employee.
    Formula: (role_permissions ∪ allowed_overrides) − denied_overrides
    Cached in Redis for 5 minutes.
    """
    cache_key = _CACHE_KEY.format(employee_id)
    cached = cache.get(cache_key)
    if cached is not None:
        return set(cached)

    role_codenames = set(
        Permission.objects.filter(
            roles__employee_roles__employee_id=employee_id,
            roles__employee_roles__is_deleted=False,
        ).values_list("codename", flat=True)
    )

    allowed_overrides: set = set()
    denied_overrides: set = set()
    for override in EmployeePermissionOverride.objects.filter(
        employee_id=employee_id, is_deleted=False
    ).select_related("permission"):
        if override.is_allowed:
            allowed_overrides.add(override.permission.codename)
        else:
            denied_overrides.add(override.permission.codename)

    effective = (role_codenames | allowed_overrides) - denied_overrides
    cache.set(cache_key, list(effective), CACHE_TTL)
    return effective


def has_permission(user, codename: str) -> bool:
    """SuperAdmin bypasses all checks. Employee checked against effective permissions."""
    if isinstance(user, SuperAdmin):
        return True
    return codename in get_effective_permissions(str(user.id))


def clear_permission_cache(employee_id: str) -> None:
    """Invalidate cached permission set for one employee."""
    cache.delete(_CACHE_KEY.format(employee_id))


def require_permission(codename: str):
    """Decorator that enforces a permission check on a Django Ninja endpoint.
    Requires router-level auth=AuthBearer() so request.auth is populated.
    SuperAdmin bypasses all checks. Employee must have codename in effective permissions.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            if not has_permission(request.auth, codename):
                raise HttpError(403, "Permission denied")
            return func(request, *args, **kwargs)
        return wrapper
    return decorator
