"""
Permissions API endpoints using Django Ninja.

Endpoints:
- GET /api/permissions/services - Get employee's available services
- GET /api/permissions/check/{service} - Check access to specific service
- GET /api/permissions/hdms-role - Get HDMS role info
"""
from pydantic import BaseModel
import re
from permissions.models import ServiceAccess, Service
from authentication.models import UserCredentials
from employees.models import Employee
from django.http import HttpRequest
from ninja import Router, Schema
from ninja.security import HttpBearer
from authentication.api import AuthBearer
from permissions.rbac import require_permission
from permissions.utils import (
    get_service_accesses,
    has_service_access,
    get_hdms_role,
    get_employee_permissions
)

router = Router(tags=["Permissions"], auth=AuthBearer())


from typing import Optional

# ================== Schemas ==================

class ServiceListResponse(Schema):
    employee_id: str
    employee_code: str
    full_name: str
    available_services: list


class ServiceAccessResponse(Schema):
    has_access: bool
    service: str
    role_info: Optional[dict] = None


class HdmsRoleResponse(Schema):
    has_access: bool
    role_type: Optional[str] = None
    can_view_all_tickets: bool = False
    can_assign_tickets: bool = False
    can_close_tickets: bool = False


class ErrorResponse(Schema):
    error: str
    detail: str = None

class GrantHdmsAccessSchema(BaseModel):
    """Schema for granting HDMS access"""
    employee_id: str  # IAK-0001 format
    password: str
    role: str  # requestor, moderator, assignee
    change_password: bool = True  # For existing users, whether to change password

class GrantHdmsAccessResponse(Schema):
    message: str
    employee_id: str
    role: str
    is_new_user: bool

# ================== Endpoints ==================

@router.get("/services", response={200: ServiceListResponse, 401: ErrorResponse})
@require_permission("service_access.view")
def get_available_services(request: HttpRequest):
    """
    Get list of services the authenticated employee can access.
    
    Returns list of service names (SIS, HDMS, etc.)
    """
    employee = request.auth
    services = get_service_accesses(employee)
    
    return 200, {
        "employee_id": employee.employee_id,
        "employee_code": employee.employee_code,
        "full_name": employee.full_name,
        "available_services": services
    }


@router.get("/check/{service}", response={200: ServiceAccessResponse, 401: ErrorResponse})
@require_permission("service_access.view")
def check_service_access(request: HttpRequest, service: str):
    """
    Check if employee has access to a specific service.
    
    Returns access status and role information if applicable.
    """
    employee = request.auth
    
    valid_services = list(Service.objects.filter(is_active=True).values_list('code', flat=True))
    if service not in valid_services:
        return 401, {
            "error": "Invalid service",
            "detail": f"Service must be one of: {', '.join(valid_services)}"
        }
    
    # Get permissions
    perms = get_employee_permissions(employee, service)
    
    role_info = None
    if perms.get('has_access'):
        if service == 'hdms' and 'hdms_role' in perms:
            role_info = perms['hdms_role']
        elif service == 'vms' and 'vms_role' in perms:
            role_info = perms['vms_role']
    
    return 200, {
        "has_access": perms.get('has_access', False),
        "service": service,
        "role_info": role_info
    }


@router.get("/hdms-role", response={200: HdmsRoleResponse, 401: ErrorResponse})
@require_permission("service_access.view")
def get_hdms_role_info(request: HttpRequest):
    """
    Get HDMS role information for authenticated employee.
    
    Returns role type and permissions.
    """
    employee = request.auth
    role = get_hdms_role(employee)
    
    if not role:
        return 200, {
            "has_access": False
        }
    
    return 200, {
        "has_access": True,
        **role
    }


