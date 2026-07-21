"""
Authentication API endpoints using Django Ninja.

Endpoints:
- POST /api/auth/login - Login with employee_code + password
- POST /api/auth/login-hdms - Login with HDMS role validation
- POST /api/auth/logout - Logout (blacklist token)
- POST /api/auth/refresh - Refresh access token
- GET /api/auth/me - Get current user info
"""
from typing import Optional
from django.http import HttpRequest
from ninja import Router, Schema
from ninja.security import HttpBearer
from datetime import datetime, timedelta
from django.utils import timezone
from employees.models import Employee
from permissions.models import ServiceAccess, HdmsRole, VmsRole
from .models import UserCredentials, RefreshToken, BlacklistedToken
from .superadmin_models import SuperAdmin
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
        
        user_id, is_superadmin = verify_result
        
        # Check refresh token database
        cred_filter = {'superadmin__id': user_id} if is_superadmin else {'employee__id': user_id}
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
        if is_superadmin:
            user = SuperAdmin.objects.get(id=user_id, is_active=True)
        else:
            user = Employee.objects.get(id=user_id, is_active=True, is_deleted=False)
        
        # Generate new access token
        new_access_token = generate_access_token(user)
        
        return 200, {
            "access_token": new_access_token,
            "expires_in": 3600
        }
    
    except (Employee.DoesNotExist, SuperAdmin.DoesNotExist):
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
    Login to HDMS with role validation.
    
    Validates:
    1. Employee credentials
    2. HDMS service access exists
    
    Returns user info with role and permissions.
    """
    
    # Get employee by employee_code
    try:
        employee = Employee.objects.get(
            employee_code=payload.employee_code,
            is_active=True,
            is_deleted=False
        )
    except Employee.DoesNotExist:
        return 401, {
            "error": "invalid_credentials",
            "detail": "Employee code not found or account inactive"
        }
    
    # Get user credentials
    try:
        credentials = UserCredentials.objects.get(employee=employee, is_deleted=False)
    except UserCredentials.DoesNotExist:
        return 401, {
            "error": "invalid_credentials",
            "detail": "No credentials found for this employee"
        }
    
    # Check if account is locked
    if credentials.is_locked():
        return 423, {
            "error": "account_locked",
            "detail": f"Too many failed attempts. Try again after {credentials.locked_until}"
        }
    
    # Verify password
    if not credentials.check_password(payload.password):
        credentials.record_failed_login()
        return 401, {
            "error": "invalid_credentials",
            "detail": "Incorrect password"
        }
    
    # Check HDMS service access
    try:
        service_access = ServiceAccess.objects.get(
            employee=employee,
            service='hdms',
            is_active=True,
            is_deleted=False
        )
    except ServiceAccess.DoesNotExist:
        return 403, {
            "error": "no_hdms_access",
            "detail": "You don't have HDMS access. Contact admin."
        }
    
    # Get HDMS role
    try:
        hdms_role = service_access.hdms_role
    except HdmsRole.DoesNotExist:
        return 403, {
            "error": "no_hdms_role",
            "detail": "No HDMS role assigned. Contact admin."
        }
    
    # Get client IP
    client_ip = request.META.get('REMOTE_ADDR')
    user_agent = request.META.get('HTTP_USER_AGENT', '')
    
    # Record successful login
    credentials.record_successful_login(ip_address=client_ip)
    
    # Generate tokens with specific HDMS role
    access_token = generate_access_token(employee, role=hdms_role.role_type)
    refresh_token_str = generate_refresh_token(employee)
    
    # Store refresh token in database
    RefreshToken.objects.create(
        employee=employee,
        token=refresh_token_str,
        expires_at=timezone.now() + timedelta(days=7),
        device_info=user_agent[:255],
        ip_address=client_ip
    )
    
    # Build user response with permissions
    return 200, {
        "access_token": access_token,
        "refresh_token": refresh_token_str,
        "expires_in": 3600,  # 1 hour
        "user": {
            "id": str(employee.id),
            "employee_id": employee.employee_id,
            "employee_code": employee.employee_code,
            "name": employee.full_name,
            "email": employee.email or "",
            "department": employee.department.dept_name,
            "role": hdms_role.role_type,
            "permissions": {
                "can_view_all_tickets": hdms_role.can_view_all_tickets,
                "can_assign_tickets": hdms_role.can_assign_tickets,
                "can_close_tickets": hdms_role.can_close_tickets,
                "can_manage_users": hdms_role.can_manage_users
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

    try:
        service_access = ServiceAccess.objects.get(
            employee=employee,
            service='vms',
            is_active=True,
            is_deleted=False
        )
    except ServiceAccess.DoesNotExist:
        return 403, {"error": "no_vms_access", "detail": "You don't have VMS access. Contact admin."}

    try:
        vms_role = service_access.vms_role
    except VmsRole.DoesNotExist:
        return 403, {"error": "no_vms_role", "detail": "No VMS role assigned. Contact admin."}

    client_ip = request.META.get('REMOTE_ADDR')
    user_agent = request.META.get('HTTP_USER_AGENT', '')
    credentials.record_successful_login(ip_address=client_ip)

    access_token = generate_access_token(employee, role=vms_role.role_type)
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
            "vms_role": vms_role.role_type,
        }
    }


# ================== SIS Login Endpoint ==================

class SisLoginResponse(Schema):
    access_token: str
    refresh_token: str
    expires_in: int
    user: dict


@router.post("/login-sis", response={200: SisLoginResponse, 401: ErrorResponse, 403: ErrorResponse, 423: ErrorResponse})
def login_sis(request: HttpRequest, payload: LoginRequest):
    """
    Specialized login for SIS with service access check and hydration metadata.
    """
    # 1. Credential Verification (shared logic)
    user = None
    try:
        user = Employee.objects.get(employee_code=payload.employee_code, is_active=True, is_deleted=False)
    except Employee.DoesNotExist:
        try:
            user = SuperAdmin.objects.get(superadmin_code=payload.employee_code, is_active=True)
        except SuperAdmin.DoesNotExist:
            return 401, {"error": "invalid_credentials", "detail": "User not found"}

    is_superadmin = getattr(user, 'is_superadmin', False)
    cred_filter = {'superadmin': user} if is_superadmin else {'employee': user}
    
    try:
        credentials = UserCredentials.objects.get(**cred_filter, is_deleted=False)
    except UserCredentials.DoesNotExist:
        return 401, {"error": "invalid_credentials", "detail": "No credentials found"}

    if credentials.is_locked():
        return 423, {"error": "account_locked", "detail": "Too many failed attempts"}

    if not credentials.check_password(payload.password):
        credentials.record_failed_login()
        return 401, {"error": "invalid_credentials", "detail": "Incorrect password"}

    # 2. Service Access Check
    try:
        ServiceAccess.objects.get(
            employee=user if not is_superadmin else None,
            superadmin=user if is_superadmin else None,
            service='sis',
            is_active=True,
            is_deleted=False
        )
    except ServiceAccess.DoesNotExist:
        return 403, {"error": "no_sis_access", "detail": "You don't have SIS access assigned."}

    # 3. Successful Login Actions
    client_ip = request.META.get('REMOTE_ADDR')
    user_agent = request.META.get('HTTP_USER_AGENT', '')
    credentials.record_successful_login(ip_address=client_ip)
    
    access_token = generate_access_token(user)
    refresh_token_str = generate_refresh_token(user)
    
    RefreshToken.objects.create(
        employee=user if not is_superadmin else None,
        superadmin=user if is_superadmin else None,
        token=refresh_token_str,
        expires_at=timezone.now() + timedelta(days=7),
        device_info=user_agent[:255],
        ip_address=client_ip
    )

    # 4. Build SIS-Compatible Response
    return 200, {
        "access_token": access_token,
        "refresh_token": refresh_token_str,
        "expires_in": 3600,
        "user": {
            "id": str(user.id),
            "username": getattr(user, 'superadmin_code', None) or getattr(user, 'employee_code', None),
            "full_name": user.full_name,
            "first_name": user.full_name.split(' ')[0] if user.full_name else "",
            "last_name": ' '.join(user.full_name.split(' ')[1:]) if user.full_name and len(user.full_name.split(' ')) > 1 else "",
            "email": user.email or "",
            "role": "superadmin" if is_superadmin else (user.designation.position_name.lower() if user.designation else "teacher"), # Fallback role
            "is_active": user.is_active,
            "is_superadmin": is_superadmin
        }
    }
