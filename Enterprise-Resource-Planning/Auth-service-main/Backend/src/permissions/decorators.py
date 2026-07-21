from functools import wraps
from ninja.errors import HttpError
from permissions.rbac import has_permission


def require_permission(codename: str):
    """
    Decorator for Django Ninja endpoints that enforces RBAC.
    Must be applied AFTER the @router.method() decorator (closer to the function).
    Requires the endpoint to use auth=AuthBearer() so request.auth is populated.
    SuperAdmin bypasses all checks unconditionally.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            if not has_permission(request.auth, codename):
                raise HttpError(403, f"Permission denied: requires '{codename}'")
            return func(request, *args, **kwargs)
        return wrapper
    return decorator
