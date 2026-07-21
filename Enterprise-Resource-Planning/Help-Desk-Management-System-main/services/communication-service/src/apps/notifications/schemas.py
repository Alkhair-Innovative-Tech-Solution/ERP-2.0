"""
Pydantic schemas for Notification Service.
"""
from ninja import Schema
from typing import Optional, Dict
from datetime import datetime


class NotificationOut(Schema):
    """Notification output schema."""
    id: str
    user_id: str
    ticket_id: Optional[str]
    type: str
    title: str
    message: str
    is_read: bool
    read_at: Optional[datetime]
    metadata: Dict
    created_at: datetime


