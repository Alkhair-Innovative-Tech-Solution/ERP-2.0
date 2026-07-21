"""
Django admin configuration for Notification app.
"""
from django.contrib import admin
from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Admin interface for Notification model."""
    list_display = ['id', 'user_id', 'type', 'title', 'is_read', 'created_at']
    list_filter = ['type', 'is_read', 'is_deleted', 'created_at']
    search_fields = ['user_id', 'ticket_id', 'title', 'message']
    ordering = ['-created_at']


