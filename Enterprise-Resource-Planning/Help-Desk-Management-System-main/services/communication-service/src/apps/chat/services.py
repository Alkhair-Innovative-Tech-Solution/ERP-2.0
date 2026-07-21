"""
Business logic services for Chat app.
"""
from typing import Optional, List
from django.db import transaction as db_transaction
from .models import ChatMessage, TicketParticipant
# Lazy imports to avoid Django settings access at module level


class ChatService:
    """Service for chat-related business logic."""
    
    @staticmethod
    def get_messages_for_ticket(ticket_id: str, after_timestamp=None) -> List[ChatMessage]:
        """Get chat messages for a ticket."""
        queryset = ChatMessage.objects.filter(
            ticket_id=ticket_id,
            is_deleted=False
        )
        
        if after_timestamp:
            queryset = queryset.filter(created_at__gt=after_timestamp)
        
        return queryset.order_by('created_at')
    
    @staticmethod
    @db_transaction.atomic
    def send_message(ticket_id: str, sender_id: str, message: str, mentions: List[str] = None) -> ChatMessage:
        """Send a chat message."""
        # Lazy imports to avoid Django settings access at module level
        from hdms_core.clients.ticket_client import TicketClient
        from hdms_core.clients.user_client import UserClient
        
        # Validate ticket exists
        if not TicketClient.validate_ticket(ticket_id):
            raise ValueError("Ticket does not exist")
        
        # Validate sender exists
        if not UserClient.validate_user(sender_id):
            raise ValueError("Sender does not exist")
        
        chat_message = ChatMessage.objects.create(
            ticket_id=ticket_id,
            sender_id=sender_id,
            message=message,
            mentions=mentions or []
        )
        return chat_message
    
    @staticmethod
    def add_participant(ticket_id: str, user_id: str):
        """Add participant to ticket chat."""
        TicketParticipant.objects.get_or_create(
            ticket_id=ticket_id,
            user_id=user_id
        )

