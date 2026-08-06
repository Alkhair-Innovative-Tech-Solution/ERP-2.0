"""
Phase C8: dual-run auth/permission glue for student-service. Same shape as
content-service's dual_auth.py (Phase C1) / fees-service's (C2) /
result-service's (C3) / subject-service's (C4) / campus-service's (C5) /
support-service's (C6) / notification-service's (C7) — see those files'
docstrings for the two underlying problems this solves (DRF authenticators
raising instead of returning None on a foreign token scheme;
OrganizationMiddleware never populating its contextvars for central-auth
requests, so any OrganizationManager-filtered `.objects` queryset silently
returns empty on that path).

Lives at the project-package level (not inside `students/`) — same
reasoning as C4-C7's project-level dual_auth.py (this service has several
peer apps — students/behaviour/student_status — none of them "primary").

**THIS IS THE MOST IDENTITY-SENSITIVE SERVICE SO FAR.** `Student.user` is a
real OneToOneField to `users.User` — the actual student identity, imported
centrally in Phase B2 as a `NonStaffIdentity` keyed by `legacy_user_id`
(the original local `users.User.id`). `Student.central_user_id` (added this
phase) is a precomputed, backfilled mirror of that identity's central UUID
— populated OFFLINE by `students/management/commands/remap_central_user_ids.py`
(never at request time), via an EXACT `legacy_user_id` match, never a fuzzy
one (a wrong link here would point a real student record at the wrong
central identity). At request time, a central-auth student token's own
`user.id` claim already equals that same UUID (it *is* the
`NonStaffIdentity`'s own primary key) — so self-service scoping is simply
`Student.all_objects.filter(central_user_id=user.id)`, no further
resolution needed once the backfill has run.

student-service also vendors Teacher/Coordinator/Principal locally
(Dockerfile-copied from staff-service, same as C3/C6) for the
teacher/coordinator/principal-gated permission classes below — same local
DB-match technique (email or employee_code) established in C3, reused
unchanged in C6, reused again here.
"""
import jwt
from django.db.models import Q
from rest_framework.authentication import BaseAuthentication
from rest_framework.permissions import BasePermission

from ams_shared.jwt.validator import ServiceJWTAuthentication
from central_auth.authentication import CentralAuthAuthentication, CentralAuthUser
from users.permissions import (
    IsStudent as _LegacyIsStudent,
    IsTeacherOrAbove as _LegacyIsTeacherOrAbove,
    IsCoordinatorOrAbove as _LegacyIsCoordinatorOrAbove,
    IsSuperAdminOrPrincipal as _LegacyIsSuperAdminOrPrincipal,
    HasDynamicPermission as _LegacyHasDynamicPermission,
)


class DualAuthentication(BaseAuthentication):
    """Routes to CentralAuthAuthentication (RS256) or the legacy
    ServiceJWTAuthentication (HS256) based on the token's own `alg`
    header. Identical in shape to C1-C7's version."""

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
    CentralAuthUser. Identical in shape to C1-C7's version."""
    message = 'Your organization does not have an active SMS subscription.'

    def has_permission(self, request, view):
        user = request.user
        if not isinstance(user, CentralAuthUser):
            return True
        return bool(user.is_authenticated and user.has_service('sms'))


def DualRequiresPermission(codename: str):
    """No-op (True) for legacy tokens; enforces one sms.* codename for
    CentralAuthUser. Identical in shape to C1-C7's version."""

    class _DualRequiresPermission(BasePermission):
        message = f'Missing required permission: {codename}.'

        def has_permission(self, request, view):
            user = request.user
            if not isinstance(user, CentralAuthUser):
                return True
            return bool(user.is_authenticated and user.has_perm(codename))

    _DualRequiresPermission.__name__ = f'DualRequiresPermission_{codename}'
    return _DualRequiresPermission


# ── staff (teacher/coordinator/principal) resolution — C3/C6 pattern ───────

def user_identifier(user):
    if isinstance(user, CentralAuthUser):
        return user.employee_code
    return getattr(user, 'username', '')


def user_display_name(user) -> str:
    if isinstance(user, CentralAuthUser):
        return user.full_name or user.employee_code or str(user.id)
    return getattr(user, 'username', str(getattr(user, 'id', '')))


def _find(model, user):
    """FLAGGED: `._base_manager` is NOT tenant-scoped. Teacher/Coordinator/
    Principal live in staff-service (out of scope to touch from a
    student-service-scoped phase — no tenant_id column exists there yet),
    same residual gap flagged in C3/C4/C6's dual_auth.py."""
    manager = model._base_manager if isinstance(user, CentralAuthUser) else model.objects
    return manager.filter(
        Q(email=user.email) | Q(employee_code=user_identifier(user))
    ).first()


def find_teacher(user):
    from teachers.models import Teacher
    return _find(Teacher, user)


def find_coordinator(user):
    from coordinator.models import Coordinator
    return _find(Coordinator, user)


def find_principal(user):
    from principals.models import Principal
    return _find(Principal, user)


# ── student identity resolution — the core of this phase ───────────────────

