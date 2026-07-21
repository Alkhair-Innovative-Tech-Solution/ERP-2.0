"""
Django signals for automatic audit logging with field-level tracking.
Includes user and IP tracking via middleware.
"""
from django.db.models.signals import post_save, pre_delete, pre_save
from django.dispatch import receiver
from django.contrib.contenttypes.models import ContentType
from employees.models import Employee, Department
from permissions.models import ServiceAccess, HdmsRole
from authentication.models import SuperAdmin
from .models import AuditLog
from .middleware import get_current_user, get_current_ip


# Store original values before save
_pre_save_instances = {}


def get_employee_from_request():
    """Get Employee object from current Django user (if exists)"""
    current_user = get_current_user()
    if current_user and current_user.is_authenticated:
        from django.db.models import Q
        # Check both personal and org email
        try:
            return Employee.objects.get(
                Q(personal_email=current_user.email) | Q(org_email=current_user.email)
            )
        except (Employee.DoesNotExist, Employee.MultipleObjectsReturned):
            pass
    return None


def get_superadmin_from_request():
    """Get SuperAdmin object from current Django user (if exists)"""
    current_user = get_current_user()
    if current_user and current_user.is_authenticated:
        try:
            # Check by email
            return SuperAdmin.objects.get(email=current_user.email)
        except (SuperAdmin.DoesNotExist, SuperAdmin.MultipleObjectsReturned):
            # Check by username if it matches superadmin_code format
            try:
                return SuperAdmin.objects.get(superadmin_code=current_user.username)
            except SuperAdmin.DoesNotExist:
                pass
    return None


@receiver(pre_save, sender=Employee)
def store_employee_pre_save(sender, instance, **kwargs):
    """Store original employee data before save"""
    if instance.pk:  # Only for updates
        try:
            original = Employee.all_objects.get(pk=instance.pk)
            _pre_save_instances[f'employee_{instance.pk}'] = original
        except Employee.DoesNotExist:
            pass


@receiver(post_save, sender=Employee)
def log_employee_change(sender, instance, created, **kwargs):
    """Log employee creation/updates with field-level tracking"""
    content_type = ContentType.objects.get_for_model(Employee)
    changed_by = get_employee_from_request()
    ip_address = get_current_ip()
    
    if created:
        # Log creation
        AuditLog.objects.create(
            content_type=content_type,
            object_id=str(instance.id),
            action='create',
            changed_by=changed_by,
            changed_by_superadmin=get_superadmin_from_request(),
            ip_address=ip_address,
            notes=f"Employee {instance.full_name} ({instance.employee_code}) was created"
        )
    else:
        # Log updates - check which fields changed
        original_key = f'employee_{instance.pk}'
        if original_key in _pre_save_instances:
            original = _pre_save_instances[original_key]
            
            # Track important fields
            fields_to_track = {
                'full_name': 'Full Name',
                'is_active': 'Active Status',
                'personal_email': 'Email',
                'personal_phone': 'Phone',
                'org_email': 'Org Email',
                'org_phone': 'Org Phone',
            }
            
            for field, display_name in fields_to_track.items():
                old_val = getattr(original, field, None)
                new_val = getattr(instance, field, None)
                
                # Convert FK to string for comparison
                if hasattr(old_val, '__str__'):
                    old_val = str(old_val)
                if hasattr(new_val, '__str__'):
                    new_val = str(new_val)
                
                if old_val != new_val:
                    AuditLog.objects.create(
                        content_type=content_type,
                        object_id=str(instance.id),
                        action='update',
                        field_name=field,
                        old_value=str(old_val) if old_val else '',
                        new_value=str(new_val) if new_val else '',
                        changed_by=changed_by,
                        changed_by_superadmin=get_superadmin_from_request(),
                        ip_address=ip_address,
                        notes=f"Employee {instance.full_name}: {display_name} changed"
                    )
            
            # Clean up
            del _pre_save_instances[original_key]


