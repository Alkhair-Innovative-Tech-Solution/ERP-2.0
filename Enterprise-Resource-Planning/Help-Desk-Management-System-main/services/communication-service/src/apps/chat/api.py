"""
Chat API endpoints.
"""
from ninja import Router
from typing import List
from apps.chat.schemas import ChatMessageOut, ChatMessageIn
from apps.chat.models import ChatMessage

from central_auth.authentication import CentralAuthAuthentication
from central_auth.permissions import require_permission

router = Router(tags=["chat"], auth=CentralAuthAuthentication())


@router.get("/messages/ticket/{ticket_id}", response=List[ChatMessageOut])
@require_permission("hdms.ticket.view_own")
def list_messages(request, ticket_id: str):
    """List chat messages for a ticket."""
    messages = ChatMessage.objects.for_tenant(request.auth.tenant_id).filter(
        ticket_id=ticket_id
    )
    return [ChatMessageOut.from_orm(msg) for msg in messages]


@router.post("/messages", response=ChatMessageOut)
@require_permission("hdms.ticket.create")
def create_message(request, payload: ChatMessageIn):
    """Create a chat message."""
    sender_id = request.auth.id

    message = ChatMessage.objects.create(
        ticket_id=payload.ticket_id,
        sender_id=sender_id,
        message=payload.message,
        mentions=payload.mentions or [],
        tenant_id=request.auth.tenant_id,
    )
    return ChatMessageOut.from_orm(message)


