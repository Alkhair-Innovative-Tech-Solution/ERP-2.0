"""
Phase C5: dual-run auth/permission glue for campus-service. Same shape as
content-service's dual_auth.py (Phase C1) / fees-service's (Phase C2) /
result-service's (Phase C3) / subject-service's (Phase C4) — see those
files' docstrings for the two underlying problems this solves (DRF
authenticators raising instead of returning None on a foreign token scheme;
OrganizationMiddleware never populating its contextvars for central-auth
requests, so any OrganizationManager-filtered `.objects` queryset silently
returns empty on that path).

Lives at the project-package level (not inside `campus/` or `classes/`),
same reasoning as C4's subject_service/dual_auth.py — both apps need it,
neither is the "primary" one.

campus-service's permissions are simple (IsAuthenticated only, no role-gate
classes — like C4, unlike C3). The real problems here:

1. Views read `request.user.organization` / `users.middleware.get_current_organization()`
   directly (`_get_org()` in campus/views.py, inline in classes/views.py) —
   CentralAuthUser has neither; get_org_and_tenant() below is the dual-safe
   replacement.
2. `user.is_superadmin()` is called as a METHOD throughout (LevelViewSet/
   GradeViewSet/ClassRoomViewSet.perform_create) — a bool *attribute* on
   CentralAuthUser, not callable.
3. `classroom.assigned_by = request.user` assigns the acting user directly
   to a real FK (`ClassRoom.assigned_by` -> users.User) in three places
   (assign_teacher, unassign_teacher, the function-based
   unassign_classroom_teacher) — a CentralAuthUser isn't a users.User row,
   raises ValueError at save time. Same class of gap as C2's
   Payment.received_by; central_person_id()/legacy_person_id() below are
   the drop-in fix, mirroring C4's helpers of the same name.
"""
import jwt
from django.db.models import Q
from rest_framework.authentication import BaseAuthentication
from rest_framework.permissions import BasePermission

from ams_shared.jwt.validator import ServiceJWTAuthentication
from central_auth.authentication import CentralAuthAuthentication, CentralAuthUser


class DualAuthentication(BaseAuthentication):
    """Routes to CentralAuthAuthentication (RS256) or the legacy
    ServiceJWTAuthentication (HS256) based on the token's own `alg`
    header. Identical in shape to C1-C4's version."""

    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return None
        token = auth_header.split(' ', 1)[1]
        try:
            header = jwt.get_unverified_header(token)
        except jwt.InvalidTokenError:
            return None
        if header.get('alg') == 'RS256':
            return CentralAuthAuthentication().authenticate(request)
        return ServiceJWTAuthentication().authenticate(request)

    def authenticate_header(self, request):
        return 'Bearer'


class DualServiceSubscribed(BasePermission):
    """No-op (True) for legacy tokens; enforces sms subscription for
    CentralAuthUser. Identical in shape to C1-C4's version."""
    message = 'Your organization does not have an active SMS subscription.'

    def has_permission(self, request, view):
        user = request.user
        if not isinstance(user, CentralAuthUser):
            return True
        return bool(user.is_authenticated and user.has_service('sms'))


def DualRequiresPermission(codename: str):
    """No-op (True) for legacy tokens; enforces one sms.* codename for
    CentralAuthUser. Identical in shape to C1-C4's version."""

    class _DualRequiresPermission(BasePermission):
        message = f'Missing required permission: {codename}.'

        def has_permission(self, request, view):
            user = request.user
            if not isinstance(user, CentralAuthUser):
                return True
            return bool(user.is_authenticated and user.has_perm(codename))

    _DualRequiresPermission.__name__ = f'DualRequiresPermission_{codename}'
    return _DualRequiresPermission


# ── type-safe user helpers ──────────────────────────────────────────────────

def user_is_superadmin(user) -> bool:
    if isinstance(user, CentralAuthUser):
        return user.is_superadmin  # attribute, not a method, on this class
    return user.is_superadmin()  # _TokenUser / User: method call, unchanged


def user_display_name(user) -> str:
    if isinstance(user, CentralAuthUser):
        return user.full_name or user.employee_code or str(user.id)
    return getattr(user, 'username', str(getattr(user, 'id', '')))


def get_org_and_tenant(user):
    """Returns (organization_instance_or_None, tenant_id_or_None) — dual-safe
    replacement for campus/views.py's CampusViewSet._get_org() and the
    equivalent inline logic in classes/views.py. Legacy: resolves the local
    Organization the same way the original code did (request.user.organization,
    falling back to get_current_organization()), unchanged; tenant_id always
    None (a central-auth-only mixin concept). CentralAuthUser: organization
    is always None (no org_id/organization on this token, only tenant_id —
    same reasoning as C1's _get_org), tenant_id from the token."""
    if isinstance(user, CentralAuthUser):
        return None, user.tenant_id
    org = getattr(user, 'organization', None)
    if org is None:
        from users.middleware import get_current_organization
        org = get_current_organization()
    if org is None:
        org_id = getattr(user, 'org_id', None)
        if org_id:
            from users.models import Organization
            org = Organization.all_objects.filter(pk=org_id).first()
    return org, None


def legacy_person_id(user):
    """The value to stamp into a legacy real-FK identity field
    (ClassRoom.assigned_by) for the ACTING user's own identity. None for
    CentralAuthUser (not a users.User row — see central_person_id)."""
    return None if isinstance(user, CentralAuthUser) else user


def central_person_id(user):
    """The value to stamp into the matching central_*_id UUID column for
    the acting user's own identity. None for a legacy token."""
    return user.id if isinstance(user, CentralAuthUser) else None


def central_tenant_qs(all_objects_manager, user):
    """Central-auth read path: explicit tenant filter, NOT the
    OrganizationManager-backed `.objects` default (see module docstring).
    Rows with tenant_id IS NULL (legacy-created, pre-migration) are
    included — same permissive-for-unscoped-rows precedent as C1-C4."""
    if not user.tenant_id:
        return all_objects_manager.none()
    return all_objects_manager.filter(
        Q(tenant_id=user.tenant_id) | Q(tenant_id__isnull=True)
    )
