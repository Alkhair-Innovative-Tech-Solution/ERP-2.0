"""
Business logic services for Approval app.
"""
from typing import Optional
from django.db import transaction as db_transaction
from .models import Approval, ApprovalStatus
from core.clients.user_client import UserClient


class ApprovalService:
    """Service for approval-related business logic."""
    
    @staticmethod
    def get_approval_by_id(approval_id: str) -> Optional[Approval]:
        """Get approval by ID."""
        try:
            return Approval.objects.get(id=approval_id, is_deleted=False)
        except Approval.DoesNotExist:
            return None
    
    @staticmethod
    @db_transaction.atomic
    def create_approval(ticket_id: str, approver_id: str, reason: str = "") -> Approval:
        """Create a new approval request."""
        # Validate approver exists
        if not UserClient.validate_user(approver_id):
            raise ValueError("Approver does not exist")
        
        approval = Approval.objects.create(
            ticket_id=ticket_id,
            approver_id=approver_id,
            reason=reason,
            status=ApprovalStatus.PENDING
        )
        return approval
    
    @staticmethod
    @db_transaction.atomic
    def approve(approval_id: str) -> Approval:
        """Approve a request."""
        approval = ApprovalService.get_approval_by_id(approval_id)
        if not approval:
            raise ValueError("Approval not found")
        
        approval.status = ApprovalStatus.APPROVED
        approval.save()
        return approval
    
    @staticmethod
    @db_transaction.atomic
    def reject(approval_id: str, reason: str = "") -> Approval:
        """Reject a request."""
        approval = ApprovalService.get_approval_by_id(approval_id)
        if not approval:
            raise ValueError("Approval not found")
        
        approval.status = ApprovalStatus.REJECTED
        approval.reason = reason
        approval.save()
        return approval
