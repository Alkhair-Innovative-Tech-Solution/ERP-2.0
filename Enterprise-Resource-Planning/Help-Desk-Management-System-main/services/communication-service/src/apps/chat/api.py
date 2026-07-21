"""
Chat API endpoints.
"""
from ninja import Router
from typing import List
from apps.chat.schemas import ChatMessageOut, ChatMessageIn
from apps.chat.models import ChatMessage

from ninja.security import HttpBearer
from rest_framework_simplejwt.authentication import JWTAuthentication

from hdms_core.authentication import RemoteJWTAuthentication

router = Router(tags=["chat"], auth=RemoteJWTAuthentication())


@router.get("/messages/ticket/{ticket_id}", response=List[ChatMessageOut])
def list_messages(request, ticket_id: str):
    """List chat messages for a ticket."""
    messages = ChatMessage.objects.filter(ticket_id=ticket_id, is_deleted=False)
    return [ChatMessageOut.from_orm(msg) for msg in messages]


@router.post("/messages", response=ChatMessageOut)
def create_message(request, payload: ChatMessageIn):
    """Create a chat message."""
    # Use authenticated user's ID if available
    # User model has 'id' (UUID) and 'employee_code'
    sender_id = request.auth.id
    
    print(f"DEBUG: create_message payload: {payload.dict()}, sender: {sender_id}", flush=True)
    message = ChatMessage.objects.create(
        ticket_id=payload.ticket_id,
        sender_id=sender_id,
        message=payload.message,
        mentions=payload.mentions or []
    )
    return ChatMessageOut.from_orm(message)


