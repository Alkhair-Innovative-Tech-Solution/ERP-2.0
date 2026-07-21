"""
Signals for Notification app.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Notification


@receiver(post_save, sender=Notification)
def notification_saved(sender, instance, created, **kwargs):
    """Handle notification save signal."""
    if created:
        # Send WebSocket push notification
        pass


