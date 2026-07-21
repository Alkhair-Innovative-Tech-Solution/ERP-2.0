"""
Approval model for Ticket Service.
"""
from django.db import models
from django.utils import timezone
from hdms_core.models import BaseModel


class ApprovalStatus(models.TextChoices):
    """Approval status choices."""
    PENDING = 'pending', 'Pending'
    APPROVED = 'approved', 'Approved'
    REJECTED = 'rejected', 'Rejected'


class Approval(BaseModel):
    """
    Approval model for financial ticket approvals.
    """
    ticket_id = models.UUIDField(db_index=True)
    approver_id = models.UUIDField(db_index=True)  # CEO or Finance head
    status = models.CharField(max_length=20, choices=ApprovalStatus.choices, default=ApprovalStatus.PENDING, db_index=True)
    reason = models.TextField(blank=True)
    documents = models.JSONField(default=dict, blank=True)
    
    class Meta:
        db_table = 'approvals'
        verbose_name = 'Approval'
        verbose_name_plural = 'Approvals'
        indexes = [
            models.Index(fields=['ticket_id']),
            models.Index(fields=['approver_id']),
            models.Index(fields=['status']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Approval #{self.id} - {self.status}"
