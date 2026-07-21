from django.db import models
import uuid

class AudienceType(models.TextChoices):
    ALL = 'ALL', 'All Users'
    ROLE = 'ROLE', 'Role Based'
    COURSE = 'COURSE', 'Course Specific'
    CLASS = 'CLASS', 'Class Specific'
    CUSTOM = 'CUSTOM', 'Custom Recipients'

class RecipientRole(models.TextChoices):
    STUDENT = 'STUDENT', 'Student'
    TEACHER = 'TEACHER', 'Teacher'
    COORDINATOR = 'COORDINATOR', 'Coordinator'
    ADMIN = 'ADMIN', 'Admin'
    ALL = 'ALL', 'All Roles'

class DeliveryStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    SENT = 'SENT', 'Sent'
    FAILED = 'FAILED', 'Failed'

class NotificationBroadcast(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # 🔹 Multi-Tenancy
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    title = models.CharField(max_length=255)
    message = models.TextField()
    audience_type = models.CharField(max_length=20, choices=AudienceType.choices)
    target_role = models.CharField(
        max_length=20, 
        choices=RecipientRole.choices, 
        default=RecipientRole.ALL,
        help_text='Role filter to apply when broadcasting to ALL/ROLE audiences'
    )
    course_id = models.UUIDField(null=True, blank=True, help_text='Target course for COURSE audience type')
    scheduled_class_id = models.UUIDField(null=True, blank=True, help_text='Target class for CLASS audience type')
    created_by_id = models.UUIDField(help_text='User ID of the broadcaster')
    created_by_role = models.CharField(max_length=20, choices=RecipientRole.choices)
    metadata = models.JSONField(default=dict, blank=True)
    batch_id = models.CharField(max_length=64, null=True, blank=True, help_text='Optional idempotency batch identifier')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'notifications_broadcasts'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['audience_type'], name='notif_audience_idx'),
            models.Index(fields=['created_by_id'], name='notif_created_by_idx'),
            models.Index(fields=['batch_id'], name='notif_batch_idx'),
        ]

    def __str__(self):
        return f"{self.title} ({self.audience_type})"

class NotificationDelivery(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # 🔹 Multi-Tenancy
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    broadcast = models.ForeignKey(NotificationBroadcast, related_name='deliveries', on_delete=models.CASCADE)
    recipient_id = models.UUIDField(help_text='User ID from auth-service')
    recipient_role = models.CharField(max_length=20, choices=RecipientRole.choices)
    status = models.CharField(max_length=20, choices=DeliveryStatus.choices, default=DeliveryStatus.SENT)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'notifications_deliveries'
        ordering = ['-delivered_at']
        indexes = [
            models.Index(fields=['recipient_id', 'is_read'], name='notif_recipient_read_idx'),
            models.Index(fields=['broadcast'], name='notif_broadcast_idx'),
        ]

    def __str__(self):
        return f"Delivery for {self.broadcast.title} to User {self.recipient_id}"


class EmailLog(models.Model):
    """Log of all emails sent by the notification service."""
    STATUS_CHOICES = [
        ('sent', 'Sent'),
        ('failed', 'Failed'),
        ('pending', 'Pending'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    
    recipient_email = models.EmailField()
    recipient_id = models.UUIDField(null=True, blank=True, help_text="User ID if known")
    subject = models.CharField(max_length=255)
    email_type = models.CharField(max_length=50, help_text="e.g. welcome, grade_notification, assignment, certificate, password_reset")
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True, null=True)
    
    sent_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'notifications_email_log'
        ordering = ['-sent_at']
        indexes = [
            models.Index(fields=['recipient_email']),
            models.Index(fields=['email_type']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.email_type} to {self.recipient_email} ({self.status})"
