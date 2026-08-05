"""
Phase C3: dual-run auth/permission glue for result-service. Same shape as
content-service's dual_auth.py (Phase C1) / fees-service's (Phase C2) — see
those files' docstrings for the two underlying problems this solves (DRF
authenticators raising instead of returning None on a foreign token scheme;
OrganizationMiddleware never populating its contextvars for central-auth
requests, so any OrganizationManager-filtered `.objects` queryset silently
returns empty on that path).

result-service is more coupled than either prior service: almost every
endpoint is gated by one of FIVE role-based permission classes (IsTeacher,
IsCoordinator, IsCoordinatorOrAbove, IsPrincipal, IsStudent, from the shared
users.permissions), and views.py also calls the underlying role methods
directly in several places (ResultViewSet.get_queryset, BulkApproveView,
BulkRejectView) — not just in permission_classes. All of them call
request.user.is_teacher()/.is_coordinator()/.is_principal()/
.can_approve_requests() as METHODS or read request.user.role directly —
none of which exist in that shape on CentralAuthUser (is_superadmin is a
bool *attribute* there, not a method; there is no role/principal_type claim
in central-auth tokens at all yet — same gap flagged in B3/C1/C2).

Because central-auth tokens carry no role claim, "is this principal a
teacher/coordinator/principal" can't be read off the token directly. It's
resolved the same way views.py already resolves a person's local
Teacher/Coordinator/Principal row for ANY token — by matching
request.user.email, OR-ed with a staff identifier (CentralAuthUser
.employee_code for an Employee-backed principal; legacy _TokenUser
.username otherwise — CentralAuthUser has no .username at all, so the
existing `Q(email=...) | Q(employee_code=user.username)` lookups would
AttributeError on it unchanged).

Whether a CentralAuthUser is staff (Employee) at all vs a student
(NonStaffIdentity) is told apart by .employee_id: central-auth's
jwt_utils.generate_access_token only adds the employee_code/employee_id
claims `if hasattr(user, 'employee_code')` — NonStaffIdentity (the model
backing SMS student identities, Phase B2) has no such attribute, so a
student token's employee_id claim is always empty/absent. That's the only
signal available; there is still no principal_type claim, so this is a
best-effort inference, not a claim read — flagged in
docs/PHASE_C3_RESULT_SERVICE_RESULT.md.
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
    header. Identical in shape to C1/C2's version."""

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
    CentralAuthUser. Identical in shape to C1/C2's version."""
    message = 'Your organization does not have an active SMS subscription.'

    def has_permission(self, request, view):
        user = request.user
        if not isinstance(user, CentralAuthUser):
            return True
        return bool(user.is_authenticated and user.has_service('sms'))


def DualRequiresPermission(codename: str):
    """No-op (True) for legacy tokens; enforces one sms.* codename for
    CentralAuthUser. Identical in shape to C1/C2's version."""

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
# request.user is EITHER a real users.User / _TokenUser (legacy HS256 path,
# unchanged) OR a CentralAuthUser (new RS256 path). Every place views.py
# used to call user.is_superadmin()/.is_teacher()/.role directly now goes
# through these instead — the legacy branch in each is byte-for-byte what
# the code always did.

def user_is_superadmin(user) -> bool:
    if isinstance(user, CentralAuthUser):
        return user.is_superadmin  # attribute, not a method, on this class
    return user.is_superadmin()  # _TokenUser / User: method call, unchanged


def user_display_name(user) -> str:
    if isinstance(user, CentralAuthUser):
        return user.full_name or user.employee_code or str(user.id)
    return (user.get_full_name() or '').strip() or getattr(user, 'username', str(user.id))


def user_is_staff_principal(user) -> bool:
    """True if this CentralAuthUser token was minted from an Employee
    (staff) rather than a NonStaffIdentity (student) — see module
    docstring. Only meaningful for CentralAuthUser; legacy tokens already
    say student/teacher/etc. directly via .role."""
    return bool(getattr(user, 'employee_id', None))


def user_identifier(user):
    """Staff-lookup identifier: CentralAuthUser.employee_code for an
    Employee-backed principal, legacy .username otherwise (CentralAuthUser
    has no .username at all — this is the fix for the AttributeError the
    unchanged `Q(email=...) | Q(employee_code=user.username)` lookups would
    otherwise raise on it)."""
    if isinstance(user, CentralAuthUser):
        return user.employee_code
    return getattr(user, 'username', '')


