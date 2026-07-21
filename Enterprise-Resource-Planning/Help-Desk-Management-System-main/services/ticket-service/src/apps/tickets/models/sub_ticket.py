"""
SubTicket model for Ticket Service.
"""
import sys
from pathlib import Path

# Add shared directory to path
project_root = Path(__file__).resolve().parent.parent.parent.parent.parent.parent
shared_path = project_root / 'shared' / 'core'
if str(shared_path) not in sys.path:
    sys.path.insert(0, str(shared_path))

from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django_fsm import FSMField, transition
from django.utils import timezone
from .ticket import TicketStatus, Priority



from hdms_core.models import BaseModel


class SubTicket(BaseModel):
    """
    SubTicket model for departmental sub-tickets.
    """
    title = models.CharField(max_length=500)
    description = models.TextField()
    
    # Status (Simplified FSM)
    status = FSMField(default=TicketStatus.ASSIGNED, protected=True, db_index=True)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.MEDIUM, db_index=True)
    
    # Relationships (UUID references)
    parent_ticket_id = models.UUIDField(db_index=True)
    department_id = models.UUIDField(db_index=True)
    assignee_id = models.UUIDField(null=True, blank=True, db_index=True)
    
    # Progress
    progress_percent = models.IntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(100)])
    
    # Version and Reopen
    version = models.IntegerField(default=1)
    reopen_count = models.IntegerField(default=0)
    
    class Meta:
        db_table = 'sub_tickets'
        verbose_name = 'Sub Ticket'
        verbose_name_plural = 'Sub Tickets'
        indexes = [
            models.Index(fields=['parent_ticket_id']),
            models.Index(fields=['status']),
            models.Index(fields=['department_id']),
            models.Index(fields=['assignee_id']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"SubTicket #{self.id} - {self.title}"
    
    def increment_version(self):
        """Increment version on reopen."""
        if self.pk:
            current = SubTicket.objects.get(pk=self.pk)
            self.version = current.version + 1
        else:
            self.version = 1
    
    # FSM Transitions
    @transition(field=status, source=TicketStatus.ASSIGNED, target=TicketStatus.IN_PROGRESS)
    def start_progress(self):
        """Start working on sub-ticket."""
        pass
    
    @transition(field=status, source=TicketStatus.IN_PROGRESS, target=TicketStatus.RESOLVED)
    def mark_resolved(self):
        """Mark sub-ticket as resolved."""
        pass
    
    @transition(field=status, source=TicketStatus.RESOLVED, target=TicketStatus.CLOSED)
    def close(self):
        """Close sub-ticket."""
        pass
    
    @transition(field=status, source=[TicketStatus.RESOLVED, TicketStatus.CLOSED], target=TicketStatus.REOPENED)
    def reopen(self):
        """Reopen sub-ticket (max 3 times)."""
        if self.reopen_count >= 3:
            raise ValueError("Maximum reopen limit reached")
        self.reopen_count += 1
        self.increment_version()