@router.post("/grant-hdms-access", response={201: dict, 200: dict, 400: dict})
@require_permission("service_access.grant")
def grant_hdms_access(request, payload: GrantHdmsAccessSchema):
    """
    Grant HDMS access to an employee.

    Creates UserCredentials (if not exists), ServiceAccess for HDMS, and a
    catalog-driven tenant EmployeeRole (see permissions.hdms_catalog).

    Password requirements: Alphanumeric, at least 1 uppercase, 1 lowercase
    """
    # Validate password
    password = payload.password
    if payload.change_password or True:  # Always validate on new grant
        if len(password) < 6:
            return 400, {"error": "Password must be at least 6 characters"}
        if not re.search(r'[A-Z]', password):
            return 400, {"error": "Password must contain at least one uppercase letter"}
        if not re.search(r'[a-z]', password):
            return 400, {"error": "Password must contain at least one lowercase letter"}
        if not re.match(r'^[A-Za-z0-9]+$', password):
            return 400, {"error": "Password must be alphanumeric only"}

    # Validate role
    valid_roles = ['requestor', 'moderator', 'assignee', 'admin']
    if payload.role not in valid_roles:
        return 400, {"error": f"Role must be one of: {', '.join(valid_roles)}"}

    # Find employee
    try:
        employee = Employee.objects.get(employee_id=payload.employee_id, is_deleted=False)
    except Employee.DoesNotExist:
        return 400, {"error": f"Employee '{payload.employee_id}' not found"}

    is_new_user = False
    existing_access = False

    from permissions.hdms_catalog import assign_employee_hdms_role

    # Check if employee already has HDMS access
    try:
        service_access = ServiceAccess.objects.get(employee=employee, service='hdms')
        existing_access = True

        # Reactivate if was inactive
        if not service_access.is_active:
            service_access.is_active = True
            service_access.save()

    except ServiceAccess.DoesNotExist:
        # Create new ServiceAccess
        service_access = ServiceAccess.objects.create(
            employee=employee,
            service='hdms',
            is_active=True
        )
        is_new_user = True

    assign_employee_hdms_role(employee, payload.role)
    
    # Handle UserCredentials
    try:
        credentials = UserCredentials.objects.get(employee=employee)
        # Update password if requested
        if payload.change_password:
            credentials.set_password(password)
            credentials.save()
    except UserCredentials.DoesNotExist:
        # Create new credentials
        credentials = UserCredentials.objects.create(employee=employee)
        credentials.set_password(password)
        credentials.save()
        is_new_user = True
    
    # Build response message
    if existing_access:
        if payload.change_password:
            message = f"HDMS access updated for {employee.full_name}. Role: {payload.role}. Password changed."
        else:
            message = f"HDMS access updated for {employee.full_name}. Role changed to: {payload.role}."
        return 200, {
            "message": message,
            "employee_id": employee.employee_id,
            "employee_code": employee.employee_code,
            "role": payload.role,
            "is_new_user": False
        }
    else:
        return 201, {
            "message": f"HDMS access granted to {employee.full_name} as {payload.role}.",
            "employee_id": employee.employee_id,
            "employee_code": employee.employee_code,
            "role": payload.role,
            "is_new_user": True
        }


@router.get("/hdms-access/{employee_id}", response={200: dict, 404: dict})
@require_permission("service_access.view")
def check_employee_hdms_access(request, employee_id: str):
    """
    Check if an employee has HDMS access (for Grant Permission modal).
    Returns current role if exists.
    """
    try:
        employee = Employee.objects.get(employee_id=employee_id, is_deleted=False)
    except Employee.DoesNotExist:
        return 404, {"error": f"Employee '{employee_id}' not found"}

    from permissions.hdms_catalog import get_employee_hdms_role_type

    try:
        service_access = ServiceAccess.objects.get(employee=employee, service='hdms', is_active=True)
        return 200, {
            "has_access": True,
            "role": get_employee_hdms_role_type(employee),
            "employee_id": employee.employee_id,
            "employee_code": employee.employee_code,
            "full_name": employee.full_name
        }
    except ServiceAccess.DoesNotExist:
        return 200, {
            "has_access": False,
            "role": None,
            "employee_id": employee.employee_id,
            "employee_code": employee.employee_code,
            "full_name": employee.full_name
        }


# ================== HDMS Users List ==================

class HdmsUserSchema(Schema):
    """Schema for HDMS user list item"""
    id: str
    employee_code: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str  # moderator, assignee, requestor
    department: Optional[str] = None
    department_code: Optional[str] = None
    status: str  # active, inactive
    last_login: Optional[str] = None
    join_date: Optional[str] = None


class HdmsUsersListResponse(Schema):
    """Response schema for HDMS users list"""
    results: list[HdmsUserSchema]
    count: int


