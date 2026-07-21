from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import ScheduledClass
import logging

logger = logging.getLogger(__name__)

# Note: Automatic Google Sheets Sync has been disabled per user request ("Data sheet mein dena nahi hai").
# If bidirectional sync is needed in the future, uncomment the code below and update OAuth scopes.

@receiver(post_save, sender=ScheduledClass)
def handle_scheduled_class_sync(sender, instance, created, **kwargs):
    """
    Placeholder for future sync logic. 
    Currently disabled to prevent 403 errors with Read-Only tokens.
    """
    pass
