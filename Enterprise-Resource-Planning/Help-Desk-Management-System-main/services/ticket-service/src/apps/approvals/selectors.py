"""
Optimized query selectors for Approval app.
"""
from .models import Approval, ApprovalStatus


class ApprovalSelector:
    """Optimized queries for Approval model."""
    
    @staticmethod
    def get_pending_approvals(approver_id: str):
        """Get pending approvals for an approver."""
        return Approval.objects.filter(
            approver_id=approver_id,
            status=ApprovalStatus.PENDING,
            is_deleted=False
        ).order_by('-created_at')
    
    @staticmethod
    def get_ticket_approvals(ticket_id: str):
        """Get all approvals for a ticket."""
        return Approval.objects.filter(
            ticket_id=ticket_id,
            is_deleted=False
        ).order_by('-created_at')


