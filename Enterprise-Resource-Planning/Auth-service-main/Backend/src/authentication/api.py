"""
Authentication API endpoints using Django Ninja.

Endpoints:
- POST /api/auth/login - Login with employee_code + password
- POST /api/auth/login-hdms - Login with HDMS role validation
- POST /api/auth/logout - Logout (blacklist token)
- POST /api/auth/refresh - Refresh access token
- GET /api/auth/me - Get current user info
"""
from typing import List, Optional
from django.http import HttpRequest
from ninja import Router, Schema
from ninja.security import HttpBearer
from datetime import datetime, timedelta
from django.utils import timezone
from employees.models import Employee
from permissions.models import ServiceAccess, Subscription
from .models import UserCredentials, RefreshToken, BlacklistedToken
from .superadmin_models import SuperAdmin
from .nonstaff_models import NonStaffIdentity
from .jwt_utils import (
    generate_access_token,
    generate_refresh_token,
    decode_token,
    verify_access_token,
    verify_refresh_token,
    get_token_expiry
)

router = Router(tags=["Authentication"])


# ================== Schemas ==================

class LoginRequest(Schema):
    employee_code: str
    password: str


class HdmsLoginRequest(Schema):
    """Login request for HDMS with role validation"""
    employee_code: str
    password: str


class LoginResponse(Schema):
    access_token: str
    refresh_token: str
    expires_in: int  # seconds
    employee: dict


class RefreshRequest(Schema):
    refresh_token: str


class RefreshResponse(Schema):
    access_token: str
    expires_in: int


class LogoutRequest(Schema):
    access_token: str


class MessageResponse(Schema):
    message: str


class EmployeeInfoResponse(Schema):
    employee_id: str
    employee_code: str
    full_name: str
    email: str
    department: str
    designation: str
    is_superadmin: bool
    is_active: bool


class ErrorResponse(Schema):
    error: str
    detail: str = None


# ================== Bearer Token Authentication ==================

class AuthBearer(HttpBearer):
    """Bearer token authentication for both employees and superadmins"""
    
    def authenticate(self, request: HttpRequest, token: str):
        # Check if token is blacklisted
        if BlacklistedToken.is_blacklisted(token):
            return None
        
        # Verify token
        verify_result = verify_access_token(token)
        if not verify_result:
            return None
            
        user_id, is_superadmin = verify_result
        
        if is_superadmin:
            try:
                return SuperAdmin.objects.get(id=user_id, is_active=True)
            except SuperAdmin.DoesNotExist:
                return None
        else:
            try:
                return Employee.objects.get(id=user_id, is_active=True, is_deleted=False)
            except Employee.DoesNotExist:
                return None


# ================== Endpoints ==================

@router.post("/login", response={200: LoginResponse, 401: ErrorResponse, 423: ErrorResponse})
def login(request: HttpRequest, payload: LoginRequest):
    """
    Login with employee_code (or superadmin_code) and password.
    """
    # Try finding as employee first
    user = None
    try:
        user = Employee.objects.get(
            employee_code=payload.employee_code,
            is_active=True,
            is_deleted=False
        )
    except Employee.DoesNotExist:
        # Try finding as superadmin
        try:
            user = SuperAdmin.objects.get(
                superadmin_code=payload.employee_code,
                is_active=True
            )
        except SuperAdmin.DoesNotExist:
            return 401, {
                "error": "Invalid credentials",
                "detail": "User not found or account inactive"
            }
    
    # Get user credentials
    is_superadmin = getattr(user, 'is_superadmin', False)
    cred_filter = {'superadmin': user} if is_superadmin else {'employee': user}
    
    try:
        credentials = UserCredentials.objects.get(**cred_filter, is_deleted=False)
    except UserCredentials.DoesNotExist:
        return 401, {
            "error": "Invalid credentials",
            "detail": "No credentials found for this user"
        }
    
    # Check if account is locked
    if credentials.is_locked():
        return 423, {
            "error": "Account locked",
            "detail": f"Too many failed attempts. Try again after {credentials.locked_until}"
        }
    
    # Verify password
    if not credentials.check_password(payload.password):
        credentials.record_failed_login()
        return 401, {
            "error": "Invalid credentials",
            "detail": "Incorrect password"
        }
    
    # Record success
    client_ip = request.META.get('REMOTE_ADDR')
    user_agent = request.META.get('HTTP_USER_AGENT', '')
    credentials.record_successful_login(ip_address=client_ip)
    
    # Generate tokens
    access_token = generate_access_token(user)
    refresh_token_str = generate_refresh_token(user)
    
    # Store refresh token
    RefreshToken.objects.create(
        employee=user if not is_superadmin else None,
        superadmin=user if is_superadmin else None,
        token=refresh_token_str,
        expires_at=timezone.now() + timedelta(days=7),
        device_info=user_agent[:255],
        ip_address=client_ip
    )
    
    # Build employee dict - return code instead of employee_code for polymorphism
    user_info = {
        "id": str(user.id),
        "code": getattr(user, 'superadmin_code', None) or getattr(user, 'employee_code', None),
        "full_name": user.full_name,
        "email": user.email,
        "is_superadmin": is_superadmin
    }
    
    if not is_superadmin:
        user_info.update({
            "employee_id": user.employee_id,
            "department": user.department.dept_name,
            "designation": user.designation.position_name,
        })
    
    return 200, {
        "access_token": access_token,
        "refresh_token": refresh_token_str,
        "expires_in": 3600,
        "employee": user_info
    }


