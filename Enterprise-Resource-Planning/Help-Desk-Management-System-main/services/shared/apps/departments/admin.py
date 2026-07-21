"""
Django admin configuration for Department app.
"""
from django.contrib import admin
from .models import Department


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    """Admin interface for Department model."""
    list_display = ['name', 'code', 'head_id', 'active_tickets', 'total_capacity', 'queue_enabled', 'is_deleted']
    list_filter = ['queue_enabled', 'is_deleted']
    search_fields = ['name', 'code']
    ordering = ['name']


