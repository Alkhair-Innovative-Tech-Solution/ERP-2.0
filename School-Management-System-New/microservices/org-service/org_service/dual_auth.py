"""
Phase C11: dual-run auth/permission glue for org-service. Same underlying
shapes as C1-C10's dual_auth.py (DualAuthentication routes legacy HS256 vs
central RS256 by the token's own `alg` header; DualServiceSubscribed/
DualRequiresPermission gate on the central token's `sms` service/perm
claims, no-op for legacy) — see those files' docstrings for the two
recurring problems this whole family solves.

org-service needed one more piece those didn't: **OrgCentralAuthUser**.

## Why a wrapper subclass, not new dual-role-classes (the "C3 pattern")

Every prior phase's role gating lived cleanly inside a handful of DRF
permission classes, so "dual-safe" meant writing a parallel dual class per
role and swapping the import. org-service's role checks are NOT
contained that way — audited across users/views.py, users/middleware.py,
and users/managers.py: ~40 inline call sites do `request.user.is_superadmin()`,
`request.user.role == 'org_admin'`, `request.user.is_org_admin_role()`,
etc., directly in view bodies, in OrganizationMiddleware's manual
authentication fallback, and in OrganizationManager/MultiTenantUserManager's
get_queryset(). A handful of new permission classes would leave every one
of those call sites still crashing on a raw CentralAuthUser:

- `.is_superadmin` is a plain bool CLAIM on CentralAuthUser (`self.is_superadmin
  = bool(claims.get(...))`), but org-service's OWN User model AND
  ams_shared's `_TokenUser` both define it as a CALLABLE (`def
  is_superadmin(self): return self.role == 'superadmin'`) — every
  `request.user.is_superadmin()` call site would raise `TypeError: 'bool'
  object is not callable'`.
- `.role`, `.is_org_admin_role()`, `.is_principal()`, `.is_coordinator()`,
  `.is_teacher()`, `.is_admin()` don't exist on CentralAuthUser at all —
  AttributeError. This is the exact `is_org_admin_role()` crash class this
  phase's prompt named up front.

Rather than hunt down and patch ~40 call sites (some of which are in
shared infrastructure, not views — the middleware and manager layer would
need separate fixes anyway), DualAuthentication returns this ONE adapter
subclass for a central token instead of the raw CentralAuthUser.
`isinstance(x, CentralAuthUser)` stays True everywhere (DualServiceSubscribed,
DualRequiresPermission, central_person_id, etc. — nothing else needs to
change), while `request.user` now duck-types exactly the interface
org-service's own code already expects from a real User/_TokenUser. Every
existing `permissions.py` role class (IsSuperAdmin, IsOrgAdmin, IsPrincipal,
IsCoordinator, IsTeacher, IsAdmin) therefore works UNCHANGED for a central
token too — imported and used as-is, no parallel dual classes needed, no
permissions.py edit needed.

## The `_BoolCallable` trick

`CentralAuthAuthentication`'s own `has_service()`/`has_perm()` (inherited
unchanged) reference `self.is_superadmin` as a plain bool via truthiness
(`return self.is_superadmin or ...`). Simply overwriting `self.is_superadmin`
with a bound method/lambda would make it ALWAYS truthy (a function object
is truthy regardless of what it returns) and silently break subscription/
permission checks for every non-superadmin central token. `_BoolCallable`
is both: `__bool__` for central_auth's own inherited code, `__call__` for
org-service's `.is_superadmin()` convention — same underlying flag, read
correctly either way.

## What's fail-closed, and why (per this phase's explicit instruction:
"Don't invent catalog perms — flag gaps (fail closed)")

org-service's role concepts (org_admin/principal/coordinator/teacher/admin)
have NO equivalent anywhere in central auth today:
- `permissions/sms_catalog.py`'s SMS_ROLE_TEMPLATES defines only "SMS
  Student" — staff-role RBAC wiring is explicitly deferred (see
  employees/sms_import.py's own docstring: staff roles are imported as a
  `Designation.position_code` label under a shared "SMS Staff" department,
  "NOT into the permissions RBAC catalog... that wiring is Phase B3,
  deliberately deferred" — and B3, when it landed, only ever covered
  students).
- The central-auth token itself carries `is_superadmin` (a SEPARATE,
  platform-wide flag from `authentication.superadmin_models`) and `perms`
  (RBAC codenames, empty for staff since B3 never wired them) — no `role`
  claim shaped like org-service's own ROLE_CHOICES at all.

So OrgCentralAuthUser.is_org_admin_role()/.is_principal()/.is_coordinator()/
.is_teacher()/.is_admin() all return False unconditionally — every
org-service role gate except IsSuperAdmin fails closed for a central token
until a future phase wires an SMS staff-RBAC catalog. `.role = None` means
every inline `request.user.role == 'x'`/`in (...)` comparison scattered
through views.py also naturally evaluates to "no match" (None never equals
or is `in` any role-string set) rather than crashing — the same fail-closed
outcome, reached without a single views.py edit.
"""
from django.db.models import Q
from rest_framework.authentication import BaseAuthentication
from rest_framework.permissions import BasePermission

