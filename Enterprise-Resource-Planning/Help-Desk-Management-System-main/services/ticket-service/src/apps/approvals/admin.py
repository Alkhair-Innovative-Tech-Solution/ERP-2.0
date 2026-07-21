"""
Django admin configuration for Approval app.
"""
from django.contrib import admin
from .models import Approval


@admin.register(Approval)
class ApprovalAdmin(admin.ModelAdmin):
    """Admin interface for Approval model."""
    list_display = ['id', 'ticket_id', 'approver_id', 'status', 'created_at']
    list_filter = ['status', 'is_deleted']
    search_fields = ['ticket_id', 'approver_id']
    ordering = ['-created_at']


