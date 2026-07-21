"""
Permissions models for service access control.

Controls:
- Which employees/superadmins can access which services
- HDMS-specific role assignments (Moderator/Assignee/Requestor)
- VMS-specific role assignments (Admin/Receptionist/Security Staff)
- SIS uses designation as role automatically

Adding a new service: insert a row into Service table — no code change needed.
"""
import uuid
from django.db import models
from django.core.exceptions import ValidationError
from employees.models import Employee
from employees.utils import SoftDeleteModel


class Service(models.Model):
    """
    Registry of all ERP services. Add new services here without code changes.

    To add a new service:
        Service.objects.create(code='finance', name='Finance Management')
    """
    code = models.CharField(max_length=20, unique=True, help_text="Short code used in code (e.g. 'hdms', 'vms')")
    name = models.CharField(max_length=100, help_text="Human-readable name")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "permissions_service"
        ordering = ['code']

    def __str__(self):
        return f"{self.code} — {self.name}"


class ServiceAccess(SoftDeleteModel):
    """
    Tracks which employees/superadmins have access to which services.

    Flow:
    1. Employee/SuperAdmin created → No service access by default
    2. Admin grants SIS access → Can login to SIS
    3. Admin grants HDMS access → Must also assign HdmsRole
    4. Admin grants VMS access → Must also assign VmsRole

    Example:
    - Ahmed (Teacher) → SIS Access ✓ → Logs in as Teacher (from designation)
    - Ahmed (Teacher) → HDMS Access ✓ + Moderator role → Logs in as Moderator
    - SuperAdmin → All services → Full access
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='service_accesses',
        null=True,
        blank=True,
        help_text="Employee who has access (if employee)"
    )

    superadmin = models.ForeignKey(
        'authentication.SuperAdmin',
        on_delete=models.CASCADE,
        related_name='service_accesses',
        null=True,
        blank=True,
        help_text="SuperAdmin who has access (if superadmin)"
    )

    service = models.CharField(
        max_length=20,
        help_text="Service code — must match an active Service.code (e.g. 'hdms', 'vms')"
    )
    
    is_active = models.BooleanField(
        default=True,
        help_text="Can user currently access this service?"
    )
    
    granted_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When access was granted"
    )
    
    granted_by = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='granted_accesses',
        help_text="Admin who granted this access"
    )
    
    revoked_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When access was revoked (if applicable)"
    )
    
    revoked_by = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='revoked_accesses',
        help_text="Admin who revoked this access"
    )
    
    notes = models.TextField(
        blank=True,
        null=True,
        help_text="Admin notes about this access grant"
    )
    
    class Meta:
        verbose_name = "Service Access"
        verbose_name_plural = "Service Accesses"
        db_table = "permissions_service_access"
        # Note: unique_together removed - will use custom validation instead
        indexes = [
            models.Index(fields=['employee', 'service', 'is_active']),
            models.Index(fields=['superadmin', 'service', 'is_active']),
            models.Index(fields=['service', 'is_active']),
        ]
    
    def clean(self):
        if not self.employee and not self.superadmin:
            raise ValidationError("Must link to either an Employee or SuperAdmin")
        if self.employee and self.superadmin:
            raise ValidationError("Cannot link to both Employee and SuperAdmin")
        if self.service and not Service.objects.filter(code=self.service, is_active=True).exists():
            raise ValidationError(f"Service '{self.service}' does not exist or is inactive.")

    def __str__(self):
        status = "Active" if self.is_active else "Inactive"
        name = self.employee.full_name if self.employee else (self.superadmin.full_name if self.superadmin else "?")
        return f"{name} → {self.service} ({status})"
    
    def revoke(self, revoked_by_employee):
        """Revoke this service access"""
        from django.utils import timezone
        self.is_active = False
        self.revoked_at = timezone.now()
        self.revoked_by = revoked_by_employee
        self.save()
    
    def reactivate(self):
        """Reactivate this service access"""
        self.is_active = True
        self.revoked_at = None
        self.revoked_by = None
        self.save()


class HdmsRole(SoftDeleteModel):
    """
    HDMS-specific role assignments.
    
    Only for HDMS service! SIS uses designation as role.
    
    Roles:
    - Admin: Full system access, can manage users and all settings
    - Moderator: Can manage tickets, assign to others, close tickets
    - Assignee: Can be assigned tickets, update status, add notes
    - Requestor: Can only create tickets and view own tickets
    
    Example:
    - Admin with HDMS access → Full system control
    - Teacher with HDMS access → Could be Moderator (manages student tech issues)
    - IT Staff with HDMS access → Could be Assignee (fixes issues)
    - Any employee with HDMS access → Could be Requestor (reports issues)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    service_access = models.OneToOneField(
        ServiceAccess,
        on_delete=models.CASCADE,
        related_name='hdms_role',
        help_text="HDMS service access this role is for"
    )
    
    ROLE_CHOICES = [
        ('admin', 'Administrator (Full system access)'),
        ('moderator', 'Moderator (Full ticket management)'),
        ('assignee', 'Assignee (Can be assigned tickets)'),
        ('requestor', 'Requestor (Can only create tickets)'),
    ]
    role_type = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        help_text="HDMS role type"
    )
    
    can_view_all_tickets = models.BooleanField(
        default=False,
        help_text="Can view all tickets (moderator privilege)"
    )
    
    can_assign_tickets = models.BooleanField(
        default=False,
        help_text="Can assign tickets to others (moderator privilege)"
    )
    
    can_close_tickets = models.BooleanField(
        default=False,
        help_text="Can close/resolve tickets (moderator privilege)"
    )
    
    can_manage_users = models.BooleanField(
        default=False,
        help_text="Can manage HDMS users and permissions (admin privilege)"
    )
    
    assigned_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When role was assigned"
    )
    
    assigned_by = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_hdms_roles',
        help_text="Admin who assigned this role"
    )
    
    class Meta:
        verbose_name = "HDMS Role"
        verbose_name_plural = "HDMS Roles"
        db_table = "permissions_hdms_role"
    
    def __str__(self):
        return f"{self.service_access.employee.full_name} → HDMS {self.role_type}"
    
    def clean(self):
        """Validate that service_access is for HDMS"""
        if self.service_access and self.service_access.service != 'hdms':
            raise ValidationError(
                'HdmsRole can only be assigned to HDMS service access.'
            )
    
    def save(self, *args, **kwargs):
        """Auto-set permissions based on role_type"""
        self.full_clean()
        
        # Set permissions based on role
        if self.role_type == 'admin':
            self.can_view_all_tickets = True
            self.can_assign_tickets = True
            self.can_close_tickets = True
            self.can_manage_users = True
        elif self.role_type == 'moderator':
            self.can_view_all_tickets = True
            self.can_assign_tickets = True
            self.can_close_tickets = True
            self.can_manage_users = False
        elif self.role_type == 'assignee':
            self.can_view_all_tickets = False
            self.can_assign_tickets = False
            self.can_close_tickets = True  # Can close tickets assigned to them
            self.can_manage_users = False
        elif self.role_type == 'requestor':
            self.can_view_all_tickets = False
            self.can_assign_tickets = False
            self.can_close_tickets = False
            self.can_manage_users = False
        
        super().save(*args, **kwargs)


