"""
SuperAdmin models for Auth Service.

Manages system superadmin accounts separately from employees.
"""
import uuid
from django.db import models
from django.utils import timezone
from employees.models import Organization
from employees.utils import SoftDeleteModel


class SuperAdmin(SoftDeleteModel):
    """
    SuperAdmin model for system administrators.
    
    Separate from Employee model as superadmins are not regular employees.
    They manage the entire system across all organizations/branches.
    
    Username format matches SIS: S-YY-NNNN (e.g., S-25-0001)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Superadmin Code (matches SIS username pattern)
    superadmin_code = models.CharField(
        max_length=20,
        unique=True,
        help_text="Superadmin code in format S-YY-NNNN (e.g., S-25-0001)"
    )
    
    # Personal Information
    full_name = models.CharField(
        max_length=255,
        help_text="Full name of the superadmin"
    )
    
    email = models.EmailField(
        unique=True,
        help_text="Official email address"
    )
    
    phone = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Contact phone number"
    )
    
    # System Access
    is_active = models.BooleanField(
        default=True,
        help_text="Is this superadmin account active?"
    )
    
    # Organizational Context (optional)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='superadmins',
        help_text="Primary organization (if applicable)"
    )
    
    # Metadata
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Super Administrator"
        verbose_name_plural = "Super Administrators"
        db_table = "auth_superadmin"
        ordering = ['superadmin_code']
    
    def __str__(self):
        return f"{self.full_name} ({self.superadmin_code})"
    
    @property
    def is_superadmin(self):
        return True

    def save(self, *args, **kwargs):
        # Ensure superadmin_code is uppercase
        if self.superadmin_code:
            self.superadmin_code = self.superadmin_code.upper()
        super().save(*args, **kwargs)
