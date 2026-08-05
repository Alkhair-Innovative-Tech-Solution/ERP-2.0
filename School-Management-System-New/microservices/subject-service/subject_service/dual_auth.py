"""
Phase C4: dual-run auth/permission glue for subject-service. Same shape as
content-service's dual_auth.py (Phase C1) / fees-service's (Phase C2) /
result-service's (Phase C3) — see those files' docstrings for the two
underlying problems this solves (DRF authenticators raising instead of
returning None on a foreign token scheme; OrganizationMiddleware never
populating its contextvars for central-auth requests, so any
OrganizationManager-filtered `.objects` queryset silently returns empty on
that path).

Lives at the project-package level (not inside `subjects/` or
`assignments/`) because both apps need it — unlike C1/C2/C3 there is no
single "primary" app here.

subject-service's twist is different from C3's: permissions are simple
(views use only IsAuthenticated, no role-gate classes, no
HasDynamicPermission) — the real problem is that student/teacher/creator/
grader identity is stored as a bare `IntegerField` throughout
(`assignments/models.py`, `subjects/models.py`), populated directly from
`request.user.id`. A CentralAuthUser's `.id` is a UUID string — assigning
it to an `IntegerField` raises `ValueError` at save time. Every model got a
separate nullable `central_*_id` UUID column instead (see
docs/PHASE_C4_SUBJECT_SERVICE_RESULT.md's field audit) — this module's
`legacy_person_id`/`central_person_id` pair is the drop-in replacement for
every `<field>_id=user.id` call site.

`request.user.role` is also read directly throughout both apps'
`views.py`/`serializers.py` (`user.role == 'teacher'`/`'student'`) —
`CentralAuthUser` has no `.role` attribute at all (no principal_type claim
exists in central-auth tokens yet — same gap flagged since B3/C1/C2/C3).
`user_role()` below infers it: 'student' if the token wasn't minted from an
Employee (see `user_is_staff_principal`'s docstring), 'teacher' if staff-
shaped AND a matching staff-service Teacher row resolves via the same raw
psycopg2 lookup `subjects/views.py` already used for legacy teachers
(`_resolve_teacher_id`, now dual-safe and shared from here), otherwise None
(mirrors the legacy code's implicit "anyone who isn't teacher/student sees
everything" branch).
"""
import os
import jwt
from django.db.models import Q
from rest_framework.authentication import BaseAuthentication
from rest_framework.permissions import BasePermission

from ams_shared.jwt.validator import ServiceJWTAuthentication
from central_auth.authentication import CentralAuthAuthentication, CentralAuthUser


class DualAuthentication(BaseAuthentication):
    """Routes to CentralAuthAuthentication (RS256) or the legacy
    ServiceJWTAuthentication (HS256) based on the token's own `alg`
    header. Identical in shape to C1/C2/C3's version."""

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
    CentralAuthUser. Identical in shape to C1/C2/C3's version."""
    message = 'Your organization does not have an active SMS subscription.'

    def has_permission(self, request, view):
        user = request.user
        if not isinstance(user, CentralAuthUser):
            return True
        return bool(user.is_authenticated and user.has_service('sms'))


def DualRequiresPermission(codename: str):
    """No-op (True) for legacy tokens; enforces one sms.* codename for
    CentralAuthUser. Identical in shape to C1/C2/C3's version."""

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
    (staff) rather than a NonStaffIdentity (student) — central auth's
    jwt_utils.generate_access_token only adds employee_code/employee_id
    claims `if hasattr(user, 'employee_code')`; NonStaffIdentity (the model
    backing SMS student identities, Phase B2) has no such attribute, so a
    student token's employee_id claim is always empty. Only meaningful for
    CentralAuthUser; legacy tokens already say student/teacher/etc directly
    via .role."""
    return bool(getattr(user, 'employee_id', None))


def resolve_staff_teacher_id(user):
    """Raw-SQL lookup into staff_db's teachers_teacher table by
    employee_code — dual-safe version of subjects/views.py's original
    _resolve_teacher_id (identifier source is the only thing that changes:
    CentralAuthUser.employee_code vs legacy .username). Returns the
    staff-service Teacher PK (an int, NOT a central-auth id) or None."""
    identifier = user_identifier(user)
    if not identifier:
        return None
    try:
        import psycopg2
        conn = psycopg2.connect(
            host=os.environ.get('STAFF_DB_HOST', 'postgres-staff'),
            dbname=os.environ.get('STAFF_DB_NAME', 'staff_db'),
            user=os.environ.get('STAFF_DB_USER', 'staff_user'),
            password=os.environ.get('STAFF_DB_PASSWORD', 'staff_pass'),
            connect_timeout=5,
        )
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM teachers_teacher WHERE employee_code = %s AND is_deleted = false LIMIT 1",
                    (identifier,),
                )
                row = cur.fetchone()
                return row[0] if row else None
        finally:
            conn.close()
    except Exception:
        return None


def user_role(user):
    """Dual-safe drop-in for the `user.role` reads scattered through
    subjects/views.py and assignments/views.py (`user.role == 'teacher'`/
    `'student'`). Legacy: returns `.role` directly, unchanged. CentralAuthUser:
    best-effort inference (see module docstring) — 'student', 'teacher', or
    None (treated like legacy's implicit "everyone else sees everything")."""
    if not isinstance(user, CentralAuthUser):
        return getattr(user, 'role', None)
    if not user_is_staff_principal(user):
        return 'student'
    if resolve_staff_teacher_id(user) is not None:
        return 'teacher'
    return None


def get_org_and_tenant(user):
    """Returns (organization_instance_or_None, tenant_id_or_None) — dual-safe
    replacement for subjects/views.py's and assignments/views.py's original
    `_get_org(user)`. Legacy: resolves/creates the local Organization from
    `user.org_id`, unchanged; tenant_id always None (a central-auth-only
    mixin concept). CentralAuthUser: organization is always None (no org_id
    on this token, only tenant_id — same reasoning as C1's `_get_org`),
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


def legacy_person_id(user):
    """The value to stamp into a legacy bare-int identity field
    (student_id/created_by_id/graded_by_id/teacher_id/assigned_by_id) for
    the ACTING user's own identity. None for CentralAuthUser (its id is a
    UUID, can't go in an IntegerField — see central_person_id)."""
    return None if isinstance(user, CentralAuthUser) else getattr(user, 'id', None)


def central_person_id(user):
    """The value to stamp into the matching central_*_id UUID column for
    the acting user's own identity. None for a legacy token."""
    return user.id if isinstance(user, CentralAuthUser) else None


def central_tenant_qs(all_objects_manager, user):
    """Central-auth read path: explicit tenant filter, NOT the
    OrganizationManager-backed `.objects` default (see module docstring).
    Rows with tenant_id IS NULL (legacy-created, pre-migration) are
    included — same permissive-for-unscoped-rows precedent as C1/C2/C3."""
    if not user.tenant_id:
        return all_objects_manager.none()
    return all_objects_manager.filter(
        Q(tenant_id=user.tenant_id) | Q(tenant_id__isnull=True)
    )
