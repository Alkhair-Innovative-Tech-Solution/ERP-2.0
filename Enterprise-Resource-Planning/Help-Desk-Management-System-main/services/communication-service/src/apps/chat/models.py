"""
Chat models for Communication Service.
"""
from django.db import models
from django.utils import timezone
from hdms_core.models import BaseModel


class ChatMessage(BaseModel):
    """
    Chat message model.
    """
    ticket_id = models.UUIDField(db_index=True)
    sender_id = models.UUIDField(db_index=True)
    message = models.TextField()
    mentions = models.JSONField(default=list, blank=True)  # List of user IDs mentioned
    
    class Meta:
        db_table = 'chat_messages'
        verbose_name = 'Chat Message'
        verbose_name_plural = 'Chat Messages'
        indexes = [
            models.Index(fields=['ticket_id']),
            models.Index(fields=['sender_id']),
            models.Index(fields=['ticket_id', 'created_at']),
        ]
        ordering = ['created_at']
    
    def __str__(self):
        return f"Message #{self.id} - Ticket {self.ticket_id}"


class TicketParticipant(models.Model):
    """
    Ticket participant model (junction table).
    """
    import uuid
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket_id = models.UUIDField(db_index=True)
    user_id = models.UUIDField(db_index=True)
    joined_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'ticket_participants'
        verbose_name = 'Ticket Participant'
        verbose_name_plural = 'Ticket Participants'
        unique_together = [['ticket_id', 'user_id']]
        indexes = [
            models.Index(fields=['ticket_id']),
            models.Index(fields=['user_id']),
        ]
    
    def __str__(self):
        return f"Participant {self.user_id} - Ticket {self.ticket_id}"
