"""
Phase C12: dual-run auth/permission glue for staff-service. Same shapes as
C1-C11 (DualAuthentication routes legacy HS256 vs central RS256 by the
token's own `alg` header; DualServiceSubscribed/DualRequiresPermission
gate on the central token's `sms` service/perm claims, no-op for legacy).

staff-service vendors the EXACT SAME `users/permissions.py`+`users/models.py`
shape C11 (org-service) dealt with (both trace back to the same
auth-service `users` app) — same two crash classes on a raw
CentralAuthUser, confirmed again here:

1. `is_superadmin` shape mismatch: this User model (and ams_shared's
   `_TokenUser`) define it as a CALLABLE; CentralAuthUser defines it as a
   plain bool claim. `request.user.is_superadmin()` -> TypeError on a raw
   CentralAuthUser.
2. No `.role`, `.is_org_admin_role()`, `.is_principal()`, `.is_coordinator()`,
   `.is_teacher()`, `.is_admin()`, `.is_student()`, `.can_manage_campus()`,
   `.can_approve_requests()`, `.can_view_all_data()` on CentralAuthUser at
   all — AttributeError on every one of the many inline call sites across
   teachers/principals/coordinator's views.py (and users/middleware.py's
   own manual-auth fallback, and OrganizationManager/TeacherManager/
   PrincipalManager/CoordinatorManager's get_queryset()).

Reusing C11's fix exactly: StaffCentralAuthUser, a CentralAuthUser
subclass DualAuthentication returns instead of the raw class.
isinstance(x, CentralAuthUser) stays True everywhere (nothing else needs
to change); every existing permission class in users/permissions.py
(IsSuperAdmin, IsSuperAdminOrPrincipal, IsNotDonorForWrites, etc.) works
UNCHANGED for a central token — that file is never touched.

`_BoolCallable`: `.is_superadmin` must be both a bool (CentralAuthUser's
own inherited `has_service()`/`has_perm()` read it via `self.is_superadmin
or ...` — truthiness) and callable (`.is_superadmin()`, every vendored
role-check convention) from the SAME underlying flag. See C11's
docs/PHASE_C11_ORG_SERVICE_RESULT.md for why naively overwriting the
attribute with a method/lambda breaks subscription checks (always-truthy
function object).

Fail-closed, per this phase's own instruction ("Don't invent catalog
perms — flag gaps (fail closed)"): staff-service's role concepts
(org_admin/principal/coordinator/teacher/admin/donor) have no equivalent
in central auth's SMS catalog today (same finding as C11 — see
permissions/sms_catalog.py, only "SMS Student" is wired; staff-role RBAC
is still deferred). A central token satisfies IsSuperAdmin here and
nothing else; IsSuperAdminOrPrincipal's central branch is therefore
is_superadmin-only too (the admin/org_admin/principal branches of that
OR all fail closed). IsNotDonorForWrites is naturally safe either way:
StaffCentralAuthUser.role is None, which never equals 'donor', so it
never incorrectly blocks a non-donor central token — and SAFE_METHODS are
allowed unconditionally regardless.
"""
from django.db.models import Q
from rest_framework.authentication import BaseAuthentication
from rest_framework.permissions import BasePermission

from central_auth.authentication import CentralAuthAuthentication, CentralAuthUser


class _BoolCallable:
    """Behaves as a bool in a truthy/`or` context (`__bool__`) AND as a
    zero-arg callable returning that same bool (`__call__`)."""

    __slots__ = ('_value',)

    def __init__(self, value):
        self._value = bool(value)

    def __bool__(self):
        return self._value

    def __call__(self):
        return self._value

    def __repr__(self):
        return repr(self._value)


