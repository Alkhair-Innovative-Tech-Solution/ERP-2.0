"""
Pydantic schemas for Department app.
"""
from ninja import Schema
from typing import Optional
from datetime import datetime


class DepartmentSchema(Schema):
    """Department response schema."""
    id: str
    name: str
    code: str
    head_id: Optional[str] = None
    active_tickets: int
    total_capacity: int
    queue_enabled: bool
    created_at: datetime
    updated_at: datetime


class DepartmentCreateSchema(Schema):
    """Department create schema."""
    name: str
    code: str
    head_id: Optional[str] = None
    total_capacity: int = 100
    queue_enabled: bool = False


