"""
Phase C7: dual-run auth/permission glue for notification-service. Same
shape as content-service's dual_auth.py (Phase C1) / fees-service's (C2) /
result-service's (C3) / subject-service's (C4) / campus-service's (C5) /
support-service's (C6) — see those files' docstrings for the two underlying
problems this solves (DRF authenticators raising instead of returning None
on a foreign token scheme; OrganizationMiddleware never populating its
contextvars for central-auth requests).

Lives at the project-package level (not inside `notifications/`) — same
reasoning as C4-C6's project-level dual_auth.py, though this service only
has one real app (`notifications`); kept consistent with the established
pattern rather than a one-off exception.

notification-service is structurally different from every prior phase in
one way worth flagging up front: **none of its models
(Notification/Announcement/PushSubscription) use OrganizationManager** —
they use Django's plain default manager. So there is no `all_objects`-vs-
`objects` blind spot here at all (confirmed by reading users.managers usage
in notifications/models.py — none). `central_tenant_qs` below still exists
because Organization/tenant scoping is still a real, separate concern
(these models still carry an `organization` FK) — it just needs to be
ADDED as an explicit filter, not swapped in to replace a blind-spotted
default manager.

The load-bearing security property in this service is **recipient
scoping**: `Notification.recipient` is a real FK to `users.User` — a
CentralAuthUser isn't a `users.User` row (same class of gap as C2's
`Payment.received_by`), so central-auth notification reads must filter by
`central_recipient_id` instead of `recipient_id`. Getting this wrong in
either direction is the IDOR risk the C7 prompt calls out explicitly:
under-filtering leaks other users' notifications; over-filtering (e.g.
never matching) just makes the inbox always empty — annoying but not a
security bug. central_person_id() below is the single source of truth for
"this token's own identity, as a central_*_id value" — used consistently
everywhere a central-auth principal's own identity needs to be stamped or
filtered on.
"""
from django.db.models import Q
from rest_framework.authentication import BaseAuthentication
from rest_framework.permissions import BasePermission

from central_auth.authentication import CentralAuthAuthentication, CentralAuthUser


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
    CentralAuthUser. Identical in shape to C1-C6's version."""
    message = 'Your organization does not have an active SMS subscription.'

    def has_permission(self, request, view):
        user = request.user
        if not isinstance(user, CentralAuthUser):
            return True
        return bool(user.is_authenticated and user.has_service('sms'))


def DualRequiresPermission(codename: str):
    """No-op (True) for legacy tokens; enforces one sms.* codename for
    CentralAuthUser. Identical in shape to C1-C6's version."""

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

def user_display_name(user) -> str:
    if isinstance(user, CentralAuthUser):
        return user.full_name or user.employee_code or str(user.id)
    if hasattr(user, 'get_full_name'):
        return (user.get_full_name() or '').strip() or getattr(user, 'username', str(getattr(user, 'id', '')))
    return getattr(user, 'username', str(getattr(user, 'id', '')))


def central_person_id(user):
    """The value to stamp/filter by for a CentralAuthUser's own identity in
    a central_*_id column. None for a legacy token."""
    return user.id if isinstance(user, CentralAuthUser) else None


def user_can_manage_announcements(user) -> bool:
    """Dual-safe replacement for AnnouncementViewSet._can_manage()'s
    `user.is_superadmin() or user.is_org_admin_role() or user.is_principal()`.

    FOUND, NOT FIXED (out of scope — pre-existing, affects legacy too):
    `_TokenUser` (ams_shared/jwt/validator.py, what ServiceJWTAuthentication
    actually builds) has NO `is_org_admin_role()` method at all — only
    `is_superadmin()`/`is_principal()`/`is_teacher()`/`is_coordinator()`.
    Calling the original `_can_manage()` for ANY legacy token that isn't
    already caught by `is_superadmin()`'s short-circuit raises
    AttributeError. This predates C7 entirely; the legacy branch below
    relocates the exact original expression unchanged (bug included) rather
    than silently fixing it — see docs/PHASE_C7_NOTIFICATION_SERVICE_RESULT.md.

    CentralAuthUser branch: this service vendors no local Teacher/
    Coordinator/Principal tables at all (unlike C3/C6 — only `campus` is
    Dockerfile-copied here), and no role/principal_type claim exists on the
    token (same gap flagged since B3). There is no way to resolve
    org_admin/principal for a central-auth token in this service. Narrowed,
    fail-closed, to `is_superadmin` only — flagged, not silently narrowed.
    """
    if isinstance(user, CentralAuthUser):
        return bool(user.is_superadmin)
    return bool(user.is_superadmin() or user.is_org_admin_role() or user.is_principal())


def central_tenant_qs(queryset, user):
    """Adds an explicit tenant filter for a central-auth request. Unlike
    C1-C6's central_tenant_qs, this doesn't need to start from an
    `all_objects` manager (no OrganizationManager blind spot exists on
    these models — see module docstring) — it just adds a `.filter(...)`
    on top of whatever queryset (already `Model.objects`-based, which sees
    everything for both token types) is passed in. Rows with tenant_id IS
    NULL (legacy-created, pre-migration) are included — same permissive-
    for-unscoped-rows precedent as C1-C6."""
    if not user.tenant_id:
        return queryset.none()
    return queryset.filter(Q(tenant_id=user.tenant_id) | Q(tenant_id__isnull=True))
