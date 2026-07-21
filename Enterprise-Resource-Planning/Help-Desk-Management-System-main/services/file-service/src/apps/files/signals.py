"""
Signals for File app.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Attachment
from .tasks import scan_file_task


@receiver(post_save, sender=Attachment)
def attachment_saved(sender, instance, created, **kwargs):
    """Handle attachment save signal."""
    if created and instance.scan_status == 'pending':
        # Trigger antivirus scan task
        scan_file_task.delay(str(instance.id))

