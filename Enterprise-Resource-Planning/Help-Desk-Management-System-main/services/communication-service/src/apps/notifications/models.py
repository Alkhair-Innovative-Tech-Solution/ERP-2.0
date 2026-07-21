"""
Notification model for Communication Service.
"""
from django.db import models
from django.utils import timezone
from hdms_core.models import BaseModel


class NotificationType(models.TextChoices):
    """Notification type choices."""
    TICKET_CREATED = 'ticket_created', 'Ticket Created'
    TICKET_ASSIGNED = 'ticket_assigned', 'Ticket Assigned'
    TICKET_STATUS_CHANGED = 'ticket_status_changed', 'Ticket Status Changed'
    TICKET_MENTIONED = 'ticket_mentioned', 'Ticket Mentioned'
    APPROVAL_REQUESTED = 'approval_requested', 'Approval Requested'
    APPROVAL_DECISION = 'approval_decision', 'Approval Decision'
    TICKET_POSTPONED = 'ticket_postponed', 'Ticket Postponed'
    TICKET_REMINDER = 'ticket_reminder', 'Ticket Reminder'
    AUTO_CLOSE_REMINDER = 'auto_close_reminder', 'Auto Close Reminder'
    TICKET_REOPENED = 'ticket_reopened', 'Ticket Reopened'
    SUBTICKET_CREATED = 'subticket_created', 'SubTicket Created'
    SUBTICKET_STATUS_CHANGED = 'subticket_status_changed', 'SubTicket Status Changed'
    MESSAGE_RECEIVED = 'message_received', 'Message Received'


class Notification(BaseModel):
    """
    Notification model.
    """
    user_id = models.UUIDField(db_index=True)  # Recipient
    ticket_id = models.UUIDField(null=True, blank=True, db_index=True)
    type = models.CharField(max_length=50, choices=NotificationType.choices, db_index=True)
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    
    class Meta:
        db_table = 'notifications'
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'
        indexes = [
            models.Index(fields=['user_id']),
            models.Index(fields=['ticket_id']),
            models.Index(fields=['type']),
            models.Index(fields=['user_id', 'is_read']),
            models.Index(fields=['created_at']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Notification #{self.id} - {self.type}"
    
    def mark_as_read(self):
        """Mark notification as read."""
        self.is_read = True
        self.read_at = timezone.now()
        self.save(update_fields=['is_read', 'read_at'])