class VmsRole(SoftDeleteModel):
    """
    VMS-specific role assignments.

    Roles:
    - admin: Full VMS access, manage users and settings
    - receptionist: Check-in/out visitors, manage visits
    - security_staff: View and verify visitor badges, basic check-out
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    service_access = models.OneToOneField(
        ServiceAccess,
        on_delete=models.CASCADE,
        related_name='vms_role',
        help_text="VMS service access this role is for"
    )

    ROLE_CHOICES = [
        ('admin', 'Administrator'),
        ('receptionist', 'Receptionist'),
        ('security_staff', 'Security Staff'),
    ]
    role_type = models.CharField(max_length=20, choices=ROLE_CHOICES)

    assigned_at = models.DateTimeField(auto_now_add=True)

    assigned_by = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_vms_roles',
    )

    class Meta:
        verbose_name = "VMS Role"
        verbose_name_plural = "VMS Roles"
        db_table = "permissions_vms_role"

    def __str__(self):
        return f"{self.service_access.employee.full_name} → VMS {self.role_type}"

    def clean(self):
        if self.service_access and self.service_access.service != 'vms':
            raise ValidationError('VmsRole can only be assigned to VMS service access.')


class PermissionAudit(models.Model):
    """
    Audit log for permission changes.
    
    Tracks:
    - Who granted/revoked access
    - When changes were made
    - What changed
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='permission_audits',
        help_text="Employee whose permissions changed"
    )
    
    ACTION_CHOICES = [
        ('grant_access', 'Access Granted'),
        ('revoke_access', 'Access Revoked'),
        ('assign_role', 'Role Assigned'),
        ('change_role', 'Role Changed'),
        ('remove_role', 'Role Removed'),
    ]
    action = models.CharField(
        max_length=20,
        choices=ACTION_CHOICES,
        help_text="What action was performed"
    )
    
    service = models.CharField(
        max_length=20,
        help_text="Which service (SIS/HDMS)"
    )
    
    details = models.JSONField(
        default=dict,
        help_text="Additional details about the change"
    )
    
    performed_by = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        related_name='performed_permission_changes',
        help_text="Admin who performed this action"
    )
    
    performed_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When action was performed"
    )
    
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address of admin"
    )
    
    class Meta:
        verbose_name = "Permission Audit"
        verbose_name_plural = "Permission Audits"
        db_table = "permissions_audit"
        ordering = ['-performed_at']
        indexes = [
            models.Index(fields=['employee', '-performed_at']),
            models.Index(fields=['service', '-performed_at']),
            models.Index(fields=['performed_by', '-performed_at']),
        ]
    
    def __str__(self):
        return f"{self.employee.full_name} - {self.get_action_display()} ({self.service})"


