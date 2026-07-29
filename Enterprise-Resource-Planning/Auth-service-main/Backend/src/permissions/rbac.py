from functools import wraps
from django.core.cache import cache
from ninja.errors import HttpError
from authentication.superadmin_models import SuperAdmin
from permissions.models import Permission, EmployeeRole, EmployeePermissionOverride

CACHE_TTL = 300  # 5 minutes
_CACHE_KEY = "rbac:emp:{}:permissions"
_PERM_VERSION_KEY = "rbac:emp:{}:perm_version"
PERM_VERSION_TTL = 60 * 60 * 24 * 30  # 30 days — versions only go up, never expire in practice


def get_perm_version(employee_id: str) -> int:
    """Monotonic counter embedded in JWTs as `perm_version`. Downstream services
    compare it to a cached value to detect a token minted before a permission
    change and force re-auth/refresh instead of trusting stale `perms`."""
    return cache.get(_PERM_VERSION_KEY.format(employee_id), 1) or 1


def bump_perm_version(employee_id: str) -> int:
    key = _PERM_VERSION_KEY.format(employee_id)
    new_version = get_perm_version(employee_id) + 1
    cache.set(key, new_version, PERM_VERSION_TTL)
    return new_version


def get_effective_permissions(employee_id: str) -> set:
    """
    Compute effective GLOBAL permissions for an employee (unscoped role/override grants only).
    Formula: (role_permissions ∪ allowed_overrides) − denied_overrides
    Cached in Redis for 5 minutes.

    Object-scoped grants (EmployeeRole/EmployeePermissionOverride with scope_content_type
    set) are deliberately excluded here — a role scoped to one Branch does not grant the
    permission "everywhere". Use has_permission(user, codename, obj=...) to check those.
    """
    cache_key = _CACHE_KEY.format(employee_id)
    cached = cache.get(cache_key)
    if cached is not None:
        return set(cached)

    role_codenames = set(
        Permission.objects.filter(
            roles__employee_roles__employee_id=employee_id,
            roles__employee_roles__is_deleted=False,
            roles__employee_roles__scope_content_type__isnull=True,
        ).values_list("codename", flat=True)
    )

    allowed_overrides: set = set()
    denied_overrides: set = set()
    for override in EmployeePermissionOverride.objects.filter(
        employee_id=employee_id, is_deleted=False, scope_content_type__isnull=True
    ).select_related("permission"):
        if override.is_allowed:
            allowed_overrides.add(override.permission.codename)
        else:
            denied_overrides.add(override.permission.codename)

    effective = (role_codenames | allowed_overrides) - denied_overrides
    cache.set(cache_key, list(effective), CACHE_TTL)
    return effective


def get_scoped_permissions(employee_id: str, obj) -> set:
    """
    Compute permissions granted to an employee specifically scoped to `obj`
    (e.g. a Branch/Gate instance) — NOT cached, evaluated fresh each call.
    Formula mirrors get_effective_permissions but filtered to scope_content_type/
    scope_object_id matching obj's ContentType + pk.
    """
    from django.contrib.contenttypes.models import ContentType

    if obj is None:
        return set()
    ct = ContentType.objects.get_for_model(obj)

    role_codenames = set(
        Permission.objects.filter(
            roles__employee_roles__employee_id=employee_id,
            roles__employee_roles__is_deleted=False,
            roles__employee_roles__scope_content_type=ct,
            roles__employee_roles__scope_object_id=obj.pk,
        ).values_list("codename", flat=True)
    )

    allowed_overrides: set = set()
    denied_overrides: set = set()
    for override in EmployeePermissionOverride.objects.filter(
        employee_id=employee_id,
        is_deleted=False,
        scope_content_type=ct,
        scope_object_id=obj.pk,
    ).select_related("permission"):
        if override.is_allowed:
            allowed_overrides.add(override.permission.codename)
        else:
            denied_overrides.add(override.permission.codename)

    return (role_codenames | allowed_overrides) - denied_overrides


def has_permission(user, codename: str, obj=None) -> bool:
    """SuperAdmin bypasses all checks. Employee checked against effective permissions.

    obj=None: global check only (existing behavior — codename must come from an
        unscoped role/override).
    obj=<model instance>: also passes if the employee holds a role/override scoped
        to exactly that object (e.g. assigned to one Branch/Gate, not all of them).
    """
    if isinstance(user, SuperAdmin):
        return True
    if codename in get_effective_permissions(str(user.id)):
        return True
    if obj is not None:
        return codename in get_scoped_permissions(str(user.id), obj)
    return False


def clear_permission_cache(employee_id: str) -> None:
    """Invalidate cached permission set for one employee and bump perm_version
    so already-issued tokens can be recognized as stale by downstream services."""
    cache.delete(_CACHE_KEY.format(employee_id))
    bump_perm_version(employee_id)


def require_permission(codename: str, obj_resolver=None):
    """Decorator that enforces a permission check on a Django Ninja endpoint.
    Requires router-level auth=AuthBearer() so request.auth is populated.
    SuperAdmin bypasses all checks. Employee must have codename in effective permissions.

    obj_resolver: optional callable(request, *args, **kwargs) -> model instance.
    When given, also allows employees whose role/override is scoped to exactly that
    object (has-permission AND target-in-scope), not just global grants.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            obj = obj_resolver(request, *args, **kwargs) if obj_resolver else None
            if not has_permission(request.auth, codename, obj=obj):
                raise HttpError(403, "Permission denied")
            return func(request, *args, **kwargs)
        return wrapper
    return decorator
