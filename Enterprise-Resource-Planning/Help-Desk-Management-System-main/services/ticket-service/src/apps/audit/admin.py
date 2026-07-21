"""
Django admin configuration for Audit app.
"""
from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Admin interface for AuditLog model."""
    list_display = ['id', 'action_type', 'category', 'model_name', 'object_id', 'performed_by_id', 'timestamp']
    list_filter = ['action_type', 'category', 'timestamp']
    search_fields = ['model_name', 'object_id', 'performed_by_id']
    readonly_fields = ['id', 'timestamp', 'old_state', 'new_state', 'changes']
    ordering = ['-timestamp']
    
    def has_add_permission(self, request):
        """Audit logs are immutable - cannot be created manually."""
        return False
    
    def has_change_permission(self, request, obj=None):
        """Audit logs are immutable - cannot be modified."""
        return False


