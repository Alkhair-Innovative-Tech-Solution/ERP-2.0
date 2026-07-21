"""
Pydantic schemas for Ticket Service.
"""
from uuid import UUID
from ninja import Schema
from typing import Optional, List
from datetime import datetime


class AttachmentCreateIn(Schema):
    """Schema for creating an attachment reference."""
    file_id: UUID
    filename: str
    file_size: int
    content_type: str


class AttachmentOut(Schema):
    id: UUID
    filename: str
    file_size: int
    content_type: str
    created_at: datetime
    file_id: Optional[UUID] = None

class TicketOut(Schema):
    """Ticket output schema."""
    id: UUID
    ticket_id: Optional[str] = None  
    title: str
    description: str
    status: str
    priority: str
    category: str
    requestor_id: UUID
    department_id: Optional[UUID]
    assignee_id: Optional[UUID]
    due_at: Optional[datetime]
    version: int
    reopen_count: int
    requires_approval: bool
    progress_percent: int
    acknowledged_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    attachments: List[AttachmentOut] = []


class TicketIn(Schema):
    """Ticket input schema."""
    title: str
    description: str
    requestor_id: str
    department_id: Optional[str] = None
    priority: str = "medium"
    category: str = ""
    status: Optional[str] = None


class TicketUpdateIn(Schema):
    """Ticket update schema."""
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    assignee_id: Optional[str] = None
    department_id: Optional[str] = None
    progress_percent: Optional[int] = None

class TicketConfirmReviewIn(Schema):
    """Schema for the initial moderator review & confirmation."""
    title: str
    description: str
    priority: str
    category: str
    department_id: Optional[str] = None
    assignee_id: str


class StatusUpdateIn(Schema):
    """Status update schema."""
    action: str  # submit, review, assign, start_progress, resolve, close, reopen, postpone
    reason: Optional[str] = None


class AssignTicketIn(Schema):
    """Schema for assigning a ticket."""
    assignee_id: str
    department_id: Optional[str] = None

class RejectTicketIn(Schema):
    """Schema for rejecting a ticket."""
    reason: str

class PostponeTicketIn(Schema):
    """Schema for postponing a ticket."""
    reason: str

class AuditLogOut(Schema):
    """Schema for audit log output."""
    id: UUID
    action_type: str
    category: str
    model_name: str
    object_id: UUID
    old_state: dict
    new_state: dict
    changes: dict
    performed_by_id: Optional[UUID]
    reason: str
    timestamp: datetime
    
    @staticmethod
    def resolve_action_type(obj):
        return obj.action_type
        
    @staticmethod
    def resolve_timestamp(obj):
        return obj.timestamp

class TicketProgressIn(Schema):
    """Schema for updating ticket progress."""
    progress_percent: int

class TicketAcknowledgeIn(Schema):
    """Schema for acknowledging a ticket."""
    notes: Optional[str] = None

class SLAUpdateIn(Schema):
    """Schema for updating ticket SLA."""
    due_at: datetime
    reason: str

class PaginatedTicketOut(Schema):
    """Paginated ticket list response."""
    count: int
    results: List[TicketOut]
