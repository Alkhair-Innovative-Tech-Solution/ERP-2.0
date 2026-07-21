"""
Utility functions for Ticket app.
"""
from .models import Ticket, TicketStatus


def get_ticket_status_display(ticket: Ticket) -> str:
    """Get ticket status display name."""
    return ticket.get_status_display() if hasattr(ticket, 'get_status_display') else ticket.status


def can_transition_status(current_status: str, new_status: str) -> bool:
    """Check if status transition is allowed."""
    # Add FSM validation logic here
    valid_transitions = {
        TicketStatus.DRAFT: [TicketStatus.SUBMITTED],
        TicketStatus.SUBMITTED: [TicketStatus.UNDER_REVIEW, TicketStatus.PENDING],
        # Add more transitions as needed
    }
    return new_status in valid_transitions.get(current_status, [])


