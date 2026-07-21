"""
Audit logging models for tracking changes across the system.

Tracks:
- Who made the change
- What was changed (model + field)
- When it happened
- Old value vs New value
"""
import uuid
from django.db import models
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from employees.models import Employee


class AuditLog(models.Model):
    """
    Comprehensive audit trail for all changes in the system.
    
    Captures:
    - Model changes (Employee, Department, ServiceAccess, etc.)
    - Field-level tracking (what changed)
    - User attribution (who did it)
    - Timestamp (when)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Who made the change
    changed_by = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
        help_text="Employee who made the change"
    )
    
    changed_by_superadmin = models.ForeignKey(
        'authentication.SuperAdmin',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
        help_text="SuperAdmin who made the change"
    )
    
    # What was changed (Generic relation to any model)
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        help_text="Type of object that was changed"
    )
    object_id = models.CharField(
        max_length=255,
        help_text="ID of the object that was changed"
    )
    changed_object = GenericForeignKey('content_type', 'object_id')
    
    # Change details
    ACTION_CHOICES = [
        ('create', 'Created'),
        ('update', 'Updated'),
        ('delete', 'Deleted'),
        ('restore', 'Restored'),
    ]
    action = models.CharField(
        max_length=10,
        choices=ACTION_CHOICES,
        help_text="Type of action performed"
    )
    
    field_name = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Field that was changed (for updates)"
    )
    
    old_value = models.TextField(
        blank=True,
        null=True,
        help_text="Previous value (for updates)"
    )
    
    new_value = models.TextField(
        blank=True,
        null=True,
        help_text="New value (for updates)"
    )
    
    # Metadata
    timestamp = models.DateTimeField(
        auto_now_add=True,
        help_text="When the change occurred"
    )
    
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address of the user"
    )
    
    notes = models.TextField(
        blank=True,
        null=True,
        help_text="Additional context or reason for change"
    )
    
    class Meta:
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['changed_by', '-timestamp']),
            models.Index(fields=['action', '-timestamp']),
        ]
    
    def __str__(self):
        return f"{self.get_action_display()} - {self.content_type} (ID: {self.object_id}) at {self.timestamp}"