from central_auth.authentication import CentralAuthAuthentication, CentralAuthUser


class _BoolCallable:
    """Behaves as a bool in a truthy/`or` context (`__bool__`) AND as a
    zero-arg callable returning that same bool (`__call__`). See module
    docstring — lets CentralAuthUser.is_superadmin satisfy both
    central_auth's own `self.is_superadmin or ...` usage and org-service's
    `request.user.is_superadmin()` convention from the SAME attribute."""

    __slots__ = ('_value',)

    def __init__(self, value):
        self._value = bool(value)

    def __bool__(self):
        return self._value

    def __call__(self):
        return self._value

    def __repr__(self):
        return repr(self._value)


class OrgCentralAuthUser(CentralAuthUser):
    """See module docstring. A CentralAuthUser wrapped to duck-type
    org-service's own User/_TokenUser role-check interface."""

    def __init__(self, claims: dict):
        super().__init__(claims)
        self.is_superadmin = _BoolCallable(self.is_superadmin)
        self.role = None
        self.organization = None  # resolved per-request by _get_org() (users/views.py) via tenant_id
        self.org_id = None
        self.is_org_admin = False
        self.is_active = True
        self.is_anonymous = False
        self.pk = self.id
        self.username = self.employee_code or self.email or str(self.id)
        self.has_changed_default_password = True  # never route a central token through org-service's own password-reset flows

    # ── org-service's own role-check surface — all fail closed, see module docstring ──
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
    removed — central auth (RS256, wrapped in OrgCentralAuthUser) is the
    only live path. See docs/PHASE_D_R4R6_REMOVAL_RESULT.md."""

    def authenticate(self, request):
        result = CentralAuthAuthentication().authenticate(request)
        if result is None:
            return None
        raw_user, tok = result
        return OrgCentralAuthUser(raw_user.claims), tok

    def authenticate_header(self, request):
        return 'Bearer'


class DualServiceSubscribed(BasePermission):
    """No-op (True) for legacy tokens; enforces sms subscription for
    CentralAuthUser. Identical in shape to C1-C10's version."""
    message = 'Your organization does not have an active SMS subscription.'

    def has_permission(self, request, view):
        user = request.user
        if not isinstance(user, CentralAuthUser):
            return True
        return bool(user.is_authenticated and user.has_service('sms'))


def DualRequiresPermission(codename: str):
    """No-op (True) for legacy tokens; enforces one sms.* codename for
    CentralAuthUser. Defined for parity with C1-C10 — NOT wired into any
    org-service view this phase: org-service's own gates are role-based
    (IsSuperAdmin/IsOrgAdmin/...), not permission-codename-based, and no
    SMS catalog codename maps to org-service's admin-tier concepts (see
    module docstring)."""

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
    """Central-auth read path: explicit tenant filter, NOT the
    OrganizationManager-backed `.objects` default — that manager depends on
    OrganizationMiddleware's thread-local context vars, which are only ever
    populated from a legacy ServiceJWTAuthentication token (see
    users/middleware.py's own manual-authentication fallback, extended in
    this phase to also resolve a central token's Organization — but
    `.objects`'s role-branching (`user.role == 'admin'`, etc.) still can't
    express "central superadmin" without also patching the manager, which
    is out of scope here). Rows with tenant_id IS NULL (legacy-created,
    pre-migration) are included — same permissive-for-unscoped-rows
    precedent as C1-C10."""
    if not isinstance(user, CentralAuthUser):
        return all_objects_manager.none()
    if user.is_superadmin:
        return all_objects_manager.all()
    if not user.tenant_id:
        return all_objects_manager.none()
    return all_objects_manager.filter(
        Q(tenant_id=user.tenant_id) | Q(tenant_id__isnull=True)
    )
