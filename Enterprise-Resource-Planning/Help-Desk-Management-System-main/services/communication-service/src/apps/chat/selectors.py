"""
Optimized query selectors for Chat app.
"""
from .models import ChatMessage, TicketParticipant


class ChatSelector:
    """Optimized queries for Chat model."""
    
    @staticmethod
    def get_ticket_participants(ticket_id: str):
        """Get all participants for a ticket."""
        return TicketParticipant.objects.filter(ticket_id=ticket_id)
    
    @staticmethod
    def get_user_tickets(user_id: str):
        """Get all tickets a user participates in."""
        return TicketParticipant.objects.filter(user_id=user_id).values_list('ticket_id', flat=True)