@router.post("/logout", response={200: MessageResponse, 401: ErrorResponse}, auth=AuthBearer())
def logout(request: HttpRequest, payload: LogoutRequest):
    """
    Logout by blacklisting access token.
    
    Requires: Bearer token in Authorization header
    """
    try:
        # Get token expiry
        expires_at = get_token_expiry(payload.access_token)
        if not expires_at:
            expires_at = timezone.now() + timedelta(hours=1)
        
        # Blacklist the access token
        BlacklistedToken.objects.create(
            token=payload.access_token,
            expires_at=expires_at,
            reason='logout'
        )
        
        # Revoke all refresh tokens for this user (employee or superadmin)
        is_sa = getattr(request.auth, 'is_superadmin', False)
        filter_key = {'superadmin': request.auth} if is_sa else {'employee': request.auth}
        RefreshToken.objects.filter(**filter_key, is_revoked=False).update(is_revoked=True)
        
        return 200, {"message": "Logged out successfully"}
    
    except Exception as e:
        return 401, {
            "error": "Logout failed",
            "detail": str(e)
        }


@router.post("/refresh", response={200: RefreshResponse, 401: ErrorResponse})
def refresh_token(request: HttpRequest, payload: RefreshRequest):
    """
    Refresh access token using refresh token.
    
    Returns new access token (1 hour).
    """
    try:
        # Verify refresh token
        verify_result = verify_refresh_token(payload.refresh_token)
        if not verify_result:
            return 401, {
                "error": "Invalid refresh token",
                "detail": "Token is invalid or expired"
            }
        
        user_id, is_superadmin, principal_type = verify_result

        # Check refresh token database. principal_type == 'non_staff' (Phase
        # D-b1) takes priority over is_superadmin, since a student token
        # never carries is_superadmin=True anyway — this is a pure addition,
        # the is_superadmin/employee branches below are unchanged.
        if principal_type == 'non_staff':
            cred_filter = {'non_staff_identity__id': user_id}
        elif is_superadmin:
            cred_filter = {'superadmin__id': user_id}
        else:
            cred_filter = {'employee__id': user_id}
        try:
            refresh_token_obj = RefreshToken.objects.get(
                token=payload.refresh_token,
                **cred_filter
            )
        except RefreshToken.DoesNotExist:
            return 401, {
                "error": "Invalid refresh token",
                "detail": "Token not found in database"
            }

        if not refresh_token_obj.is_valid():
            return 401, {
                "error": "Invalid refresh token",
                "detail": "Token has been revoked or expired"
            }

        # Get user
        if principal_type == 'non_staff':
            user = NonStaffIdentity.objects.get(id=user_id, is_active=True, is_deleted=False)
        elif is_superadmin:
            user = SuperAdmin.objects.get(id=user_id, is_active=True)
        else:
            user = Employee.objects.get(id=user_id, is_active=True, is_deleted=False)

        # Generate new access token
        new_access_token = generate_access_token(user)

        return 200, {
            "access_token": new_access_token,
            "expires_in": 3600
        }

    except (Employee.DoesNotExist, SuperAdmin.DoesNotExist, NonStaffIdentity.DoesNotExist):
        return 401, {
            "error": "User not found",
            "detail": "Account is inactive or deleted"
        }
    except Exception as e:
        return 401, {
            "error": "Refresh failed",
            "detail": str(e)
        }


