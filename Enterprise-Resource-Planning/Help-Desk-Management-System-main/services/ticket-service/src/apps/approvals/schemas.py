"""
Pydantic schemas for Approval Service.
"""
from ninja import Schema
from typing import Optional, Dict
from datetime import datetime
from uuid import UUID


class ApprovalOut(Schema):
    """Approval output schema.

    Pre-existing bug, unrelated to central-auth wiring: id/ticket_id/
    approver_id were typed `str` while the model fields are UUID —
    Pydantic v2 doesn't auto-coerce UUID -> str, so `.from_orm()` always
    500'd. Never surfaced before because this router had no auth at all
    (nothing exercised it end-to-end). Fixed to match TicketOut's
    established `UUID` typing convention.
    """
    id: UUID
    ticket_id: UUID
    approver_id: UUID
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