@receiver(pre_save, sender=Department)
def store_department_pre_save(sender, instance, **kwargs):
    """Store original department data before save"""
    if instance.pk:
        try:
            original = Department.all_objects.get(pk=instance.pk)
            _pre_save_instances[f'dept_{instance.pk}'] = original
        except Department.DoesNotExist:
            pass


@receiver(post_save, sender=Department)
def log_department_change(sender, instance, created, **kwargs):
    """Log department creation/updates with field-level tracking"""
    content_type = ContentType.objects.get_for_model(Department)
    changed_by = get_employee_from_request()
    ip_address = get_current_ip()
    
    if created:
        AuditLog.objects.create(
            content_type=content_type,
            object_id=str(instance.id),
            action='create',
            changed_by=changed_by,
            changed_by_superadmin=get_superadmin_from_request(),
            ip_address=ip_address,
            notes=f"Department {instance.dept_name} ({instance.dept_code}) was created"
        )
    else:
        original_key = f'dept_{instance.pk}'
        if original_key in _pre_save_instances:
            original = _pre_save_instances[original_key]
            
            fields_to_track = {
                'dept_name': 'Name',
                'dept_code': 'Code',
                'description': 'Description',
                'organization': 'Organization',
                'institution': 'Institution',
            }
            
            for field, display_name in fields_to_track.items():
                old_val = str(getattr(original, field, ''))
                new_val = str(getattr(instance, field, ''))
                
                if old_val != new_val:
                    AuditLog.objects.create(
                        content_type=content_type,
                        object_id=str(instance.id),
                        action='update',
                        field_name=field,
                        old_value=old_val,
                        new_value=new_val,
                        changed_by=changed_by,
                        changed_by_superadmin=get_superadmin_from_request(),
                        ip_address=ip_address,
                        notes=f"Department {instance.dept_name}: {display_name} changed"
                    )
            
            del _pre_save_instances[original_key]


@receiver(post_save, sender=ServiceAccess)
def log_service_access_change(sender, instance, created, **kwargs):
    """Log service access grants/changes"""
    content_type = ContentType.objects.get_for_model(ServiceAccess)
    action = 'create' if created else 'update'
    changed_by = instance.granted_by if created else get_employee_from_request()
    
    # Identify the user name for the notes
    user_name = "Unknown"
    if instance.employee:
        user_name = instance.employee.full_name
    elif instance.superadmin:
        user_name = instance.superadmin.full_name

    AuditLog.objects.create(
        content_type=content_type,
        object_id=str(instance.id),
        action=action,
        changed_by=changed_by,
        changed_by_superadmin=get_superadmin_from_request(),
        ip_address=get_current_ip(),
        notes=f"Service access to {instance.service} for {user_name} was {action}d"
    )


@receiver(post_save, sender=HdmsRole)
def log_hdms_role_change(sender, instance, created, **kwargs):
    """Log HDMS role assignments"""
    content_type = ContentType.objects.get_for_model(HdmsRole)
    action = 'create' if created else 'update'
    changed_by = instance.assigned_by if created else get_employee_from_request()
    
    # Identify the user name for the notes
    user_name = "Unknown"
    if instance.service_access.employee:
        user_name = instance.service_access.employee.full_name
    elif instance.service_access.superadmin:
        user_name = instance.service_access.superadmin.full_name

    AuditLog.objects.create(
        content_type=content_type,
        object_id=str(instance.id),
        action=action,
        changed_by=changed_by,
        changed_by_superadmin=get_superadmin_from_request(),
        ip_address=get_current_ip(),
        notes=f"HDMS role {instance.role_type} for {user_name} was {action}d"
    )


@receiver(pre_delete, sender=Employee)
def log_employee_delete(sender, instance, **kwargs):
    """Log employee deletion"""
    AuditLog.objects.create(
        content_type=ContentType.objects.get_for_model(Employee),
        object_id=str(instance.id),
        action='delete',
        changed_by=get_employee_from_request(),
        changed_by_superadmin=get_superadmin_from_request(),
        ip_address=get_current_ip(),
        notes=f"Employee {instance.full_name} ({instance.employee_code}) was deleted"
    )