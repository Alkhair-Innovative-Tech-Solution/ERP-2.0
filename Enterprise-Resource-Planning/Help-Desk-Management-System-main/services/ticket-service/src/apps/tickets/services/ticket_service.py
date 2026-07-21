"""
Business logic services for Ticket operations.
"""
from typing import Optional
from django.db import transaction as db_transaction
from ..models.ticket import Ticket, TicketStatus
from hdms_core.clients.user_client import UserClient


class TicketService:
    """Service for ticket-related business logic."""
    
    @staticmethod
    def get_ticket_by_id(ticket_id: str) -> Optional[Ticket]:
        """Get ticket by ID."""
        try:
            return Ticket.objects.get(id=ticket_id, is_deleted=False)
        except (Ticket.DoesNotExist, ValueError):
            return None
    
    @staticmethod
    @db_transaction.atomic
    def create_ticket(data: dict, requestor_id: str) -> Ticket:
        """Create a new ticket."""
        # Validate requestor exists
        if not UserClient.validate_user(requestor_id):
            raise ValueError("requestor does not exist")
        
        ticket = Ticket.objects.create(
            requestor_id=requestor_id,
            **data
        )
        return ticket
    
    @staticmethod
    @db_transaction.atomic
    def update_ticket_status(ticket_id: str, new_status: str, user_id: str):
        """Update ticket status with validation."""
        ticket = TicketService.get_ticket_by_id(ticket_id)
        if not ticket:
            raise ValueError("Ticket not found")
        
        # Validate user has permission
        if not UserClient.validate_user(user_id):
            raise ValueError("User does not exist")
        
        # Use FSM transition
        if new_status == TicketStatus.SUBMITTED:
            ticket.submit()
        elif new_status == TicketStatus.IN_PROGRESS:
            ticket.start_progress()
        elif new_status == TicketStatus.RESOLVED:
            ticket.resolve()
        elif new_status == TicketStatus.CLOSED:
            ticket.close()
        
        ticket.save()
        return ticket