def _find(model, user):
    """Teacher/Coordinator/Principal's own `.objects` is OrganizationManager-
    backed (the shared OrganizationMiddleware blind spot — see module
    docstring: its contextvars are never populated for central-auth
    requests, so `.objects.filter(...)` silently returns empty for a
    CentralAuthUser even when a matching row exists). Legacy tokens keep
    using `.objects` (org-scoped exactly as before, unchanged); CentralAuthUser
    uses `._base_manager` instead — necessary for the lookup to work at all.

    FLAGGED: `._base_manager` is NOT tenant-scoped. Teacher/Coordinator/
    Principal live in staff-service (out of scope to touch from a
    result-service-scoped phase — no tenant_id column exists there yet), so
    this lookup relies on email/employee_code being globally unique rather
    than an explicit per-tenant filter. A cross-tenant collision on either
    field would resolve to the wrong person. Same class of gap as C2's
    flagged PaymentViewSet.perform_create — noted, not silently left
    unmentioned. A future staff-service repoint should add tenant_id there
    and this lookup should filter by it too."""
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


# ── dual-safe role predicates ───────────────────────────────────────────────
# Drop-in replacements for the raw user.is_teacher()/.is_coordinator()/
# .is_principal()/.is_superuser calls views.py makes directly (not just in
# permission_classes — see ResultViewSet.get_queryset, BulkApproveView,
# BulkRejectView). Central-auth branch requires an active sms subscription
# in addition to the role match (there is no separate DualServiceSubscribed
# composed alongside these in permission_classes — folding the subscription
# gate in here keeps every call site, declarative or inline, correctly
# gated without having to touch each view's permission_classes list twice).

def user_is_superuser(user) -> bool:
    if isinstance(user, CentralAuthUser):
        return user.is_superadmin
    return getattr(user, 'is_superuser', False)


def user_is_teacher(user) -> bool:
    if isinstance(user, CentralAuthUser):
        return bool(
            user.has_service('sms')
            and user_is_staff_principal(user)
            and find_teacher(user) is not None
        )
    return user.is_teacher()


def user_is_coordinator(user) -> bool:
    if isinstance(user, CentralAuthUser):
        return bool(
            user.has_service('sms')
            and user_is_staff_principal(user)
            and find_coordinator(user) is not None
        )
    return user.is_coordinator()


def user_is_principal(user) -> bool:
    if isinstance(user, CentralAuthUser):
        return bool(
            user.has_service('sms')
            and user_is_staff_principal(user)
            and find_principal(user) is not None
        )
    return user.is_principal()


def user_can_approve_requests(user) -> bool:
    """Legacy: user.can_approve_requests() (role in superadmin/org_admin/
    principal/coordinator, or is_org_admin). NOTE: legacy _TokenUser (the
    object ServiceJWTAuthentication actually builds) has no
    can_approve_requests() method at all — calling it raises AttributeError
    today, a pre-existing bug this phase does not introduce and is out of
    scope to fix (see docs/PHASE_C3_RESULT_SERVICE_RESULT.md). Left
    byte-for-byte unchanged; only the CentralAuthUser branch is new."""
    if isinstance(user, CentralAuthUser):
        if not user.has_service('sms'):
            return False
        if user_is_superadmin(user):
            return True
        return user_is_staff_principal(user) and (
            find_coordinator(user) is not None or find_principal(user) is not None
        )
    return user.can_approve_requests()


# ── dual-safe versions of users.permissions' role-gate classes ─────────────

class DualIsTeacher(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user_is_teacher(user))


class DualIsCoordinator(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user_is_coordinator(user))


class DualIsPrincipal(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user_is_principal(user))


class DualIsCoordinatorOrAbove(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user_can_approve_requests(user))


class DualIsStudent(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if isinstance(user, CentralAuthUser):
            return bool(user.has_service('sms') and not user_is_staff_principal(user))
        return user.role == 'student'


# ── central-auth tenant-scoped queryset helper ──────────────────────────────
# Mirrors content-service's _tenant_scoped / fees-service's _central_tenant_qs:
# explicit tenant_id filter on the unfiltered base manager, NOT the
# OrganizationManager-backed `.objects` default (see module docstring — its
# contextvars are never populated for central-auth requests). Rows with
# tenant_id IS NULL (legacy-created, pre-migration) are included — same
# permissive-for-unscoped-rows precedent as C1/C2.

def central_tenant_qs(all_objects_manager, user):
    if not user.tenant_id:
        return all_objects_manager.none()
    return all_objects_manager.filter(
        Q(tenant_id=user.tenant_id) | Q(tenant_id__isnull=True)
    )
