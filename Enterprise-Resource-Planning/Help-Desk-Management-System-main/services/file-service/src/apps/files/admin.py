"""
Django admin configuration for File app.
"""
from django.contrib import admin
from .models import Attachment


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    """Admin interface for Attachment model."""
    list_display = ['file_key', 'original_filename', 'file_size', 'scan_status', 'uploaded_by_id', 'created_at']
    list_filter = ['scan_status', 'is_processed', 'is_deleted', 'created_at']
    search_fields = ['file_key', 'original_filename', 'ticket_id', 'chat_message_id']
    ordering = ['-created_at']
    readonly_fields = ['file_key', 'scan_status', 'scanned_at', 'scan_result']
