"""
Ticket model for Ticket Service.
"""
import sys
from pathlib import Path
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django_fsm import FSMField, transition
from django.utils import timezone

from hdms_core.models import BaseModel


class TicketStatus(models.TextChoices):
    """Ticket status choices."""
    DRAFT = 'draft', 'Draft'
    SUBMITTED = 'submitted', 'Submitted'
    PENDING = 'pending', 'Pending'
    UNDER_REVIEW = 'under_review', 'Under Review'
    ASSIGNED = 'assigned', 'Assigned'
    IN_PROGRESS = 'in_progress', 'In Progress'
    WAITING_APPROVAL = 'waiting_approval', 'Waiting Approval'
    APPROVED = 'approved', 'Approved'
    REJECTED = 'rejected', 'Rejected'
    RESOLVED = 'resolved', 'Resolved'
    CLOSED = 'closed', 'Closed'
    REOPENED = 'reopened', 'Reopened'
    POSTPONED = 'postponed', 'Postponed'


class Priority(models.TextChoices):
    """Priority choices."""
    URGENT = 'urgent', 'Urgent'
    HIGH = 'high', 'High'
    MEDIUM = 'medium', 'Medium'
    LOW = 'low', 'Low'


class Ticket(BaseModel):
    """
    Ticket model with FSM for status management.
    """
    title = models.CharField(max_length=500)
    description = models.TextField()
        # Human-readable ticket ID (HD-YYYY-NNNN)
    ticket_id = models.CharField(max_length=20, unique=True, blank=True, null=True, db_index=True)
    
    def save(self, *args, **kwargs):
        # Only generate ticket_id when status is not 'draft' AND ticket_id is empty
        if not self.ticket_id and self.status != 'draft':
            # Generate ticket_id on first non-draft save
            year = timezone.now().year
            # Get the last ticket number for this year
            last_ticket = Ticket.objects.filter(
                ticket_id__startswith=f'HD-{year}-'
            ).order_by('-ticket_id').first()
            
            if last_ticket and last_ticket.ticket_id:
                last_num = int(last_ticket.ticket_id.split('-')[-1])
                new_num = last_num + 1
            else:
                new_num = 1
            
            self.ticket_id = f'HD-{year}-{str(new_num).zfill(4)}'
        
        super().save(*args, **kwargs)
    
    # Status with FSM
    status = FSMField(default=TicketStatus.DRAFT, protected=True, db_index=True)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.MEDIUM, db_index=True)
    category = models.CharField(max_length=100, blank=True)
    
    # Relationships (UUID references, not ForeignKeys)
    requestor_id = models.UUIDField(db_index=True)
    department_id = models.UUIDField(null=True, blank=True, db_index=True)
    assignee_id = models.UUIDField(null=True, blank=True, db_index=True)
    
    # Dates
    due_at = models.DateTimeField(null=True, blank=True)
    
    # Version and Reopen
    version = models.IntegerField(default=1)
    reopen_count = models.IntegerField(default=0)
    
    # Acknowledgment
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    
    # Approval
    requires_approval = models.BooleanField(default=False)
    postponement_reason = models.TextField(blank=True)
    
    # Progress
    progress_percent = models.IntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(100)])
    
    class Meta:
        db_table = 'tickets'
        verbose_name = 'Ticket'
        verbose_name_plural = 'Tickets'
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['requestor_id']),
            models.Index(fields=['department_id']),
            models.Index(fields=['assignee_id']),
            models.Index(fields=['is_deleted', 'status']),
            models.Index(fields=['created_at']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"#{self.id} - {self.title}"
    
    def increment_version(self):
        """Increment version on reopen."""
        if self.pk:
            current = Ticket.objects.get(pk=self.pk)
            self.version = current.version + 1
        else:
            self.version = 1
    
    # FSM Transitions
    @transition(field=status, source=TicketStatus.DRAFT, target=TicketStatus.SUBMITTED)
    def submit(self):
        """Submit ticket."""
        pass
    
    @transition(field=status, source=[TicketStatus.SUBMITTED, TicketStatus.PENDING], target=TicketStatus.UNDER_REVIEW)
    def review(self):
        """Start review."""
        pass
    
    @transition(field=status, source=TicketStatus.UNDER_REVIEW, target=TicketStatus.ASSIGNED)
    def assign(self):
        """Assign ticket."""
        pass
    
    @transition(field=status, source=TicketStatus.ASSIGNED, target=TicketStatus.ASSIGNED)
    def acknowledge(self):
        """Acknowledge ticket assignment."""
        self.acknowledged_at = timezone.now()

    
    @transition(field=status, source=TicketStatus.ASSIGNED, target=TicketStatus.IN_PROGRESS)
    def start_progress(self):
        """Start working on ticket."""
        pass
    
    @transition(field=status, source=TicketStatus.IN_PROGRESS, target=TicketStatus.RESOLVED)
    def resolve(self):
        """Mark as resolved."""
        pass
    
    @transition(field=status, source=TicketStatus.RESOLVED, target=TicketStatus.CLOSED)
    def close(self):
        """Close ticket."""
        pass
    
    @transition(field=status, source=[TicketStatus.CLOSED, TicketStatus.RESOLVED], target=TicketStatus.REOPENED)
    def reopen(self):
        """Reopen ticket (max 3 times)."""
        if self.reopen_count >= 3:
            raise ValueError("Maximum reopen limit reached")
        self.reopen_count += 1
        self.increment_version()
    
    @transition(field=status, source=[TicketStatus.SUBMITTED, TicketStatus.PENDING, TicketStatus.UNDER_REVIEW, TicketStatus.POSTPONED], target=TicketStatus.REJECTED)
    def reject(self, reason: str):
        """Reject ticket."""
        self.postponement_reason = reason # Reusing postponement_reason field for rejection reason as well to keep it simple, or add a rejection_reason field in migration

    @transition(field=status, source=[TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS], target=TicketStatus.POSTPONED)

    def postpone(self, reason: str = ""):
        """Postpone ticket."""
        self.postponement_reason = reason
