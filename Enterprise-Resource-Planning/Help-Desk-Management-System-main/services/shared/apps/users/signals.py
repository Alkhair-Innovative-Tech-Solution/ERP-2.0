"""
Signals for User app.
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.contrib.auth import get_user_model

User = get_user_model()


@receiver(post_save, sender=User)
def user_saved(sender, instance, created, **kwargs):
    """Handle user save signal."""
    # Add audit logging or other side effects here
    pass


@receiver(post_delete, sender=User)
def user_deleted(sender, instance, **kwargs):
    """Handle user delete signal."""
    # Add audit logging or other side effects here
    pass