@router.get("/me", response={200: dict, 401: ErrorResponse}, auth=AuthBearer())
def get_current_user(request: HttpRequest):
    """
    Get current authenticated user info.
    """
    user = request.auth
    is_superadmin = getattr(user, 'is_superadmin', False)
    
    user_info = {
        "id": str(user.id),
        "code": user.superadmin_code if is_superadmin else user.employee_code,
        "full_name": user.full_name,
        "email": user.email or "",
        "is_superadmin": is_superadmin,
        "is_active": user.is_active
    }
    
    if not is_superadmin:
        user_info.update({
            "employee_id": user.employee_id,
            "department": user.department.dept_name,
            "designation": user.designation.position_name,
        })
        
    return 200, user_info


# ================== HDMS Login Endpoint ==================

class HdmsLoginResponse(Schema):
    """Response for HDMS login with role and permissions"""
    access_token: str
    refresh_token: str
    expires_in: int
    user: dict


class HdmsErrorResponse(Schema):
    """Error response for HDMS login"""
    error: str
    detail: Optional[str] = None
    assigned_role: Optional[str] = None  # For role mismatch errors


@router.post("/login-hdms", response={200: HdmsLoginResponse, 401: HdmsErrorResponse, 403: HdmsErrorResponse, 423: HdmsErrorResponse})
def login_hdms(request: HttpRequest, payload: HdmsLoginRequest):
    """
    Login to HDMS with service access + catalog role validation.

    Validates employee credentials and HDMS service access. Returns JWT
    with hdms role included. Mirrors login_vms exactly — see that endpoint
    for the enforcement-order rationale.
    """
    try:
        employee = Employee.objects.get(
            employee_code=payload.employee_code,
            is_active=True,
            is_deleted=False
        )
    except Employee.DoesNotExist:
        return 401, {"error": "invalid_credentials", "detail": "Employee code not found or account inactive"}

    try:
        credentials = UserCredentials.objects.get(employee=employee, is_deleted=False)
    except UserCredentials.DoesNotExist:
        return 401, {"error": "invalid_credentials", "detail": "No credentials found for this employee"}

    if credentials.is_locked():
        return 423, {"error": "account_locked", "detail": f"Too many failed attempts. Try again after {credentials.locked_until}"}

    if not credentials.check_password(payload.password):
        credentials.record_failed_login()
        return 401, {"error": "invalid_credentials", "detail": "Incorrect password"}

    # Enforcement order: credentials valid (above) -> tenant subscribed -> service
    # access granted -> role assigned. SuperAdmin bypasses this whole endpoint by
    # using /api/auth/login instead — login-hdms is employee-only.
    if not Subscription.tenant_has_active(employee.tenant_id, 'hdms'):
        return 403, {"error": "tenant_not_subscribed", "detail": "Your organization does not have an active HDMS subscription."}

    try:
        service_access = ServiceAccess.objects.get(
            employee=employee,
            service='hdms',
            is_active=True,
            is_deleted=False
        )
    except ServiceAccess.DoesNotExist:
        return 403, {"error": "no_hdms_access", "detail": "You don't have HDMS access. Contact admin."}

    from permissions.hdms_catalog import get_employee_hdms_role_type
    role_type = get_employee_hdms_role_type(employee)
    if not role_type:
        return 403, {"error": "no_hdms_role", "detail": "No HDMS role assigned. Contact admin."}

    client_ip = request.META.get('REMOTE_ADDR')
    user_agent = request.META.get('HTTP_USER_AGENT', '')
    credentials.record_successful_login(ip_address=client_ip)

    access_token = generate_access_token(employee, role=role_type)
    refresh_token_str = generate_refresh_token(employee)

    RefreshToken.objects.create(
        employee=employee,
        token=refresh_token_str,
        expires_at=timezone.now() + timedelta(days=7),
        device_info=user_agent[:255],
        ip_address=client_ip
    )

    # Back-compat: old response shape exposed 4 booleans derived from HdmsRole
    # fields. Now derived from the employee's actual catalog permissions
    # (permissions.rbac — the same effective-permissions engine used to
    # build the token's `perms` claim), so downstream consumers relying on
    # this shape keep working without changes.
    from permissions.rbac import get_effective_permissions
    effective_perms = get_effective_permissions(str(employee.id))

    return 200, {
        "access_token": access_token,
        "refresh_token": refresh_token_str,
        "expires_in": 3600,
        "user": {
            "id": str(employee.id),
            "employee_id": employee.employee_id,
            "employee_code": employee.employee_code,
            "name": employee.full_name,
            "email": employee.email or "",
            "department": employee.department.dept_name if employee.department else "",
            "role": role_type,
            "permissions": {
                "can_view_all_tickets": "hdms.ticket.view_all" in effective_perms,
                "can_assign_tickets": "hdms.ticket.assign" in effective_perms,
                "can_close_tickets": "hdms.ticket.close" in effective_perms,
                "can_manage_users": "hdms.user.manage" in effective_perms,
            }
        }
    }


