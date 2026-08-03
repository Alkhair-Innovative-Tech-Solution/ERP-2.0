from functools import wraps
from django.core.cache import cache
from ninja.errors import HttpError
from authentication.superadmin_models import SuperAdmin
from authentication.nonstaff_models import NonStaffIdentity
from permissions.models import Permission, EmployeeRole, EmployeePermissionOverride

CACHE_TTL = 300  # 5 minutes
_CACHE_KEY = "perms:{}:{}"           # perms:{principal_type}:{principal_id}
_PERM_VERSION_KEY = "permver:{}:{}"  # permver:{principal_type}:{principal_id}
PERM_VERSION_TTL = 60 * 60 * 24 * 30  # 30 days — versions only go up, never expire in practice

# Phase B3: RBAC generalized to any principal, not just Employee.
# principal_type is "employee" (default, backward-compatible — every
# pre-B3 call site that passes only an id keeps resolving exactly as an
# employee, byte-for-byte) or "non_staff" (NonStaffIdentity, e.g. SMS
# students). The FK field name on EmployeeRole/EmployeePermissionOverride
# matches principal_type exactly ("employee" / "non_staff"), so the query
# lookups below are built by simple string interpolation — no per-type
# branching logic to keep in sync.
VALID_PRINCIPAL_TYPES = ("employee", "non_staff")


def _validate_principal_type(principal_type: str) -> str:
    if principal_type not in VALID_PRINCIPAL_TYPES:
        raise ValueError(f"Unknown principal_type '{principal_type}' (expected one of {VALID_PRINCIPAL_TYPES})")
    return principal_type


def get_perm_version(principal_id: str, principal_type: str = "employee") -> int:
    """Monotonic counter embedded in JWTs as `perm_version`. Downstream services
    compare it to a cached value to detect a token minted before a permission
    change and force re-auth/refresh instead of trusting stale `perms`."""
    principal_type = _validate_principal_type(principal_type)
    return cache.get(_PERM_VERSION_KEY.format(principal_type, principal_id), 1) or 1


def bump_perm_version(principal_id: str, principal_type: str = "employee") -> int:
    principal_type = _validate_principal_type(principal_type)
    key = _PERM_VERSION_KEY.format(principal_type, principal_id)
    new_version = get_perm_version(principal_id, principal_type) + 1
    cache.set(key, new_version, PERM_VERSION_TTL)
    return new_version


def get_effective_permissions(principal_id: str, principal_type: str = "employee") -> set:
    """
    Compute effective GLOBAL permissions for a principal — Employee (default,
    backward-compatible with every pre-B3 caller) or NonStaffIdentity
    (principal_type="non_staff") — unscoped role/override grants only.
    Formula: (role_permissions ∪ allowed_overrides) − denied_overrides
    Cached in Redis for 5 minutes, keyed by (principal_type, principal_id) so
    an employee and a student can never collide even if their UUIDs did.

    Object-scoped grants (EmployeeRole/EmployeePermissionOverride with scope_content_type
    set) are deliberately excluded here — a role scoped to one Branch does not grant the
    permission "everywhere". Use has_permission(user, codename, obj=...) to check those.
    """
    principal_type = _validate_principal_type(principal_type)
    cache_key = _CACHE_KEY.format(principal_type, principal_id)
    cached = cache.get(cache_key)
    if cached is not None:
        return set(cached)

    role_lookup = f"roles__employee_roles__{principal_type}_id"
    override_lookup = f"{principal_type}_id"

    role_codenames = set(
        Permission.objects.filter(**{
            role_lookup: principal_id,
            "roles__employee_roles__is_deleted": False,
            "roles__employee_roles__scope_content_type__isnull": True,
        }).values_list("codename", flat=True)
    )

    allowed_overrides: set = set()
    denied_overrides: set = set()
    for override in EmployeePermissionOverride.objects.filter(**{
        override_lookup: principal_id,
        "is_deleted": False,
        "scope_content_type__isnull": True,
    }).select_related("permission"):
        if override.is_allowed:
            allowed_overrides.add(override.permission.codename)
        else:
            denied_overrides.add(override.permission.codename)

    effective = (role_codenames | allowed_overrides) - denied_overrides
    cache.set(cache_key, list(effective), CACHE_TTL)
    return effective


def get_scoped_permissions(principal_id: str, obj, principal_type: str = "employee") -> set:
    """
    Compute permissions granted to a principal specifically scoped to `obj`
    (e.g. a Branch/Gate instance) — NOT cached, evaluated fresh each call.
    Formula mirrors get_effective_permissions but filtered to scope_content_type/
    scope_object_id matching obj's ContentType + pk.
    """
    from django.contrib.contenttypes.models import ContentType

    principal_type = _validate_principal_type(principal_type)
    if obj is None:
        return set()
    ct = ContentType.objects.get_for_model(obj)

    role_lookup = f"roles__employee_roles__{principal_type}_id"
    override_lookup = f"{principal_type}_id"

    role_codenames = set(
        Permission.objects.filter(**{
            role_lookup: principal_id,
            "roles__employee_roles__is_deleted": False,
            "roles__employee_roles__scope_content_type": ct,
            "roles__employee_roles__scope_object_id": obj.pk,
        }).values_list("codename", flat=True)
    )

    allowed_overrides: set = set()
    denied_overrides: set = set()
    for override in EmployeePermissionOverride.objects.filter(**{
        override_lookup: principal_id,
        "is_deleted": False,
        "scope_content_type": ct,
        "scope_object_id": obj.pk,
    }).select_related("permission"):
        if override.is_allowed:
            allowed_overrides.add(override.permission.codename)
        else:
            denied_overrides.add(override.permission.codename)

    return (role_codenames | allowed_overrides) - denied_overrides


def has_permission(user, codename: str, obj=None) -> bool:
    """SuperAdmin bypasses all checks. Employee/NonStaffIdentity checked
    against effective permissions via the shared generic path.

    obj=None: global check only (existing behavior — codename must come from an
        unscoped role/override).
    obj=<model instance>: also passes if the principal holds a role/override scoped
        to exactly that object (e.g. assigned to one Branch/Gate, not all of them).
    """
    if isinstance(user, SuperAdmin):
        return True
    principal_type = "non_staff" if isinstance(user, NonStaffIdentity) else "employee"
    if codename in get_effective_permissions(str(user.id), principal_type):
        return True
    if obj is not None:
        return codename in get_scoped_permissions(str(user.id), obj, principal_type)
    return False


def clear_permission_cache(principal_id: str, principal_type: str = "employee") -> None:
    """Invalidate cached permission set for one principal and bump perm_version
    so already-issued tokens can be recognized as stale by downstream services."""
    principal_type = _validate_principal_type(principal_type)
    cache.delete(_CACHE_KEY.format(principal_type, principal_id))
    bump_perm_version(principal_id, principal_type)


def require_permission(codename: str, obj_resolver=None):
    """Decorator that enforces a permission check on a Django Ninja endpoint.
    Requires router-level auth=AuthBearer() so request.auth is populated.
    SuperAdmin bypasses all checks. Employee/NonStaffIdentity must have
    codename in effective permissions.

    obj_resolver: optional callable(request, *args, **kwargs) -> model instance.
    When given, also allows principals whose role/override is scoped to exactly that
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
