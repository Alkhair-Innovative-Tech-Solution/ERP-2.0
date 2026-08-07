"""
Phase C13 (final of 13): dual-run auth glue for ai-service — the simplest
service in the whole repoint: zero User/Organization model coupling, no
remap, no migrations. It authenticates via `rest_framework_simplejwt`'s
`JWTStatelessUserAuthentication` (not `ams_shared.jwt.validator` like every
other SMS service — a different library, same idea: decode HS256, wrap the
payload as a `TokenUser`, no DB lookup) and reads claims through
`ai_chat/views.py`'s own `_get_token_claim(user, claim, default)`:

    def _get_token_claim(user, claim, default=None):
        try:
            val = user.token.get(claim)
            if val is not None:
                return val
        except Exception:
            pass
        return getattr(user, claim, default)

This is why `AiCentralAuthUser` below needs no `.token` dict at all: it has
no `.token` attribute, so `user.token.get(claim)` raises AttributeError,
caught by the existing `except Exception: pass`, and falls through to the
`getattr(user, claim, default)` path — which finds whatever plain
attributes this class sets. Zero changes needed to `_get_token_claim`
itself.

## DualAuthentication

Routes on the token's own `alg` header (RS256 -> central, else -> legacy
`JWTStatelessUserAuthentication`) — same shape as every prior phase's
DualAuthentication, adapted to call SimpleJWT's own class for the legacy
branch instead of `ams_shared`'s.

## AiCentralAuthUser — claim mapping, and what's genuinely missing

Central tokens do not carry `role`, `org_id`, or `campus_id` at all (see
docs/PHASE_C13_AI_SERVICE_RESULT.md's audit). What's actually mappable,
and how:

- `username`: full_name / employee_code / identity_code — display-only,
  safe.
- `role`: a central STUDENT token carries `person_type='student'`
  (Phase A2/B2's own claim) — an exact, honest equivalent to
  `role == 'student'`, set directly. A central STAFF token carries
  neither `role` nor any HR/designation data (deliberately excluded from
  the token, see Auth-service-main/.../jwt_utils.py's own docstring) — so
  which of teacher/coordinator/principal/org_admin/admin it is CANNOT be
  read off the token. Resolved instead in `ai_chat/views.py`'s
  `_build_scope()`, exactly the way Phase C12 resolved `Teacher/Principal/
  Coordinator.get_for_user()`: an EXACT `central_user_id` match against
  each candidate profile table in turn (teacher, then coordinator, then
  principal) — never fuzzy, never guessed. `org_admin`/`admin` have no
  backing profile table at all (they're bare `User.role` flags in the
  legacy system) and remain genuinely unresolvable for a central token —
  flagged, not hacked around; a central token belonging to an org_admin/
  admin degrades to the SAME safe "no tools available for your role"
  response the code already gives an unknown role.
- `org_id` / `campus_id`: not mapped onto this object at all (left unset
  — `getattr` returns None, never a wrong value). Every SQL query
  ai_chat/views.py runs filters by an integer `organization_id` column
  against each downstream service's own local Organization PK — a
  central token's `tenant_id` (UUID) is NOT that value. Confirmed by
  inspecting every table these queries touch (students_student,
  teachers_teacher, coordinator_coordinator, principals_principal,
  campus_campus, classes_classroom, classes_grade, attendance_attendance,
  result_result, transfers_classtransfer): each already has BOTH the old
  integer `organization_id` AND a `tenant_id` UUID column (added by
  whichever phase touched that service). So the fix isn't a value
  substitution, it's a COLUMN swap — `_build_scope()` sets
  `scope['org_col'] = 'tenant_id'` and `scope['org_id'] = str(user.tenant_id)`
  for a central token, and `_execute_tool()` uses `scope['org_col']` in
  its WHERE clauses instead of a hardcoded `'organization_id'`. campus_id
  is resolved the same way as role — from the matched profile row
  (teacher.current_campus_id / coordinator.campus_id / principal.campus_id),
  never from a token claim that doesn't exist.
"""
import jwt
from rest_framework.authentication import BaseAuthentication
from rest_framework.permissions import BasePermission
from rest_framework_simplejwt.authentication import JWTStatelessUserAuthentication

from central_auth.authentication import CentralAuthAuthentication, CentralAuthUser


class AiCentralAuthUser(CentralAuthUser):
    def __init__(self, claims: dict):
        super().__init__(claims)
        self.person_type = claims.get('person_type')
        self.identity_code = claims.get('identity_code')
        # Exact, honest mapping — see module docstring. Everything else
        # (teacher/coordinator/principal/org_admin/admin) is resolved in
        # ai_chat/views.py._build_scope() via central_user_id, not here.
        self.role = 'student' if self.person_type == 'student' else ''
        self.username = self.full_name or self.employee_code or self.identity_code or str(self.id)


class DualAuthentication(BaseAuthentication):
    """Routes to CentralAuthAuthentication (RS256, wrapped in
    AiCentralAuthUser) or the legacy JWTStatelessUserAuthentication
    (HS256) based on the token's own `alg` header."""

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
            result = CentralAuthAuthentication().authenticate(request)
            if result is None:
                return None
            raw_user, tok = result
            return AiCentralAuthUser(raw_user.claims), tok
        return JWTStatelessUserAuthentication().authenticate(request)

    def authenticate_header(self, request):
        return 'Bearer'


class DualServiceSubscribed(BasePermission):
    """No-op (True) for legacy tokens; enforces sms subscription for
    CentralAuthUser. Identical in shape to C1-C12's version — deliberately
    NOT `central_auth.permissions.ServiceSubscribed` used directly: that
    template calls `user.has_service(...)` unconditionally, which a
    legacy SimpleJWT `TokenUser` doesn't define at all (AttributeError,
    not a clean 403) — every prior phase wraps it in an isinstance check
    for exactly this reason."""
    message = 'Your organization does not have an active SMS subscription.'

    def has_permission(self, request, view):
        user = request.user
        if not isinstance(user, CentralAuthUser):
            return True
        return bool(user.is_authenticated and user.has_service('sms'))
