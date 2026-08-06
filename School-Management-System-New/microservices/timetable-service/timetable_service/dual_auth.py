"""
Phase C9: dual-run auth/permission glue for timetable-service. Same shape
as content-service's dual_auth.py (Phase C1) / fees-service's (C2) /
result-service's (C3) / subject-service's (C4) / campus-service's (C5) /
support-service's (C6) / notification-service's (C7) / student-service's
(C8) — see those files' docstrings for the two underlying problems this
solves (DRF authenticators raising instead of returning None on a foreign
token scheme; OrganizationMiddleware never populating its contextvars for
central-auth requests, so any OrganizationManager-filtered `.objects`
queryset silently returns empty on that path).

Lives at the project-package level (not inside `timetable/` or
`transfers/`) — same reasoning as C4-C8's project-level dual_auth.py,
neither app is "primary".

timetable-service is a "normal" service (per the C9 prompt) — a couple of
person-FKs (`teacher`, `created_by`) and one role gate (`IsPrincipal`).
This service ALREADY avoids `.objects` (OrganizationManager) everywhere in
its own view/serializer code, using `._base_manager`/`all_objects`
directly with an explanatory comment ("subjects added via admin may have
NULL organization" etc.) — the C5-class blind-spot lesson was independently
learned here before this phase, just not yet tenant-filtered for
central-auth. `principals` is vendored locally (Dockerfile-copied from
staff-service, same as C3/C6/C8) for the dual `IsPrincipal` below — same
local DB-match technique (email or employee_code) established in C3.
"""
import jwt
from django.db.models import Q
from rest_framework.authentication import BaseAuthentication
from rest_framework.permissions import BasePermission

from ams_shared.jwt.validator import ServiceJWTAuthentication
from central_auth.authentication import CentralAuthAuthentication, CentralAuthUser
from users.permissions import IsPrincipal as _LegacyIsPrincipal


class DualAuthentication(BaseAuthentication):
    """Routes to CentralAuthAuthentication (RS256) or the legacy
    ServiceJWTAuthentication (HS256) based on the token's own `alg`
    header. Identical in shape to C1-C8's version."""

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
    CentralAuthUser. Identical in shape to C1-C8's version."""
    message = 'Your organization does not have an active SMS subscription.'

    def has_permission(self, request, view):
        user = request.user
        if not isinstance(user, CentralAuthUser):
            return True
        return bool(user.is_authenticated and user.has_service('sms'))


def DualRequiresPermission(codename: str):
    """No-op (True) for legacy tokens; enforces one sms.* codename for
    CentralAuthUser. Identical in shape to C1-C8's version."""

    class _DualRequiresPermission(BasePermission):
        message = f'Missing required permission: {codename}.'

        def has_permission(self, request, view):
            user = request.user
            if not isinstance(user, CentralAuthUser):
                return True
            return bool(user.is_authenticated and user.has_perm(codename))

    _DualRequiresPermission.__name__ = f'DualRequiresPermission_{codename}'
    return _DualRequiresPermission


# ── staff (teacher/principal) resolution — C3/C6/C8 pattern ────────────────

def user_identifier(user):
    if isinstance(user, CentralAuthUser):
        return user.employee_code
    return getattr(user, 'username', '')


def user_display_name(user) -> str:
    if isinstance(user, CentralAuthUser):
        return user.full_name or user.employee_code or str(user.id)
    return getattr(user, 'username', str(getattr(user, 'id', '')))


def _find(model, user):
    """FLAGGED: `._base_manager` is NOT tenant-scoped. Teacher/Principal
    live in staff-service (out of scope to touch from a
    timetable-service-scoped phase — no tenant_id column exists there
    yet), same residual gap flagged in C3/C4/C6/C8's dual_auth.py.

    Guarded against the empty-string false-positive bug found live in
    C8's own proof testing: a non-staff-shaped CentralAuthUser token (this
    service has none today, but the guard is cheap and correct regardless)
    has neither `employee_code` nor `email` claims set — `Q(email='') |
    Q(employee_code='')` unguarded could match any row with a blank
    email/employee_code. Only build a clause for a field that actually has
    a non-empty value; require a staff-shaped token (`employee_id` claim
    present) before querying at all."""
    if isinstance(user, CentralAuthUser) and not user.employee_id:
        return None
    manager = model._base_manager if isinstance(user, CentralAuthUser) else model.objects
    email = user.email or None
    employee_code = user_identifier(user) or None
    if not email and not employee_code:
        return None
    q = Q()
    if email:
        q |= Q(email=email)
    if employee_code:
        q |= Q(employee_code=employee_code)
    return manager.filter(q).first()


def find_teacher(user):
    from teachers.models import Teacher
    return _find(Teacher, user)


def find_principal(user):
    from principals.models import Principal
    return _find(Principal, user)


# ── dual IsPrincipal — legacy delegates to the ORIGINAL class unchanged ────

class IsPrincipal(BasePermission):
    """Legacy: delegates to the original `users.permissions.IsPrincipal`
    unchanged (`request.user.is_principal()`, works against `_TokenUser`
    since `.role` is a plain attribute there). Central: resolvable via
    find_principal (a local Principal DB match) — no role/principal_type
    claim exists on CentralAuthUser yet (same gap flagged since B3)."""

    def has_permission(self, request, view):
        user = request.user
        if isinstance(user, CentralAuthUser):
            return bool(user.is_superadmin or find_principal(user) is not None)
        return _LegacyIsPrincipal().has_permission(request, view)


# ── central-id stamping / tenant scoping ────────────────────────────────────

def central_person_id(user):
    """The value to stamp into a central_*_id UUID column for the acting
    user's own identity (e.g. created_by). None for a legacy token."""
    return user.id if isinstance(user, CentralAuthUser) else None


def get_org_and_tenant(user):
    """Returns (organization_instance_or_None, tenant_id_or_None). Legacy:
    resolves/creates the local Organization from user.org_id (mirrors
    every prior phase's helper), unchanged; tenant_id always None.
    CentralAuthUser: organization always None (no org_id on this token,
    only tenant_id), tenant_id from the token."""
    from users.models import Organization
    if isinstance(user, CentralAuthUser):
        return None, user.tenant_id
    org_id = getattr(user, 'org_id', None)
    if not org_id:
        return None, None
    org, _ = Organization.all_objects.get_or_create(
        id=org_id, defaults={'name': f'Org-{org_id}'}
    )
    return org, None


def central_tenant_qs(all_objects_manager, user):
    """Central-auth read path: explicit tenant filter, NOT the
    OrganizationManager-backed `.objects` default (see module docstring).
    Rows with tenant_id IS NULL (legacy-created, pre-migration) are
    included — same permissive-for-unscoped-rows precedent as C1-C8."""
    if not user.tenant_id:
        return all_objects_manager.none()
    return all_objects_manager.filter(
        Q(tenant_id=user.tenant_id) | Q(tenant_id__isnull=True)
    )
