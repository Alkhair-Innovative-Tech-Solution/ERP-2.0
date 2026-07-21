"""
Django Admin configuration for Audit app.
"""
from django.contrib import admin
from django.utils.html import format_html
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Admin panel for Audit Logs - Read Only"""
    list_display = ['timestamp', 'action_badge', 'actor_name', 'content_type', 'field_name', 'value_summary']
    list_filter = ['action', 'content_type', 'timestamp']
    search_fields = ['changed_by__full_name', 'changed_by_superadmin__full_name', 'field_name', 'notes']
    readonly_fields = ['changed_by', 'changed_by_superadmin', 'content_type', 'object_id', 'action', 
                      'field_name', 'old_value', 'new_value', 'timestamp', 
                      'ip_address', 'notes']
    
    fieldsets = (
        ('Change Info', {
            'fields': ('action', 'content_type', 'object_id', 'field_name')
        }),
        ('Values', {
            'fields': ('old_value', 'new_value')
        }),
        ('Attribution', {
            'fields': (('changed_by', 'changed_by_superadmin'), 'timestamp', 'ip_address')
        }),
        ('Notes', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
    )
    
    def action_badge(self, obj):
        """Color-coded action badges"""
        colors = {
            'create': 'green',
            'update': 'orange',
            'delete': 'red',
            'restore': 'blue',
        }
        color = colors.get(obj.action, 'black')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color, obj.get_action_display()
        )
    action_badge.short_description = 'Action'
    
    def actor_name(self, obj):
        """Show name of actor (Employee or SuperAdmin)"""
        if obj.changed_by:
            return obj.changed_by.full_name
        if obj.changed_by_superadmin:
            return f"(SA) {obj.changed_by_superadmin.full_name}"
        return "-"
    actor_name.short_description = 'Performed By'

    def value_summary(self, obj):
        """Show old → new value summary"""
        if obj.action == 'update' and (obj.old_value or obj.new_value):
            old = (obj.old_value[:30] + '...') if obj.old_value and len(obj.old_value) > 30 else (obj.old_value or '')
            new = (obj.new_value[:30] + '...') if obj.new_value and len(obj.new_value) > 30 else (obj.new_value or '')
            return format_html(
                '<span style="color: gray;">{}</span> → <span style="color: blue;">{}</span>',
                old, new
            )
        return '-'
    value_summary.short_description = 'Change'
    
    def has_add_permission(self, request):
        """Audit logs are created automatically, not manually"""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Audit logs should never be deleted"""
        return False
    
    def has_change_permission(self, request, obj=None):
        """Audit logs are read-only"""
        return False