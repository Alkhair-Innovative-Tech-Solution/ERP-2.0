"""
Pydantic schemas for Chat Service.
"""
from ninja import Schema
from typing import List
from datetime import datetime


from uuid import UUID

class ChatMessageOut(Schema):
    """Chat message output schema."""
    id: UUID
    ticket_id: UUID
    sender_id: UUID
    sender_name: str = "Unknown"
    sender_role: str = "user"
    employee_code: str = ""
    message: str
    mentions: List[str]
    created_at: datetime
    
    @staticmethod
    def from_orm(msg):
        """Custom serializer to include sender details from User model."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        # Try to get sender details
        sender_name = "Unknown"
        sender_role = "user"
        employee_code = ""
        
        try:
            sender = User.objects.get(id=msg.sender_id)
            sender_name = f"{sender.first_name} {sender.last_name}".strip() or sender.employee_code
            sender_role = sender.role
            employee_code = sender.employee_code
        except User.DoesNotExist:
            pass
        
        return ChatMessageOut(
            id=msg.id,
            ticket_id=msg.ticket_id,
            sender_id=msg.sender_id,
            sender_name=sender_name,
            sender_role=sender_role,
            employee_code=employee_code,
            message=msg.message,
            mentions=msg.mentions,
            created_at=msg.created_at
        )


class ChatMessageIn(Schema):
    """Chat message input schema."""
    ticket_id: str
    message: str
    mentions: List[str] = []


