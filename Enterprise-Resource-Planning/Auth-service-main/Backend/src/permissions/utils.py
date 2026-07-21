"""
Helper utilities for permissions checking.

Used by authentication APIs and middleware to verify:
- Does employee have access to requested service?
- What is employee's role in HDMS?
- What permissions does employee have?
"""
from permissions.models import ServiceAccess, HdmsRole, VmsRole


def has_service_access(employee, service_name):
    """
    Check if employee has active access to a service.
    
    Args:
        employee: Employee object
        service_name: 'sis' | 'hdms' | 'finance' | 'hr' | 'procurement'
    
    Returns:
        Boolean: True if has active access
    """
    try:
        access = ServiceAccess.objects.get(
            employee=employee,
            service=service_name,
            is_active=True,
            is_deleted=False
        )
        return True
    except ServiceAccess.DoesNotExist:
        return False


def get_service_accesses(employee):
    """
    Get all active service accesses for employee.
    
    Returns:
        List of service names employee can access
    """
    accesses = ServiceAccess.objects.filter(
        employee=employee,
        is_active=True,
        is_deleted=False
    ).values_list('service', flat=True)
    
    return list(accesses)


def get_hdms_role(employee):
    """
    Get employee's HDMS role if they have HDMS access.
    
    Returns:
        dict with role_type and permissions, or None if no HDMS access
    """
    try:
        # Check if has HDMS access
        access = ServiceAccess.objects.get(
            employee=employee,
            service='hdms',
            is_active=True,
            is_deleted=False
        )
        
        # Get HDMS role
        hdms_role = HdmsRole.objects.get(
            service_access=access,
            is_deleted=False
        )
        
        return {
            'role_type': hdms_role.role_type,
            'can_view_all_tickets': hdms_role.can_view_all_tickets,
            'can_assign_tickets': hdms_role.can_assign_tickets,
            'can_close_tickets': hdms_role.can_close_tickets
        }
    except (ServiceAccess.DoesNotExist, HdmsRole.DoesNotExist):
        return None


def get_sis_role(employee):
    """
    Get employee's SIS role based on primary designation.
    """
    # Check if has SIS access
    if not has_service_access(employee, 'sis'):
        return None
    
    primary = employee.assignments.filter(is_primary=True, is_active=True).first()
    if not primary:
        return None
    
    return {
        'role_type': 'designation_based',
        'designation': primary.designation.position_name,
        'designation_code': primary.designation.position_code,
        'department': primary.department.dept_name
    }


def get_vms_role(employee):
    """Get employee's VMS role if they have VMS access."""
    try:
        access = ServiceAccess.objects.get(employee=employee, service='vms', is_active=True, is_deleted=False)
        vms_role = VmsRole.objects.get(service_access=access, is_deleted=False)
        return {'role_type': vms_role.role_type}
    except (ServiceAccess.DoesNotExist, VmsRole.DoesNotExist):
        return None


def get_employee_permissions(employee, service_name):
    """
    Get complete permissions info for employee in a service.
    
    Args:
        employee: Employee object
        service_name: 'sis' | 'hdms'
    
    Returns:
        dict with access info and role details
    """
    # Check access
    if not has_service_access(employee, service_name):
        return {
            'has_access': False,
            'service': service_name
        }
    
    result = {
        'has_access': True,
        'service': service_name,
        'employee_id': employee.employee_id,
        'employee_code': employee.employee_code,
        'full_name': employee.full_name
    }
    
    if service_name == 'hdms':
        hdms_role = get_hdms_role(employee)
        if hdms_role:
            result['hdms_role'] = hdms_role
        else:
            result['has_access'] = False
            result['error'] = 'HDMS access granted but no role assigned'

    elif service_name == 'sis':
        sis_role = get_sis_role(employee)
        if sis_role:
            result['sis_role'] = sis_role

    elif service_name == 'vms':
        vms_role = get_vms_role(employee)
        if vms_role:
            result['vms_role'] = vms_role
        else:
            result['has_access'] = False
            result['error'] = 'VMS access granted but no role assigned'

    return result


def create_audit_log(employee, action, service, details, performed_by, ip_address=None):
    """
    Create permission audit log entry.
    
    Args:
        employee: Employee whose permissions changed
        action: 'grant_access' | 'revoke_access' | 'assign_role' | etc.
        service: 'sis' | 'hdms'
        details: dict with additional info
        performed_by: Admin employee who performed action
        ip_address: Optional IP address
    """
    from permissions.models import PermissionAudit
    
    PermissionAudit.objects.create(
        employee=employee,
        action=action,
        service=service,
        details=details,
        performed_by=performed_by,
        ip_address=ip_address
    )
