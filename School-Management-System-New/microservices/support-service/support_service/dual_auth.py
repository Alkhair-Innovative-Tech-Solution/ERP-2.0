"""
Phase C6: dual-run auth/permission glue for support-service. Same shape as
content-service's dual_auth.py (Phase C1) / fees-service's (C2) /
result-service's (C3) / subject-service's (C4) / campus-service's (C5) —
see those files' docstrings for the two underlying problems this solves
(DRF authenticators raising instead of returning None on a foreign token
scheme; OrganizationMiddleware never populating its contextvars for
central-auth requests, so any OrganizationManager-filtered `.objects`
queryset silently returns empty on that path).

Lives at the project-package level (not inside `requests/` or
`form_builder/`) — same reasoning as C4/C5's project-level dual_auth.py,
both apps need it, neither is "primary". (Also: naming it `requests/dual_auth.py`
would sit inside the app literally named `requests` — see central_auth/jwks.py's
docstring on that collision; project-level avoids ever needing to reason
about it here too.)

support-service's shape is closest to C3 (result-service): three person
role-FKs (teacher/coordinator/principal, all real FKs to vendored
Teacher/Coordinator/Principal models) with role determined by calling
`request.user.is_teacher()`/`.is_coordinator()`/`.is_principal()`/
`.is_superuser` — but unlike C3, permissions are simple (`IsAuthenticated`
only, no role-gate DRF permission classes, like C4/C5) — the role checks
are all inline in view/serializer function bodies, not permission classes.
`CentralAuthUser` has none of those methods/attributes in that shape
(`is_superadmin` is a bool *attribute*, not a method; there is no
`is_teacher`/`is_coordinator`/`is_principal`/`is_superuser` at all — no
role/principal_type claim exists in central-auth tokens yet, same gap
flagged since B3/C1-C5). The dual-safe predicates below are drop-in
replacements for those exact call sites, resolved the same way C3 resolved
them: via a local Teacher/Coordinator/Principal DB match (email or
employee_code) — support-service vendors all three (Dockerfile-copied from
staff-service), same as result-service did.
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
    header. Identical in shape to C1-C5's version."""

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
    CentralAuthUser. Identical in shape to C1-C5's version."""
    message = 'Your organization does not have an active SMS subscription.'

    def has_permission(self, request, view):
        user = request.user
        if not isinstance(user, CentralAuthUser):
            return True
        return bool(user.is_authenticated and user.has_service('sms'))


def DualRequiresPermission(codename: str):
    """No-op (True) for legacy tokens; enforces one sms.* codename for
    CentralAuthUser. Identical in shape to C1-C5's version."""

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

def user_identifier(user):
    """Staff-lookup identifier: CentralAuthUser.employee_code for an
    Employee-backed principal, legacy .username otherwise (CentralAuthUser
    has no .username at all)."""
    if isinstance(user, CentralAuthUser):
        return user.employee_code
    return getattr(user, 'username', '')


def user_display_name(user) -> str:
    if isinstance(user, CentralAuthUser):
        return user.full_name or user.employee_code or str(user.id)
    return getattr(user, 'username', str(getattr(user, 'id', '')))


def user_is_staff_principal(user) -> bool:
    """True if this CentralAuthUser token was minted from an Employee
    (staff) rather than a NonStaffIdentity (student) — see C3's dual_auth.py
    for the original version of this inference, reused unchanged here."""
    return bool(getattr(user, 'employee_id', None))


def _find(model, user):
    """Teacher/Coordinator/Principal's own `.objects` is OrganizationManager-
    backed — empty for a central-auth request (see module docstring: its
    contextvars are never populated on that path). Legacy tokens keep using
    `.objects` (org-scoped exactly as before, unchanged); CentralAuthUser
    uses `._base_manager` instead — necessary for the lookup to work at all.

    FLAGGED: `._base_manager` is NOT tenant-scoped. Teacher/Coordinator/
    Principal live in staff-service (out of scope to touch from a
    support-service-scoped phase — no tenant_id column exists there yet),
    same residual gap flagged in C3/C4/C5's dual_auth.py."""
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


def get_coordinator(user):
    """Dual-safe replacement for `coordinator.models.Coordinator.get_for_user(user)`.
    Legacy: delegates to the original classmethod UNCHANGED (byte-for-byte
    same lookup order — employee_code first, then email — not reimplemented
    here, to avoid even a theoretical behavior difference on the path that
    must stay untouched). CentralAuthUser: `Coordinator.get_for_user`'s own
    `.objects` calls would always return empty for this token type (same
    blind spot as _find above) — uses find_coordinator (_base_manager)
    instead. Returns None if no match, same contract as the original."""
    from coordinator.models import Coordinator
    if isinstance(user, CentralAuthUser):
        return find_coordinator(user)
    return Coordinator.get_for_user(user)


def find_principal_for_campus(campus, user):
    """Dual-safe replacement for `Principal.objects.get(campus=..., is_currently_active=True)`
    (requests/views.py's forward_to_principal) — same OrganizationManager
    blind spot as _find above, but keyed by campus, not the acting user's
    own identity, so it's a separate helper rather than a _find() variant."""
    from principals.models import Principal
    manager = Principal._base_manager if isinstance(user, CentralAuthUser) else Principal.objects
    return manager.filter(campus=campus, is_currently_active=True).first()


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


def user_is_superuser(user) -> bool:
    """Dual-safe drop-in for the raw `user.is_superuser` ATTRIBUTE read in
    requests/views.py (get_request_detail, add_comment) — CentralAuthUser
    has no .is_superuser at all (only the differently-named .is_superadmin
    bool). Legacy _TokenUser has .is_superuser as a plain attribute, not a
    method — matches the original `not user.is_superuser` shape exactly."""
    if isinstance(user, CentralAuthUser):
        return user.is_superadmin
    return getattr(user, 'is_superuser', False)


def teacher_assigned_coordinators(teacher):
    """teacher.assigned_coordinators (a forward ManyToManyField to
    Coordinator) uses Coordinator.objects — OrganizationManager-backed — as
    its related manager's queryset under the hood, the same blind spot as
    everywhere else in this module for a central-auth request. Confirmed
    in Phase C3/C4 (same M2M field, same Teacher model). Query the through
    table directly instead, which isn't manager-filtered."""
    through = teacher.assigned_coordinators.through
    coordinator_ids = through._base_manager.filter(teacher_id=teacher.id).values_list('coordinator_id', flat=True)
    from coordinator.models import Coordinator
    return Coordinator._base_manager.filter(id__in=coordinator_ids)


def get_org_and_tenant(user):
    """Returns (organization_instance_or_None, tenant_id_or_None). Legacy:
    resolves/creates the local Organization from user.org_id (mirrors every
    prior phase's _get_org), unchanged; tenant_id always None (a
    central-auth-only mixin concept). CentralAuthUser: organization is
    always None (no org_id on this token, only tenant_id), tenant_id from
    the token."""
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
    included — same permissive-for-unscoped-rows precedent as C1-C5."""
    if not user.tenant_id:
        return all_objects_manager.none()
    return all_objects_manager.filter(
        Q(tenant_id=user.tenant_id) | Q(tenant_id__isnull=True)
    )
