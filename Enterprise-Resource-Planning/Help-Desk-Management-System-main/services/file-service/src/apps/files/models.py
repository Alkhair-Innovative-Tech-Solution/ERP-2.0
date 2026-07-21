"""
Attachment model for File Service.
"""
from django.db import models
from django.utils import timezone
from hdms_core.models import BaseModel


class ScanStatus(models.TextChoices):
    """File scan status."""
    PENDING = 'pending', 'Pending'
    CLEAN = 'clean', 'Clean'
    INFECTED = 'infected', 'Infected'
    FAILED = 'failed', 'Scan Failed'


class Attachment(BaseModel):
    """
    Attachment model for file uploads.
    Can be attached to Ticket OR ChatMessage.
    """
    import uuid
    file_key = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    
    # File Information
    original_filename = models.CharField(max_length=500)
    file_size = models.BigIntegerField()
    mime_type = models.CharField(max_length=200)
    file_extension = models.CharField(max_length=20)
    
    # Storage
    file_path = models.CharField(max_length=1000, blank=True)  # Only set after scan passes
    
    # Security & Processing
    scan_status = models.CharField(max_length=20, choices=ScanStatus.choices, default=ScanStatus.PENDING, db_index=True)
    scan_result = models.TextField(blank=True)
    scanned_at = models.DateTimeField(null=True, blank=True)
    
    is_processed = models.BooleanField(default=False)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    # Relationships (UUID references)
    category = models.CharField(max_length=50, default='general', db_index=True, help_text="Collection/Folder name (e.g., resumes, tickets)")
    ticket_id = models.UUIDField(null=True, blank=True, db_index=True)
    chat_message_id = models.UUIDField(null=True, blank=True, db_index=True)
    uploaded_by_id = models.UUIDField(db_index=True)
    
    class Meta:
        db_table = 'attachments'
        verbose_name = 'Attachment'
        verbose_name_plural = 'Attachments'
        indexes = [
            models.Index(fields=['ticket_id']),
            models.Index(fields=['chat_message_id']),
            models.Index(fields=['uploaded_by_id']),
            models.Index(fields=['scan_status']),
            models.Index(fields=['created_at']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.original_filename} ({self.file_key})"
    
    def clean(self):
        """Validate that attachment belongs to a context or category."""
        from django.core.exceptions import ValidationError
        # If it has a non-general category, it's valid
        if self.category != 'general':
            return
            
        if not self.ticket_id and not self.chat_message_id:
            raise ValidationError("Attachment must belong to either a ticket, chat message, or a non-general category")
        if self.ticket_id and self.chat_message_id:
            raise ValidationError("Attachment cannot belong to both ticket and chat message")
