"""
Django signals for profiles
Simplified - User creation is now handled in service layer
"""
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from .models import StudentProfile, TeacherProfile, CoordinatorProfile, AdminProfile, User


# Signals are now minimal since User creation moved to service layer
# These are just safety nets and for syncing profile data with User

@receiver(post_save, sender=StudentProfile)
def sync_student_profile_to_user(sender, instance, created, **kwargs):
    """Sync profile changes to User model"""
    if instance.user and not created:
        # Update User if profile changes
        user = instance.user
        user.first_name = instance.first_name
        user.last_name = instance.last_name
        user.is_active = instance.is_active
        user.save()


@receiver(post_save, sender=TeacherProfile)
def sync_teacher_profile_to_user(sender, instance, created, **kwargs):
    """Sync profile changes to User model"""
    if instance.user and not created:
        # Update User if profile changes
        user = instance.user
        user.first_name = instance.first_name
        user.last_name = instance.last_name
        user.is_active = instance.is_active
        user.save()


@receiver(post_save, sender=CoordinatorProfile)
def sync_coordinator_profile_to_user(sender, instance, created, **kwargs):
    """Sync profile changes to User model"""
    if instance.user and not created:
        # Update User if profile changes
        user = instance.user
        user.first_name = instance.first_name
        user.last_name = instance.last_name
        user.is_active = instance.is_active
        user.save()


@receiver(post_save, sender=AdminProfile)
def sync_admin_profile_to_user(sender, instance, created, **kwargs):
    """Sync profile changes to User model"""
    if instance.user and not created:
        # Update User if profile changes
        user = instance.user
        user.first_name = instance.first_name
        user.last_name = instance.last_name
        user.is_active = instance.is_active
        user.save()


