"""
Signals for Chat app.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import ChatMessage


@receiver(post_save, sender=ChatMessage)
def message_saved(sender, instance, created, **kwargs):
    """Handle message save signal."""
    if created:
        # Send WebSocket notification or create notification
        pass


