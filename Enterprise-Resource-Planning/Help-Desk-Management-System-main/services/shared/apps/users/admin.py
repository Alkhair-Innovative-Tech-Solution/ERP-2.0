"""
Django admin configuration for User app.
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth import get_user_model

User = get_user_model()


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin interface for User model."""
    list_display = ['employee_code', 'email', 'first_name', 'last_name', 'role', 'cnic', 'phone_number', 'is_active', 'is_deleted']
    list_filter = ['role', 'is_active', 'is_deleted', 'is_ceo']
    search_fields = ['employee_code', 'email', 'first_name', 'last_name', 'cnic', 'phone_number']
    ordering = ['employee_code']
     
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Personal Information', {
            'fields': ('cnic', 'phone_number')
        }),
        ('HDMS Information', {
            'fields': ('role', 'is_ceo', 'helpdesk_authorized', 'department_id')
        }),
        ('SMS Integration', {
            'fields': ('sms_user_id', 'last_sms_sync')
        }),
        ('Soft Delete', {
            'fields': ('is_deleted', 'deleted_at')
        }),
    )


