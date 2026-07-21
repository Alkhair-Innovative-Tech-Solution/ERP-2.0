"""
Optimized query selectors for Ticket app.
"""
from django.db.models import Q
from .models import Ticket


class TicketSelector:
    """Optimized queries for Ticket model."""
    
    @staticmethod
    def get_user_tickets(user_id: str, status: str = None):
        """Get tickets for a user (as requestor or assignee)."""
        queryset = Ticket.objects.filter(
            Q(requestor_id=user_id) | Q(assignee_id=user_id),
            is_deleted=False
        )
        if status:
            queryset = queryset.filter(status=status)
        return queryset.select_related().order_by('-created_at')
    
    @staticmethod
    def get_department_tickets(department_id: str):
        """Get tickets for a department."""
        return Ticket.objects.filter(
            department_id=department_id,
            is_deleted=False
        ).select_related().order_by('-created_at')
    
    @staticmethod
    def get_tickets_by_status(status: str):
        """Get tickets by status."""
        return Ticket.objects.filter(
            status=status,
            is_deleted=False
        ).select_related().order_by('-created_at')


