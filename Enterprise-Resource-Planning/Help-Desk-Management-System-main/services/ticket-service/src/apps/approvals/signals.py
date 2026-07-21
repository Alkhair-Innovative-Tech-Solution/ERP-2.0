"""
Signals for Approval app.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Approval


@receiver(post_save, sender=Approval)
def approval_saved(sender, instance, created, **kwargs):
    """Handle approval save signal."""
    # Add notifications or audit logging here
    pass


