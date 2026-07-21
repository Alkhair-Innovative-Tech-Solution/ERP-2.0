"""
Django admin configuration for Chat app.
"""
from django.contrib import admin
from .models import ChatMessage, TicketParticipant


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    """Admin interface for ChatMessage model."""
    list_display = ['id', 'ticket_id', 'sender_id', 'created_at', 'is_deleted']
    list_filter = ['is_deleted', 'created_at']
    search_fields = ['ticket_id', 'sender_id', 'message']
    ordering = ['-created_at']


@admin.register(TicketParticipant)
class TicketParticipantAdmin(admin.ModelAdmin):
    """Admin interface for TicketParticipant model."""
    list_display = ['id', 'ticket_id', 'user_id', 'joined_at']
    list_filter = ['joined_at']
    search_fields = ['ticket_id', 'user_id']


