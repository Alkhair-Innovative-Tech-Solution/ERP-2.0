"""
Django Admin configuration for Permissions app.
"""
from django.contrib import admin
from django.utils.html import format_html
from .models import ServiceAccess, HdmsRole, PermissionAudit, Permission, Role, EmployeeRole, EmployeePermissionOverride


@admin.register(ServiceAccess)
class ServiceAccessAdmin(admin.ModelAdmin):
    """Admin panel for Service Access"""
    list_display = ['employee', 'superadmin', 'service', 'is_active_badge', 'granted_at', 'granted_by']
    list_filter = ['service', 'is_active', 'granted_at']
    search_fields = ['employee__employee_code', 'employee__full_name', 'superadmin__superadmin_code', 'superadmin__full_name']
    readonly_fields = ['granted_at', 'granted_by', 'revoked_at', 'revoked_by', 
                      'created_at', 'updated_at', 'deleted_at', 'deleted_by']
    autocomplete_fields = ['employee', 'superadmin']
    
    fieldsets = (
        ('Access Info', {
            'fields': ('employee', 'superadmin', 'service', 'is_active')
        }),
        ('Grant Details', {
            'fields': ('granted_at', 'granted_by', 'notes')
        }),
        ('Revocation', {
            'fields': ('revoked_at', 'revoked_by'),
            'classes': ('collapse',)
        }),
        ('Soft Delete', {
            'fields': ('is_deleted', 'deleted_at', 'deleted_by', 'deletion_reason'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['activate_access', 'deactivate_access', 'restore_items']
    
    def is_active_badge(self, obj):
        if obj.is_active:
            return format_html('<span style="color: green; font-weight: bold;">✓ Active</span>')
        return format_html('<span style="color: red; font-weight: bold;">❌ Revoked</span>')
    is_active_badge.short_description = 'Status'
    
    def activate_access(self, request, queryset):
        count = 0
        for access in queryset:
            if not access.is_active:
                access.reactivate()
                count += 1
        self.message_user(request, f'{count} access(es) activated.')
    activate_access.short_description = 'Activate selected accesses'
    
    def deactivate_access(self, request, queryset):
        # Get current admin employee (would need to be implemented)
        for access in queryset:
            if access.is_active:
                access.revoke(revoked_by_employee=None)  # TODO: Get current admin
        self.message_user(request, f'{queryset.count()} access(es) revoked.')
    deactivate_access.short_description = 'Revoke selected accesses'
    
    def restore_items(self, request, queryset):
        count = 0
        for obj in queryset:
            if obj.is_deleted:
                obj.restore()
                count += 1
        self.message_user(request, f'{count} access(es) restored.')
    restore_items.short_description = 'Restore deleted accesses'
    
    def get_queryset(self, request):
        return ServiceAccess.all_objects.all()
    
    def save_model(self, request, obj, form, change):
        # TODO: Set granted_by to current admin employee
        super().save_model(request, obj, form, change)


@admin.register(HdmsRole)
class HdmsRoleAdmin(admin.ModelAdmin):
    """Admin panel for HDMS Roles"""
    list_display = ['employee_name', 'role_type_badge', 'permissions_summary', 'assigned_at', 'assigned_by']
    list_filter = ['role_type', 'assigned_at']
    search_fields = ['service_access__employee__employee_code', 'service_access__employee__full_name']
    readonly_fields = ['can_view_all_tickets', 'can_assign_tickets', 'can_close_tickets',
                      'assigned_at', 'assigned_by', 'created_at', 'updated_at', 'deleted_at', 'deleted_by']
    
    fieldsets = (
        ('Role Assignment', {
            'fields': ('service_access', 'role_type'),
            'description': 'Select HDMS service access and role type. Permissions are set automatically.'
        }),
        ('Auto-Set Permissions (Read-only)', {
            'fields': ('can_view_all_tickets', 'can_assign_tickets', 'can_close_tickets'),
            'classes': ('collapse',)
        }),
        ('Assignment Details', {
            'fields': ('assigned_at', 'assigned_by')
        }),
        ('Soft Delete', {
            'fields': ('is_deleted', 'deleted_at', 'deleted_by', 'deletion_reason'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['restore_items']
    
    def employee_name(self, obj):
        return obj.service_access.employee.full_name + " || "+ obj.service_access.employee.employee_code
    employee_name.short_description = 'Employee || Employee Code'
    
    def role_type_badge(self, obj):
        colors = {
            'moderator': '#8B0900',  # Dark red
            'assignee': '#0066cc',   # Blue
            'requestor': '#666666'   # Gray
        }
        color = colors.get(obj.role_type, '#00880')
        return format_html(
            '<span style="color: {}; font-weight: bold;"> ● {}</span>',
            color, obj.get_role_type_display()
        )
    role_type_badge.short_description = 'HDMS Role'
    
    def permissions_summary(self, obj):
        perms = []
        if obj.can_view_all_tickets:
            perms.append('View All')
        if obj.can_assign_tickets:
            perms.append('Assign')
        if obj.can_close_tickets:
            perms.append('Close')
        return ', '.join(perms) if perms else 'View Own Only'
    permissions_summary.short_description = 'Permissions'
    
    def restore_items(self, request, queryset):
        count = 0
        for obj in queryset:
            if obj.is_deleted:
                obj.restore()
                count += 1
        self.message_user(request, f'{count} role(s) restored.')
    restore_items.short_description = 'Restore deleted roles'
    
    def get_queryset(self, request):
        return HdmsRole.all_objects.select_related('service_access__employee').all()
    
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        """Only show HDMS service accesses in dropdown"""
        if db_field.name == "service_access":
            kwargs["queryset"] = ServiceAccess.objects.filter(service='hdms', is_deleted=False)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


@admin.register(PermissionAudit)
class PermissionAuditAdmin(admin.ModelAdmin):
    """Admin panel for Permission Audit Log"""
    list_display = ['employee', 'action_badge', 'service', 'performed_by', 'performed_at']
    list_filter = ['action', 'service', 'performed_at']
    search_fields = ['employee__employee_code', 'employee__full_name', 'performed_by__full_name']
    readonly_fields = ['employee', 'action', 'service', 'details', 'performed_by', 'performed_at', 'ip_address']
    
    fieldsets = (
        ('Audit Info', {
            'fields': ('employee', 'action', 'service', 'details')
        }),
        ('Performed By', {
            'fields': ('performed_by', 'performed_at', 'ip_address')
        }),
    )
    
    def action_badge(self, obj):
        colors = {
            'grant_access': 'green',
            'revoke_access': 'red',
            'assign_role': 'blue',
            'change_role': 'orange',
            'remove_role': 'gray',
        }
        color = colors.get(obj.action, 'black')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color, obj.get_action_display()
        )
    action_badge.short_description = 'Action'
    
    def has_add_permission(self, request):
        # Audit logs are created automatically, not manually
        return False
    
    def has_delete_permission(self, request, obj=None):
        # Audit logs should not be deleted
        return False


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ["codename", "name", "service"]
    list_filter = ["service"]
    search_fields = ["codename", "name"]
    ordering = ["service", "codename"]
    readonly_fields = ["codename", "service"]


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ["name", "service", "is_default", "permission_count"]
    list_filter = ["service", "is_default"]
    search_fields = ["name"]
    filter_horizontal = ["permissions"]

    def permission_count(self, obj):
        return obj.permissions.count()
    permission_count.short_description = "# Permissions"


@admin.register(EmployeeRole)
class EmployeeRoleAdmin(admin.ModelAdmin):
    list_display = ["employee", "role", "granted_by", "granted_at"]
    list_filter = ["role__service"]
    search_fields = ["employee__full_name", "role__name"]
    raw_id_fields = ["employee", "role", "granted_by"]
    readonly_fields = ["granted_at"]


@admin.register(EmployeePermissionOverride)
class EmployeePermissionOverrideAdmin(admin.ModelAdmin):
    list_display = ["employee", "permission", "is_allowed", "granted_by", "granted_at"]
    list_filter = ["is_allowed", "permission__service"]
    search_fields = ["employee__full_name", "permission__codename"]
    raw_id_fields = ["employee", "permission", "granted_by"]
    readonly_fields = ["granted_at"]