def find_student(user):
    """The central-auth counterpart of find_teacher/find_coordinator/
    find_principal above, but for the SUBJECT identity, not a staff actor:
    resolves a CentralAuthUser token to ITS OWN Student row via the
    precomputed, exact `central_user_id` backfill (see module docstring).
    Deliberately does NOT fall back to any fuzzy match (name/email/
    identity_code) — an unmatched student token means the backfill hasn't
    run for that student yet; returning None (and therefore denying
    self-service access) is the correct, safe behavior, not a bug to work
    around. `Student.all_objects` bypasses StudentManager (OrganizationManager
    blind spot, same as every prior phase)."""
    from students.models import Student
    if not isinstance(user, CentralAuthUser):
        return None
    return Student.all_objects.filter(central_user_id=user.id, is_deleted=False).first()


# ── dual role-classes — legacy delegates to the ORIGINAL classes unchanged ─

class IsStudent(BasePermission):
    """Central: resolvable via find_student (central_user_id match) — the
    strongest possible signal (an actual resolved local record), not just
    trusting the token's own `person_type` claim. Legacy: delegates to the
    original `users.permissions.IsStudent` unchanged."""

    def has_permission(self, request, view):
        user = request.user
        if isinstance(user, CentralAuthUser):
            return find_student(user) is not None
        return _LegacyIsStudent().has_permission(request, view)


class IsTeacherOrAbove(BasePermission):
    """Legacy: role in [superadmin, admin, org_admin, principal,
    coordinator, teacher, accounts_officer, donor] — delegates to the
    original class unchanged. Central: only the tiers resolvable via a
    local DB match or the token's own is_superadmin claim are honored —
    superadmin, principal, coordinator, teacher. `admin`/`org_admin`/
    `accounts_officer`/`donor` have no local table to match against and no
    claim on CentralAuthUser (same gap flagged since B3) — FLAGGED, fails
    closed (not granted) rather than guessed at."""

    def has_permission(self, request, view):
        user = request.user
        if isinstance(user, CentralAuthUser):
            return bool(
                user.is_superadmin
                or find_teacher(user)
                or find_coordinator(user)
                or find_principal(user)
            )
        return _LegacyIsTeacherOrAbove().has_permission(request, view)


class IsCoordinatorOrAbove(BasePermission):
    """Legacy: delegates to `user.can_approve_requests()` unchanged (role in
    [superadmin, org_admin, principal, coordinator] or is_org_admin).
    Central: is_superadmin claim, or a resolvable coordinator/principal.
    `org_admin` has no local resolution — FLAGGED, fails closed."""

    def has_permission(self, request, view):
        user = request.user
        if isinstance(user, CentralAuthUser):
            return bool(user.is_superadmin or find_coordinator(user) or find_principal(user))
        return _LegacyIsCoordinatorOrAbove().has_permission(request, view)


class IsSuperAdminOrPrincipal(BasePermission):
    """Legacy: delegates to the original class unchanged (is_superadmin, or
    role in [admin, org_admin], or is_principal). Central: is_superadmin
    claim, or a resolvable principal. `admin`/`org_admin` have no local
    resolution — FLAGGED, fails closed."""

    def has_permission(self, request, view):
        user = request.user
        if isinstance(user, CentralAuthUser):
            return bool(user.is_superadmin or find_principal(user))
        return _LegacyIsSuperAdminOrPrincipal().has_permission(request, view)


class HasDynamicPermission(BasePermission):
    """Legacy: delegates to the original class unchanged (superadmin/
    org_admin bypass, else DB-backed RolePermission lookup keyed on
    `view.required_permission`, or allow if the view sets no
    `required_permission` at all — see `users/permissions.py`). Central:
    is_superadmin bypass; if the view sets `required_permission`, checks it
    against the central catalog via `user.has_perm(codename)` (mirrors
    DualRequiresPermission); otherwise allows, matching the legacy no-op
    fallback for the same "no permission specified" case. `org_admin` has
    no local resolution on this path — FLAGGED, fails closed (not bypassed)."""

    def has_permission(self, request, view):
        user = request.user
        if isinstance(user, CentralAuthUser):
            if user.is_superadmin:
                return True
            codename = getattr(view, 'required_permission', None)
            if not codename:
                return True
            return bool(user.is_authenticated and user.has_perm(codename))
        return _LegacyHasDynamicPermission().has_permission(request, view)


# ── central-id stamping / tenant scoping ────────────────────────────────────

def central_person_id(user):
    """The value to stamp into a central_*_id UUID column for the acting
    staff member's own identity (e.g. EnrollmentEvent.central_created_by_id,
    EnrollmentStatusRequest.central_requested_by_id/central_reviewed_by_id).
    None for a legacy token. NOT used for Student.central_user_id itself —
    that's the SUBJECT's identity, populated by the offline remap command,
    never by the acting request's own token."""
    return user.id if isinstance(user, CentralAuthUser) else None


def get_org_and_tenant(user):
    """Returns (organization_instance_or_None, tenant_id_or_None). Legacy:
    resolves/creates the local Organization from user.org_id (mirrors every
    prior phase's helper), unchanged; tenant_id always None. CentralAuthUser:
    organization always None (no org_id on this token, only tenant_id),
    tenant_id from the token."""
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
    included — same permissive-for-unscoped-rows precedent as C1-C7."""
    if not user.tenant_id:
        return all_objects_manager.none()
    return all_objects_manager.filter(
        Q(tenant_id=user.tenant_id) | Q(tenant_id__isnull=True)
    )
