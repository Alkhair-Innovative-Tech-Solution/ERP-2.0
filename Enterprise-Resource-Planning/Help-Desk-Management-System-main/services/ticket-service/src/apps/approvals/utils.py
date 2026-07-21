"""
Utility functions for Approval app.
"""
from .models import Approval, ApprovalStatus


def get_approval_status_display(approval: Approval) -> str:
    """Get approval status display name."""
    return approval.get_status_display() if hasattr(approval, 'get_status_display') else approval.status