# ================== VMS Login Endpoint ==================

class VmsLoginResponse(Schema):
    access_token: str
    refresh_token: str
    expires_in: int
    user: dict


@router.post("/login-vms", response={200: VmsLoginResponse, 401: HdmsErrorResponse, 403: HdmsErrorResponse, 423: HdmsErrorResponse})
def login_vms(request: HttpRequest, payload: HdmsLoginRequest):
    """
    Login to VMS with service access + role validation.

    Validates employee credentials and VMS service access.
    Returns JWT with vms_role included.
    """
    try:
        employee = Employee.objects.get(
            employee_code=payload.employee_code,
            is_active=True,
            is_deleted=False
        )
    except Employee.DoesNotExist:
        return 401, {"error": "invalid_credentials", "detail": "Employee code not found or account inactive"}

    try:
        credentials = UserCredentials.objects.get(employee=employee, is_deleted=False)
    except UserCredentials.DoesNotExist:
        return 401, {"error": "invalid_credentials", "detail": "No credentials found for this employee"}

    if credentials.is_locked():
        return 423, {"error": "account_locked", "detail": f"Too many failed attempts. Try again after {credentials.locked_until}"}

    if not credentials.check_password(payload.password):
        credentials.record_failed_login()
        return 401, {"error": "invalid_credentials", "detail": "Incorrect password"}

    # Enforcement order: credentials valid (above) -> tenant subscribed -> service
    # access granted -> role assigned. SuperAdmin bypasses this whole endpoint by
    # using /api/auth/login instead — login-vms is employee-only.
    if not Subscription.tenant_has_active(employee.tenant_id, 'vms'):
        return 403, {"error": "tenant_not_subscribed", "detail": "Your organization does not have an active VMS subscription."}

    try:
        service_access = ServiceAccess.objects.get(
            employee=employee,
            service='vms',
            is_active=True,
            is_deleted=False
        )
    except ServiceAccess.DoesNotExist:
        return 403, {"error": "no_vms_access", "detail": "You don't have VMS access. Contact admin."}

    from permissions.vms_catalog import get_employee_vms_role_type
    role_type = get_employee_vms_role_type(employee)
    if not role_type:
        return 403, {"error": "no_vms_role", "detail": "No VMS role assigned. Contact admin."}

    client_ip = request.META.get('REMOTE_ADDR')
    user_agent = request.META.get('HTTP_USER_AGENT', '')
    credentials.record_successful_login(ip_address=client_ip)

    access_token = generate_access_token(employee, role=role_type)
    refresh_token_str = generate_refresh_token(employee)

    RefreshToken.objects.create(
        employee=employee,
        token=refresh_token_str,
        expires_at=timezone.now() + timedelta(days=7),
        device_info=user_agent[:255],
        ip_address=client_ip
    )

    return 200, {
        "access_token": access_token,
        "refresh_token": refresh_token_str,
        "expires_in": 3600,
        "user": {
            "id": str(employee.id),
            "employee_id": employee.employee_id,
            "employee_code": employee.employee_code,
            "name": employee.full_name,
            "email": employee.email or "",
            "department": employee.department.dept_name if employee.department else "",
            "vms_role": role_type,
        }
    }


# ================== Unified SMS Login Endpoint (Phase D-b1) ==================
#
# Gate for SMS's Phase D auth retirement: SMS's frontend currently logs in
# against its own legacy auth-8001 (email + password, staff OR student
# through one form). This endpoint is the central-auth-side equivalent —
# ONE door, self-detecting principal type, so the eventual frontend adapter
# doesn't need to know in advance whether an email belongs to a staff
# Employee or a student NonStaffIdentity. See
# docs/PHASE_D_B1_SMS_LOGIN_RESULT.md for the full design/proof.
#
# Response shape is deliberately central auth's own clean shape (access_token/
# refresh_token/principal), NOT bent to match SMS's old access/refresh/user/
# organization shape — the SMS frontend adapts to this in a later, separate
# step (per the locked decision in the Phase D-b1 prompt).

