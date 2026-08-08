"""
Phase C2: dual-run auth/permission glue for fees-service. Same shape as
content-service's dual_auth.py (Phase C1) — see that file's docstring for
the two underlying problems this solves (DRF authenticators raising
instead of returning None on a foreign token scheme; OrganizationMiddleware
never populating its contextvars for central-auth requests). Not part of
the reusable central_auth/ template.

fees-service is more coupled than content-service was: real `users.User`
FKs (Payment.received_by, PaymentTransaction.verified_by — a bare
`CentralAuthUser` can't be assigned to a real Django FK, it isn't a
`users.User` row), and a dynamic per-org/role permission system
(`HasDynamicPermission`, backed by the local `RolePermission` table) that
calls `user.is_superadmin()` as a METHOD and reads `user.role`/
`user.organization` — none of which exist in that shape on `CentralAuthUser`
(`is_superadmin` is a bool attribute there, not a method; no `role` or
`organization` attribute at all). Every helper below exists to make those
call sites type-safe for both principal types without changing legacy
behavior.
"""
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
    CentralAuthUser. Identical in shape to C1's version."""
    message = 'Your organization does not have an active SMS subscription.'

    def has_permission(self, request, view):
        user = request.user
        if not isinstance(user, CentralAuthUser):
            return True
        return bool(user.is_authenticated and user.has_service('sms'))


def DualRequiresPermission(codename: str):
    """No-op (True) for legacy tokens; enforces one sms.* codename for
    CentralAuthUser. Identical in shape to C1's version."""

    class _DualRequiresPermission(BasePermission):
        message = f'Missing required permission: {codename}.'

        def has_permission(self, request, view):
            user = request.user
            if not isinstance(user, CentralAuthUser):
                return True
            return bool(user.is_authenticated and user.has_perm(codename))

    _DualRequiresPermission.__name__ = f'DualRequiresPermission_{codename}'
    return _DualRequiresPermission


# ── fees-service-specific: type-safe user helpers ──────────────────────────
# request.user is EITHER a real users.User / _TokenUser (legacy HS256 path,
# unchanged) OR a CentralAuthUser (new RS256 path). Every place views.py
# used to call user.is_superadmin()/user.role/user.get_full_name() directly
# now goes through these instead, so both shapes are handled correctly —
# the legacy branch below is byte-for-byte what the code always did.

def user_is_superadmin(user) -> bool:
    if isinstance(user, CentralAuthUser):
        return user.is_superadmin  # attribute, not a method, on this class
    return user.is_superadmin()  # _TokenUser / User: method call, unchanged


def user_role(user):
    """Legacy-only concept — central-auth tokens carry no role/person_type
    claim yet (same gap already flagged in Phase B3/C1: no principal_type
    claim exists to distinguish e.g. accounts_officer from anyone else).
    Returns None for CentralAuthUser, which makes every `user_role(user)
    in (...)` campus-scoping check below correctly evaluate to False
    (skipped, not crashed) rather than guessing at a role that isn't there."""
    if isinstance(user, CentralAuthUser):
        return None
    return getattr(user, 'role', None)


def user_display_name(user) -> str:
    if isinstance(user, CentralAuthUser):
        return user.full_name or user.employee_code or str(user.id)
    return (user.get_full_name() or '').strip() or getattr(user, 'username', str(user.id))


# ── fees-service-specific: HasDynamicPermission, made dual-aware ───────────
# required_permission -> sms.* catalog codename. 'view_fees' maps cleanly
# (sms.fee.view already exists, Phase B3). 'manage_fees' has NO clean match
# — it covers fee-STRUCTURE management (create/edit FeeType/FeeStructure/
# BankAccount) AND staff recording a payment on someone's behalf, neither of
# which is "sms.fee.pay" (that's the STUDENT's own self-service payment
# action — see PaymentTransactionViewSet.submit, which now uses it
# directly). Per the rules, sms.fee.manage is referenced but NOT added to
# central auth's catalog from this fees-service-scoped task — flagged in
# docs/PHASE_C2_FEES_SERVICE_RESULT.md. Every non-superadmin central-auth
# token correctly 403s on 'manage_fees'-gated endpoints until a future
# catalog step adds it — fail-closed, not a bug.
REQUIRED_PERMISSION_TO_SMS_CODENAME = {
    'view_fees': 'sms.fee.view',
    'manage_fees': 'sms.fee.manage',  # NOT YET in the catalog — flagged above
}


class DualHasDynamicPermission(BasePermission):
    """Drop-in replacement for users.permissions.HasDynamicPermission.
    Legacy tokens: delegates to the EXACT original logic (RolePermission
    lookup, superadmin/org_admin bypass) — relocated here unchanged, not
    rewritten. CentralAuthUser: superadmin bypasses via has_perm's '*'
    sentinel; otherwise required_permission is mapped to an sms.* codename
    and checked via has_perm()."""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False

        codename = getattr(view, 'required_permission', None)

        if isinstance(user, CentralAuthUser):
            if user_is_superadmin(user):
                return True
            if not codename:
                return True
            sms_codename = REQUIRED_PERMISSION_TO_SMS_CODENAME.get(codename)
            if not sms_codename:
                return False
            return user.has_perm(sms_codename)

        # Legacy path — identical to the original HasDynamicPermission.
        if user.is_superadmin() or user.role == 'org_admin':
            return True
        if not codename:
            return True
        from users.models import RolePermission
        return RolePermission.objects.filter(
            organization=user.organization,
            role=user.role,
            permission_codename=codename,
            is_allowed=True,
        ).exists()