@router.get("/hdms-users", response={200: HdmsUsersListResponse})
@require_permission("service_access.view")
def list_hdms_users(
    request,
    search: str = None,
    role: str = None,
    department: str = None,
    status: str = None
):
    """
    List all employees with HDMS access.
    
    Query params:
    - search: Filter by name, email, or employee code
    - role: Filter by role (moderator, assignee, requestor)
    - department: Filter by department code
    - status: Filter by status (active, inactive)
    """
    # Get all active ServiceAccess records for HDMS
    service_accesses = ServiceAccess.objects.filter(
        service='hdms'
    ).select_related('employee').prefetch_related('employee__assignments__department')
    
    # Apply status filter
    if status == 'active':
        service_accesses = service_accesses.filter(is_active=True)
    elif status == 'inactive':
        service_accesses = service_accesses.filter(is_active=False)
    
    from permissions.hdms_catalog import get_employee_hdms_role_type

    # Build user list
    users = []
    for sa in service_accesses:
        employee = sa.employee

        # Skip if employee is deleted
        if employee.is_deleted:
            continue

        # Get HDMS role (catalog-driven)
        role_type = get_employee_hdms_role_type(employee)

        # Apply role filter
        if role and role_type != role:
            continue
        
        # Apply department filter
        if department and employee.department:
            if employee.department.dept_code != department:
                continue
        
        # Apply search filter
        if search:
            search_lower = search.lower()
            name_match = search_lower in employee.full_name.lower()
            email_match = employee.personal_email and search_lower in employee.personal_email.lower()
            code_match = search_lower in employee.employee_code.lower()
            
            if not (name_match or email_match or code_match):
                continue
        
        # Get department info
        dept_name = None
        dept_code = None
        if employee.department:
            dept_name = employee.department.dept_name
            dept_code = employee.department.dept_code
        
        # Get last login (from UserCredentials if exists)
        last_login = None
        try:
            if hasattr(employee, 'credentials') and employee.credentials:
                if employee.credentials.last_login:
                    last_login = employee.credentials.last_login.isoformat()
        except Exception:
            pass
        
        users.append({
            "id": str(employee.id),
            "employee_code": employee.employee_code,
            "name": employee.full_name,
            "email": employee.email,
            "phone": employee.phone,
            "role": role_type or 'requestor',
            "department": dept_name,
            "department_code": dept_code,
            "status": 'active' if sa.is_active else 'inactive',
            "last_login": last_login,
            "join_date": sa.granted_at.isoformat() if sa.granted_at else None
        })
    
    return 200, {
        "results": users,
        "count": len(users)
    }


# ================== VMS Endpoints ==================

class GrantVmsAccessSchema(BaseModel):
    employee_id: str
    password: str
    role: str  # admin, receptionist, security_staff
    change_password: bool = True


@router.post("/grant-vms-access", response={201: dict, 200: dict, 400: dict})
@require_permission("service_access.grant")
def grant_vms_access(request, payload: GrantVmsAccessSchema):
    """
    Grant VMS access to an employee with a role.

    Creates UserCredentials (if not exists), ServiceAccess for VMS, and a
    catalog-driven tenant EmployeeRole (see permissions.vms_catalog).
    """
    password = payload.password
    if len(password) < 6:
        return 400, {"error": "Password must be at least 6 characters"}
    if not re.search(r'[A-Z]', password):
        return 400, {"error": "Password must contain at least one uppercase letter"}
    if not re.search(r'[a-z]', password):
        return 400, {"error": "Password must contain at least one lowercase letter"}
    if not re.match(r'^[A-Za-z0-9]+$', password):
        return 400, {"error": "Password must be alphanumeric only"}

    valid_roles = ['admin', 'receptionist', 'security_staff']
    if payload.role not in valid_roles:
        return 400, {"error": f"Role must be one of: {', '.join(valid_roles)}"}

    try:
        employee = Employee.objects.get(employee_id=payload.employee_id, is_deleted=False)
    except Employee.DoesNotExist:
        return 400, {"error": f"Employee '{payload.employee_id}' not found"}

    is_new_user = False
    existing_access = False

    from permissions.vms_catalog import assign_employee_vms_role

    try:
        service_access = ServiceAccess.objects.get(employee=employee, service='vms')
        existing_access = True

        if not service_access.is_active:
            service_access.is_active = True
            service_access.save()

    except ServiceAccess.DoesNotExist:
        service_access = ServiceAccess.objects.create(
            employee=employee,
            service='vms',
            is_active=True
        )
        is_new_user = True

    assign_employee_vms_role(employee, payload.role)

    try:
        credentials = UserCredentials.objects.get(employee=employee)
        if payload.change_password:
            credentials.set_password(password)
            credentials.save()
    except UserCredentials.DoesNotExist:
        credentials = UserCredentials.objects.create(employee=employee)
        credentials.set_password(password)
        credentials.save()
        is_new_user = True

    if existing_access:
        msg = f"VMS access updated for {employee.full_name}. Role: {payload.role}."
        if payload.change_password:
            msg += " Password changed."
        return 200, {
            "message": msg,
            "employee_id": employee.employee_id,
            "employee_code": employee.employee_code,
            "role": payload.role,
            "is_new_user": False,
        }
    return 201, {
        "message": f"VMS access granted to {employee.full_name} as {payload.role}.",
        "employee_id": employee.employee_id,
        "employee_code": employee.employee_code,
        "role": payload.role,
        "is_new_user": True,
    }