SMS_TENANT_CODE = "SMS01"


class SmsLoginRequest(Schema):
    email: str
    password: str


class SmsPrincipalOut(Schema):
    user_id: str
    person_type: str  # "staff" | "student"
    full_name: str
    email: str
    tenant_id: Optional[str] = None
    tenant_name: Optional[str] = None
    role: Optional[str] = None
    services: List[str] = []
    perms: List[str] = []


class SmsLoginResponse(Schema):
    access_token: str
    refresh_token: str
    expires_in: int
    principal: SmsPrincipalOut


@router.post("/login-sms", response={200: SmsLoginResponse, 401: ErrorResponse, 423: ErrorResponse})
def login_sms(request: HttpRequest, payload: SmsLoginRequest):
    """
    Unified SMS login: email + password, resolving to EITHER a staff
    Employee OR a student NonStaffIdentity in tenant SMS01 — one endpoint,
    not two. Mirrors /login's credential-check, lockout, and token-issue
    logic exactly (record_failed_login/record_successful_login via
    UserCredentials); only principal resolution differs.

    Resolution order (staff first, then student) — if the same email were
    ever shared by both a SMS01 Employee and a SMS01 NonStaffIdentity (not
    expected; nothing in the importers prevents it in principle), the staff
    account wins and the student account is unreachable through this
    endpoint. Not enforced/validated anywhere; documented here as the
    defined behavior per the Phase D-b1 prompt's own instruction to "prefer
    a defined order and note it."
    """
    principal = Employee.objects.filter(
        tenant__tenant_code=SMS_TENANT_CODE,
        org_email__iexact=payload.email,
        is_active=True,
        is_deleted=False,
    ).first()
    person_type = "staff"

    if not principal:
        principal = NonStaffIdentity.objects.filter(
            tenant__tenant_code=SMS_TENANT_CODE,
            email__iexact=payload.email,
            is_active=True,
            is_deleted=False,
        ).first()
        person_type = "student"

    if not principal:
        return 401, {
            "error": "Invalid credentials",
            "detail": "User not found or account inactive"
        }

    cred_filter = {'employee': principal} if person_type == "staff" else {'non_staff_identity': principal}
    try:
        credentials = UserCredentials.objects.get(**cred_filter, is_deleted=False)
    except UserCredentials.DoesNotExist:
        return 401, {
            "error": "Invalid credentials",
            "detail": "No credentials found for this user"
        }

    if credentials.is_locked():
        return 423, {
            "error": "Account locked",
            "detail": f"Too many failed attempts. Try again after {credentials.locked_until}"
        }

    if not credentials.check_password(payload.password):
        credentials.record_failed_login()
        return 401, {
            "error": "Invalid credentials",
            "detail": "Incorrect password"
        }

    client_ip = request.META.get('REMOTE_ADDR')
    user_agent = request.META.get('HTTP_USER_AGENT', '')
    credentials.record_successful_login(ip_address=client_ip)

    access_token = generate_access_token(principal)
    refresh_token_str = generate_refresh_token(principal)

    refresh_kwargs = {'employee': principal} if person_type == "staff" else {'non_staff_identity': principal}
    RefreshToken.objects.create(
        **refresh_kwargs,
        token=refresh_token_str,
        expires_at=timezone.now() + timedelta(days=7),
        device_info=user_agent[:255],
        ip_address=client_ip
    )

    # Read authz claims back off the freshly-minted access token, rather
    # than recomputing them, so the response can never drift from what's
    # actually inside the token.
    claims = decode_token(access_token)

    if person_type == "staff":
        role = principal.designation.position_name if principal.designation else None
    else:
        role = principal.role or None

    tenant = principal.tenant

    return 200, {
        "access_token": access_token,
        "refresh_token": refresh_token_str,
        "expires_in": 3600,
        "principal": {
            "user_id": str(principal.id),
            "person_type": person_type,
            "full_name": principal.full_name,
            "email": principal.email,
            "tenant_id": claims.get("tenant_id"),
            "tenant_name": tenant.name if tenant else None,
            "role": role,
            "services": claims.get("services", []),
            "perms": claims.get("perms", []),
        }
    }


# SIS login endpoint removed (cleanup-remove-sis): 'sis' was a legacy test
# product, confirmed unused by the owner (0 active ServiceAccess rows at
# removal time), unrelated to the current SMS product. See
# docs/CLEANUP_SIS_REMOVAL_RESULT.md.