class StaffCentralAuthUser(CentralAuthUser):
    """See module docstring. A CentralAuthUser wrapped to duck-type
    this service's own User/_TokenUser role-check interface."""

    def __init__(self, claims: dict):
        super().__init__(claims)
        self.is_superadmin = _BoolCallable(self.is_superadmin)
        self.role = None
        self.organization = None  # no tenant_id column on this service's vendored Organization model — see result doc
        self.org_id = None
        self.is_org_admin = False
        self.is_active = True
        self.is_anonymous = False
        self.is_deleted = False
        self.pk = self.id
        self.username = self.employee_code or self.email or str(self.id)
        self.has_changed_default_password = True

    def is_org_admin_role(self):
        return False

    def is_principal(self):
        return False

    def is_coordinator(self):
        return False

    def is_teacher(self):
        return False

    def is_admin(self):
        return False

    def is_student(self):
        return False

    def can_manage_campus(self):
        return bool(self.is_superadmin)

    def can_approve_requests(self):
        return bool(self.is_superadmin)

    def can_view_all_data(self):
        return bool(self.is_superadmin)

    def get_role_display(self):
        return 'Central Auth'

    def get_full_name(self):
        return self.full_name or self.employee_code

    def get_short_name(self):
        return self.full_name or self.employee_code

    def has_perm(self, perm, obj=None):
        return bool(self.is_superadmin)

    def has_module_perms(self, app_label):
        return bool(self.is_superadmin)


class DualAuthentication(BaseAuthentication):
    """Phase D-R4: HS256 (legacy ServiceJWTAuthentication) verification
    removed — central auth (RS256, wrapped in StaffCentralAuthUser) is the
    only live path. See docs/PHASE_D_R4R6_REMOVAL_RESULT.md."""

    def authenticate(self, request):
        result = CentralAuthAuthentication().authenticate(request)
        if result is None:
            return None
        raw_user, tok = result
        return StaffCentralAuthUser(raw_user.claims), tok

    def authenticate_header(self, request):
        return 'Bearer'


class DualServiceSubscribed(BasePermission):
    """No-op (True) for legacy tokens; enforces sms subscription for
    CentralAuthUser. Identical in shape to C1-C11's version."""
    message = 'Your organization does not have an active SMS subscription.'

    def has_permission(self, request, view):
        user = request.user
        if not isinstance(user, CentralAuthUser):
            return True
        return bool(user.is_authenticated and user.has_service('sms'))


def DualRequiresPermission(codename: str):
    """No-op (True) for legacy tokens; enforces one sms.* codename for
    CentralAuthUser. Defined for parity with C1-C11 — not wired into any
    staff-service view this phase (role-based gates, not permission-
    codename-based; no catalog codename maps to staff-tier concepts)."""

    class _DualRequiresPermission(BasePermission):
        message = f'Missing required permission: {codename}.'

        def has_permission(self, request, view):
            user = request.user
            if not isinstance(user, CentralAuthUser):
                return True
            return bool(user.is_authenticated and user.has_perm(codename))

    _DualRequiresPermission.__name__ = f'DualRequiresPermission_{codename}'
    return _DualRequiresPermission


def central_person_id(user):
    """The value to stamp into a central_*_id UUID column for the acting
    user's own identity. None for a legacy token."""
    return user.id if isinstance(user, CentralAuthUser) else None


def central_tenant_qs(all_objects_manager, user):
    """Central-auth read path: explicit tenant_id filter on the model's
    OWN tenant_id column (Teacher/Principal/Coordinator each get one this
    phase), NOT the OrganizationManager-backed `.objects` default — that
    manager depends on OrganizationMiddleware's thread-local context vars
    (fixed to at least populate a StaffCentralAuthUser this phase — see
    users_override/middleware.py — but its role-branching still can't
    express "central superadmin" without also patching the manager, out
    of scope here). Rows with tenant_id IS NULL (legacy-created,
    pre-migration) are included — same permissive-for-unscoped-rows
    precedent as C1-C11."""
    if not isinstance(user, CentralAuthUser):
        return all_objects_manager.none()
    if user.is_superadmin:
        return all_objects_manager.all()
    if not user.tenant_id:
        return all_objects_manager.none()
    return all_objects_manager.filter(
        Q(tenant_id=user.tenant_id) | Q(tenant_id__isnull=True)
    )
