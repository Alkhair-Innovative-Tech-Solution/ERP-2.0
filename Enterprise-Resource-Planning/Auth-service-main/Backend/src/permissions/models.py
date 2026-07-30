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
from employees.models import Employee, Tenant
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


class Subscription(SoftDeleteModel):
    """
    Gate: which services a Tenant (paying customer) has purchased.
    Generalizes ServiceAccess — ServiceAccess grants an individual employee
    access WITHIN a service the employee's tenant is subscribed to.

    A request for a service the tenant did NOT subscribe to must be rejected
    even if the individual employee has ServiceAccess/roles for it.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='subscriptions',
    )
    service = models.ForeignKey(
        Service,
        on_delete=models.PROTECT,
        related_name='subscriptions',
    )

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('trial', 'Trial'),
        ('suspended', 'Suspended'),
        ('cancelled', 'Cancelled'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')

    started_at = models.DateTimeField(auto_now_add=True)
    ends_at = models.DateTimeField(null=True, blank=True, help_text="Null = no fixed end date")
    notes = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Subscription"
        verbose_name_plural = "Subscriptions"
        db_table = "permissions_subscription"
        unique_together = [("tenant", "service")]

    def __str__(self):
        return f"{self.tenant.tenant_code} → {self.service.code} ({self.status})"

    @property
    def is_active(self):
        from django.utils import timezone
        if self.status != 'active':
            return False
        if self.ends_at and self.ends_at < timezone.now():
            return False
        return True

    @classmethod
    def tenant_has_active(cls, tenant_id, service_code: str) -> bool:
        """Does this tenant have an active, non-expired subscription for this service?"""
        if not tenant_id:
            return False
        from django.utils import timezone
        qs = cls.objects.filter(
            tenant_id=tenant_id,
            service__code=service_code,
            status='active',
            is_deleted=False,
        )
        now = timezone.now()
        return qs.filter(models.Q(ends_at__isnull=True) | models.Q(ends_at__gte=now)).exists()


class ServiceAccess(SoftDeleteModel):
    """
    Tracks which employees/superadmins have access to which services.

    Flow:
    1. Employee/SuperAdmin created → No service access by default
    2. Admin grants SIS access → Can login to SIS
    3. Admin grants HDMS access → Must also assign HdmsRole
    4. Admin grants VMS access → Must also assign a catalog Role (see permissions.vms_catalog)

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
        # Tenant gate: employee's tenant must have an active Subscription for this service.
        # Legacy employees without a tenant (pre-multi-tenant data) are left unchecked.
        if self.employee and self.employee.tenant_id and self.service:
            if not Subscription.tenant_has_active(self.employee.tenant_id, self.service):
                raise ValidationError(
                    f"Tenant '{self.employee.tenant.tenant_code}' has no active subscription for '{self.service}'."
                )

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
    """Named bundle of permissions. Created and managed by admins at runtime.

    Legacy generic roles (pre-multi-tenant) carry only `service` (charfield)
    and leave `tenant`/`service_catalog` null. Catalog-driven, tenant-scoped
    roles (e.g. VMS default role templates cloned per tenant) set all four:
    `tenant`, `service_catalog`, plus the legacy `service` code for back-compat
    with existing lookups that filter by the string code.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, help_text="e.g. 'HR Manager'")
    service = models.CharField(max_length=20, help_text="Service code this role applies to")
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="roles",
        help_text="Tenant this role is scoped to. Null = legacy global/template role.",
    )
    service_catalog = models.ForeignKey(
        Service,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="roles",
        help_text="Service this role is scoped to (FK). Null = legacy role predating the catalog.",
    )
    is_default = models.BooleanField(default=False, help_text="Pre-seeded default role")
    is_template = models.BooleanField(
        default=False,
        help_text="Catalog template (tenant=null, service_catalog set) cloned into per-tenant roles.",
    )
    description = models.TextField(blank=True, default="")
    permissions = models.ManyToManyField(
        Permission,
        blank=True,
        related_name="roles",
        help_text="Permissions bundled into this role",
    )

    class Meta:
        db_table = "permissions_rbac_role"
        # Postgres treats NULL as distinct in unique_together, so a plain
        # ("name", "service", "tenant") constraint would NOT catch duplicate
        # legacy global roles (tenant=NULL). Two partial constraints instead.
        constraints = [
            models.UniqueConstraint(
                fields=["name", "service"],
                condition=models.Q(tenant__isnull=True),
                name="uniq_role_name_service_global",
            ),
            models.UniqueConstraint(
                fields=["name", "service", "tenant"],
                condition=models.Q(tenant__isnull=False),
                name="uniq_role_name_service_tenant",
            ),
        ]
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
