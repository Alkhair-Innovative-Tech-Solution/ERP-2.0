"""
Pydantic schemas for Approval Service.
"""
from ninja import Schema
from typing import Optional, Dict
from datetime import datetime


class ApprovalOut(Schema):
    """Approval output schema."""
    id: str
    ticket_id: str
    approver_id: str
    status: str
    reason: str
    documents: Dict
    created_at: datetime
    updated_at: datetime


class ApprovalIn(Schema):
    """Approval input schema."""
    ticket_id: str
    approver_id: str
    reason: Optional[str] = ""
    documents: Optional[Dict] = None


class ApprovalDecisionIn(Schema):
    """Approval decision schema."""
    status: str  # approved or rejected
    reason: Optional[str] = None


