"""
Phase C10: dual-run auth/permission glue for attendance-service. Same shape
as content-service's dual_auth.py (Phase C1) / fees-service's (C2) /
result-service's (C3) / subject-service's (C4) / campus-service's (C5) /
support-service's (C6) / notification-service's (C7) / student-service's
(C8) / timetable-service's (C9) — see those files' docstrings for the two
underlying problems this solves (DRF authenticators raising instead of
returning None on a foreign token scheme; OrganizationMiddleware never
populating its contextvars for central-auth requests, so any
OrganizationManager-filtered `.objects` queryset silently returns empty on
that path).

Lives at the project-package level (not inside `attendance/`) — same
reasoning as C4-C9's project-level dual_auth.py (`attendance`,
`notifications` are peer apps, neither "primary").

This is the most person-FK-heavy service so far: the `Attendance` workflow
(marked/created/updated/deleted/submitted/reviewed/finalized/reopened by)
has 8 audit-trail person-FKs, plus 2 more on `StudentAttendance`
(created_by/updated_by) — see attendance/models.py's CentralAuthFieldsMixin
docstring and the field audit table in
docs/PHASE_C10_ATTENDANCE_SERVICE_RESULT.md. Permissions are otherwise
simple: IsAuthenticated on function-based views, no DRF role classes wired
into the routed workflow endpoints except `HasAttendanceViewPermission`
(the "Unified Attendance Review" endpoint) — `DualHasAttendanceViewPermission`
below is this phase's only dual permission class.

attendance-service already vendors `teachers`/`coordinator`/`principals`/
`students` locally (Dockerfile-copied from staff-service/student-service,
same as C3/C6/C8/C9) — reused here for `find_teacher`/`find_coordinator`/
`find_principal`, same local DB-match technique (email or employee_code)
established in C3, carried unchanged through every phase since.
"""
from django.db.models import Q
from rest_framework.authentication import BaseAuthentication
from rest_framework.permissions import BasePermission

from central_auth.authentication import CentralAuthAuthentication, CentralAuthUser


class DualAuthentication(BaseAuthentication):
    """Phase D-R4: HS256 (legacy ServiceJWTAuthentication) verification
    removed — central auth (RS256) is the only live path (confirmed via
    R1-R3/blockers-clear: frontend rebuilt on NEXT_PUBLIC_AUTH_SOURCE=central,
    auth-8001 stopped, zero HS256 issuance reaching this service). Delegates
    straight to CentralAuthAuthentication; kept the class name/shape
    (still a thin BaseAuthentication wrapper) to avoid rippling a rename
    through settings.py. See docs/PHASE_D_R4R6_REMOVAL_RESULT.md."""

    def authenticate(self, request):
        return CentralAuthAuthentication().authenticate(request)

    def authenticate_header(self, request):
        return 'Bearer'


class DualServiceSubscribed(BasePermission):
    """No-op (True) for legacy tokens; enforces sms subscription for
    CentralAuthUser. Identical in shape to C1-C9's version."""
    message = 'Your organization does not have an active SMS subscription.'

    def has_permission(self, request, view):
        user = request.user
        if not isinstance(user, CentralAuthUser):
            return True
        return bool(user.is_authenticated and user.has_service('sms'))


def DualRequiresPermission(codename: str):
    """No-op (True) for legacy tokens; enforces one sms.* codename for
    CentralAuthUser. Identical in shape to C1-C9's version.

    NOT used by this phase's workflow endpoints: the sms.* catalog
    (permissions.sms_catalog.SMS_PERMISSIONS on the auth-service side) has
    no attendance-shaped permission at all (only sms.assignment.*/
    sms.fee.*/sms.result.view exist) — confirmed by reading the catalog
    file directly. Fabricating `sms.attendance.mark`/`.review`/etc. would
    violate the "don't invent catalog perms" rule, so the workflow gates
    below use local-DB role resolution (find_teacher/find_coordinator/
    find_principal) instead, same as C9's dual `IsPrincipal` did when no
    sms.timetable.* codename existed either. Kept here anyway (byte-for-byte
    template reuse) in case a future phase's endpoint DOES map to a real
    catalog entry."""

    class _DualRequiresPermission(BasePermission):
        message = f'Missing required permission: {codename}.'

        def has_permission(self, request, view):
            user = request.user
            if not isinstance(user, CentralAuthUser):
                return True
            return bool(user.is_authenticated and user.has_perm(codename))

    _DualRequiresPermission.__name__ = f'DualRequiresPermission_{codename}'
    return _DualRequiresPermission


# ── staff (teacher/coordinator/principal) resolution — C3/C6/C8/C9 pattern ──

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
    Principal live in staff-service (out of scope to touch from an
    attendance-service-scoped phase — no tenant_id column exists there
    yet), same residual gap flagged in C3/C4/C6/C8/C9's dual_auth.py.

    Guard against the empty-string false-positive bug found live in C8: a
    non-staff CentralAuthUser (not relevant here today — this service has
    no NonStaffIdentity-shaped caller, but the guard costs nothing and
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


def find_coordinator(user):
    from coordinator.models import Coordinator
    return _find(Coordinator, user)


def find_principal(user):
    from principals.models import Principal
    return _find(Principal, user)


# ── dual HasAttendanceViewPermission — legacy delegates unchanged ──────────

class DualHasAttendanceViewPermission(BasePermission):
    """Gate for the Unified Attendance Review endpoint
    (attendance/services/review_view.py) and its siblings.

    Legacy: delegates to the original `attendance.permissions
    .HasAttendanceViewPermission` unchanged (the RolePermission-table
    `view_attendance` toggle read cross-DB from auth_db — untouched).

    Central: there is no `view_attendance`-toggle equivalent in the
    central-auth catalog (no sms.attendance.* permission exists at all —
    see DualRequiresPermission's docstring), so this resolves the same way
    C9's dual `IsPrincipal` did: is_superadmin claim, or a resolvable
    teacher/coordinator/principal via local DB match. This is coarser than
    the legacy per-role toggle (which an Org Admin can turn off per role)
    — FLAGGED: a central-auth org that has revoked `view_attendance` for
    teachers via the legacy toggle has no way to express that same
    revocation centrally yet. Fails open only as far as "any resolvable
    staff role", never to an unresolvable/unknown caller.
    """
    message = 'You do not have permission to view attendance records.'

    def has_permission(self, request, view):
        user = request.user
        if isinstance(user, CentralAuthUser):
            return bool(
                user.is_superadmin
                or find_teacher(user)
                or find_coordinator(user)
                or find_principal(user)
            )
        from attendance.permissions import HasAttendanceViewPermission as _LegacyHasAttendanceViewPermission
        return _LegacyHasAttendanceViewPermission().has_permission(request, view)


# ── central-id stamping / tenant scoping ────────────────────────────────────

def central_person_id(user):
    """The value to stamp into a central_*_id UUID column for the acting
    user's own identity (e.g. Attendance.central_marked_by_id,
    Attendance.central_submitted_by_id, ...). None for a legacy token."""
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
    included — same permissive-for-unscoped-rows precedent as C1-C9."""
    if not user.tenant_id:
        return all_objects_manager.none()
    return all_objects_manager.filter(
        Q(tenant_id=user.tenant_id) | Q(tenant_id__isnull=True)
    )
