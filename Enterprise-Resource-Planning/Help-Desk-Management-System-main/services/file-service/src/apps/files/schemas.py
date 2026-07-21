"""
Pydantic schemas for File Service.
"""
from ninja import Schema
from typing import Optional
from datetime import datetime
from uuid import UUID


class AttachmentOut(Schema):
    """Attachment output schema."""
    id: UUID
    file_key: UUID
    original_filename: str
    file_size: int
    mime_type: str
    file_extension: str
    scan_status: str
    scan_result: str
    scanned_at: Optional[datetime]
    is_processed: bool
    processed_at: Optional[datetime]
    ticket_id: Optional[UUID]
    chat_message_id: Optional[UUID]
    uploaded_by_id: UUID
    created_at: datetime


class FileUploadResponse(Schema):
    """File upload response schema."""
    id: str
    file_key: str
    url: str  # Added for frontend convenience
    message: str
    scan_status: str
    filename: str
    size: int
    content_type: str


