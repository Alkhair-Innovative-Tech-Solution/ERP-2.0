"""
Django admin configuration for Ticket app.
"""
from django.contrib import admin
from .models import Ticket, SubTicket, SLATemplate


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    """Admin interface for Ticket model."""
    list_display = ['ticket_id', 'title', 'status', 'priority', 'requestor_id', 'department_id', 'created_at']
    list_filter = ['status', 'priority', 'is_deleted']
    search_fields = ['title', 'description']
    ordering = ['-created_at']


@admin.register(SubTicket)
class SubTicketAdmin(admin.ModelAdmin):
    """Admin interface for SubTicket model."""
    list_display = ['id', 'title', 'status', 'parent_ticket_id', 'department_id', 'created_at']
    list_filter = ['status', 'priority']
    search_fields = ['title', 'description']
    ordering = ['-created_at']


@admin.register(SLATemplate)
class SLATemplateAdmin(admin.ModelAdmin):
    """Admin interface for SLATemplate model."""
    list_display = ['name', 'response_time', 'resolution_time', 'department_id', 'is_active']
    list_filter = ['is_active', 'is_deleted']
    search_fields = ['name', 'description']