class Permission(models.Model):
    """Named action within a service. Defined by engineering via seed_permissions command."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    codename = models.CharField(max_length=100, unique=True, help_text="e.g. 'employee.create'")
    name = models.CharField(max_length=200, help_text="e.g. 'Create Employee'")
    service = models.CharField(max_length=20, help_text="Service code this permission belongs to")
    description = models.TextField(blank=True, default="")

    class Meta:
        db_table = "permissions_rbac_permission"
        ordering = ["service", "codename"]

    def __str__(self):
        return f"{self.service} / {self.codename}"


class Role(SoftDeleteModel):
    """Named bundle of permissions. Created and managed by admins at runtime."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, help_text="e.g. 'HR Manager'")
    service = models.CharField(max_length=20, help_text="Service code this role applies to")
    is_default = models.BooleanField(default=False, help_text="Pre-seeded default role")
    description = models.TextField(blank=True, default="")
    permissions = models.ManyToManyField(
        Permission,
        blank=True,
        related_name="roles",
        help_text="Permissions bundled into this role",
    )

    class Meta:
        db_table = "permissions_rbac_role"
        unique_together = [("name", "service")]
        ordering = ["service", "name"]

    def __str__(self):
        return f"{self.service} / {self.name}"


class EmployeeRole(SoftDeleteModel):
    """Assignment of a role to an employee. scope null = global."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="employee_roles",
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name="employee_roles",
    )
    # Phase 2: fill to restrict to a specific Branch or Institution. MVP: always null.
    scope_content_type = models.ForeignKey(
        "contenttypes.ContentType",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    scope_object_id = models.UUIDField(null=True, blank=True)
    granted_by = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="granted_employee_roles",
    )
    granted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "permissions_rbac_employee_role"

    def clean(self):
        qs = EmployeeRole.objects.filter(
            employee=self.employee,
            role=self.role,
            scope_content_type=self.scope_content_type,
            scope_object_id=self.scope_object_id,
        )
        if self.pk:
            qs = qs.exclude(pk=self.pk)
        if qs.exists():
            raise ValidationError("Employee already has this role at this scope.")

    def __str__(self):
        scope = f" @ {self.scope_object_id}" if self.scope_object_id else " (global)"
        return f"{self.employee} → {self.role}{scope}"


class EmployeePermissionOverride(SoftDeleteModel):
    """Per-employee permission grant or block that overrides role defaults."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="permission_overrides",
    )
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        related_name="employee_overrides",
    )
    is_allowed = models.BooleanField(
        help_text="True = grant extra permission. False = block permission from role.",
    )
    # Phase 2: scope restricts override to a Branch or Institution. MVP: always null.
    scope_content_type = models.ForeignKey(
        "contenttypes.ContentType",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    scope_object_id = models.UUIDField(null=True, blank=True)
    granted_by = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="granted_permission_overrides",
    )
    granted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "permissions_rbac_employee_permission_override"

    def clean(self):
        qs = EmployeePermissionOverride.objects.filter(
            employee=self.employee,
            permission=self.permission,
            scope_content_type=self.scope_content_type,
            scope_object_id=self.scope_object_id,
        )
        if self.pk:
            qs = qs.exclude(pk=self.pk)
        if qs.exists():
            raise ValidationError("Employee already has an override for this permission at this scope.")

    def __str__(self):
        action = "ALLOW" if self.is_allowed else "DENY"
        return f"{action}: {self.employee} → {self.permission}"
