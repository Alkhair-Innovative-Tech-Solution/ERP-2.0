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

Lives at the project-package level (not inside `timetable/`) — same
reasoning as C4-C8's project-level dual_auth.py (`timetable` and
`transfers` are peer apps, neither "primary").

Unlike C8 (student-service), this is a "normal" service per the prompt's
own framing: no subject-identity resolution, just the usual actor-identity
person-FKs (`teacher`, `created_by`) plus one role-gate (`IsPrincipal`).
timetable-service already vendors `principals`/`teachers`/`coordinator`
locally (Dockerfile-copied from staff-service, same as C3/C6/C8) — reused
here for `find_principal`/`find_teacher`, same local DB-match technique
(email or employee_code) established in C3.

Note this service's views already avoid `.objects` (OrganizationManager)
entirely in favor of `_base_manager`/`all_objects` even on the LEGACY
path — a pre-existing pattern (`.objects` returns `.none()`/excludes
NULL-org rows whenever the org context-var isn't populated, e.g. from a
management command) unrelated to central-auth. This dual_auth.py's
`central_tenant_qs` builds on top of that same `all_objects`-first
convention, just adding an explicit tenant_id filter for the central-auth
case rather than swapping managers.
"""
from django.db.models import Q
from rest_framework.authentication import BaseAuthentication
from rest_framework.permissions import BasePermission

from central_auth.authentication import CentralAuthAuthentication, CentralAuthUser
from users.permissions import IsPrincipal as _LegacyIsPrincipal


class DualAuthentication(BaseAuthentication):
    """Phase D-R4: HS256 (legacy ServiceJWTAuthentication) verification
    removed — central auth (RS256) is the only live path. See
    docs/PHASE_D_R4R6_REMOVAL_RESULT.md."""

    def authenticate(self, request):
        return CentralAuthAuthentication().authenticate(request)

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

    Guard against the empty-string false-positive bug found live in C8:
    a non-staff CentralAuthUser (not relevant here — this service has no
    NonStaffIdentity-shaped caller today, but the guard costs nothing and
    keeps this helper correct if that ever changes) has neither `email`
    nor `employee_code`/`employee_id` claims — `Q(email='') |
    Q(employee_code='')` would otherwise match any row with a blank
    email/employee_code."""
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


def find_coordinator(user):
    from coordinator.models import Coordinator
    return _find(Coordinator, user)


# ── dual IsPrincipal — legacy delegates to the ORIGINAL class unchanged ────

class IsPrincipal(BasePermission):
    """Legacy: delegates to the original `users.permissions.IsPrincipal`
    unchanged (`request.user.is_principal()`, which `_TokenUser` supports
    natively). Central: resolvable via find_principal (local DB match) or
    the token's own is_superadmin claim — a superadmin should not be
    locked out of a principal-gated write, same precedent as every prior
    phase's dual role-classes bypassing on is_superadmin."""

    def has_permission(self, request, view):
        user = request.user
        if isinstance(user, CentralAuthUser):
            return bool(user.is_superadmin or find_principal(user) is not None)
        return _LegacyIsPrincipal().has_permission(request, view)


# ── central-id stamping / tenant scoping ────────────────────────────────────

def central_person_id(user):
    """The value to stamp into a central_*_id UUID column for the acting
    user's own identity (e.g. ClassTimeTable.central_created_by_id). None
    for a legacy token."""
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