@router.get("/vms-access/{employee_id}", response={200: dict, 404: dict})
@require_permission("service_access.view")
def check_employee_vms_access(request, employee_id: str):
    """Check if an employee has VMS access and their current role."""
    try:
        employee = Employee.objects.get(employee_id=employee_id, is_deleted=False)
    except Employee.DoesNotExist:
        return 404, {"error": f"Employee '{employee_id}' not found"}

    from permissions.vms_catalog import get_employee_vms_role_type

    try:
        service_access = ServiceAccess.objects.get(employee=employee, service='vms', is_active=True)
        return 200, {
            "has_access": True,
            "role": get_employee_vms_role_type(employee),
            "employee_id": employee.employee_id,
            "employee_code": employee.employee_code,
            "full_name": employee.full_name,
        }
    except ServiceAccess.DoesNotExist:
        return 200, {
            "has_access": False,
            "role": None,
            "employee_id": employee.employee_id,
            "employee_code": employee.employee_code,
            "full_name": employee.full_name,
        }


@router.get("/vms-role", response={200: dict, 401: dict})
@require_permission("service_access.view")
def get_vms_role_info(request: HttpRequest):
    """Get VMS role for the authenticated employee."""
    from permissions.vms_catalog import get_employee_vms_role_type

    employee = request.auth
    try:
        ServiceAccess.objects.get(employee=employee, service='vms', is_active=True)
        return 200, {"has_access": True, "role_type": get_employee_vms_role_type(employee)}
    except ServiceAccess.DoesNotExist:
        return 200, {"has_access": False, "role_type": None}


@router.get("/vms-users", response={200: dict})
@require_permission("service_access.view")
def list_vms_users(
    request,
    search: str = None,
    role: str = None,
    department: str = None,
    status: str = None,
):
    """List all employees with VMS access."""
    service_accesses = ServiceAccess.objects.filter(service='vms').select_related('employee')

    if status == 'active':
        service_accesses = service_accesses.filter(is_active=True)
    elif status == 'inactive':
        service_accesses = service_accesses.filter(is_active=False)

    from permissions.vms_catalog import get_employee_vms_role_type

    users = []
    for sa in service_accesses:
        employee = sa.employee
        if employee.is_deleted:
            continue

        role_type = get_employee_vms_role_type(employee)

        if role and role_type != role:
            continue

        if department and employee.department:
            if employee.department.dept_code != department:
                continue

        if search:
            search_lower = search.lower()
            if not any([
                search_lower in employee.full_name.lower(),
                employee.personal_email and search_lower in employee.personal_email.lower(),
                search_lower in employee.employee_code.lower(),
            ]):
                continue

        last_login = None
        try:
            if hasattr(employee, 'credentials') and employee.credentials and employee.credentials.last_login:
                last_login = employee.credentials.last_login.isoformat()
        except Exception:
            pass

        users.append({
            "id": str(employee.id),
            "employee_code": employee.employee_code,
            "name": employee.full_name,
            "email": employee.email,
            "role": role_type,
            "department": employee.department.dept_name if employee.department else None,
            "department_code": employee.department.dept_code if employee.department else None,
            "status": 'active' if sa.is_active else 'inactive',
            "last_login": last_login,
            "join_date": sa.granted_at.isoformat() if sa.granted_at else None,
        })

    return 200, {"results": users, "count": len(users)}


@router.post("/toggle-access", response={200: dict, 400: dict})
@require_permission("service_access.toggle")
def toggle_service_access(request, employee_id: str, service: str):
    """Toggle service access (active/inactive) for a user."""
    try:
        employee = Employee.objects.get(employee_id=employee_id, is_deleted=False)
    except Employee.DoesNotExist:
        return 400, {"error": f"Employee '{employee_id}' not found"}
        
    if service not in ['hdms', 'vms']:
        return 400, {"error": "Invalid service identifier"}
        
    try:
        sa = ServiceAccess.objects.get(employee=employee, service=service)
        sa.is_active = not sa.is_active
        sa.save()
        status_str = "activated" if sa.is_active else "deactivated"
        return 200, {
            "message": f"Successfully {status_str} {service.upper()} access for {employee.full_name}.",
            "is_active": sa.is_active
        }
    except ServiceAccess.DoesNotExist:
        return 400, {"error": f"No service access record found for {employee.full_name} under {service.upper()}."}