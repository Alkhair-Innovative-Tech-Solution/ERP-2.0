"""
Authentication models for JWT-based authentication.

This module contains:
- UserCredentials: Password storage for employees and superadmins
- RefreshToken: JWT refresh token management
- BlacklistedToken: Logout token blacklist
- SuperAdmin: System superadmin accounts (imported from superadmin_models)
"""
import uuid
from django.db import models
from django.contrib.auth.hashers import make_password, check_password
from django.utils import timezone
from datetime import timedelta
from employees.models import Employee
from employees.utils import SoftDeleteModel

# Import SuperAdmin from separate module
from .superadmin_models import SuperAdmin


class UserCredentials(SoftDeleteModel):
    """
    Stores authentication credentials for employees and superadmins.
    
    Separate from Employee/SuperAdmin models as per design:
    - Employee/SuperAdmin models: Core data
    - UserCredentials: Authentication-specific data
    
    Can link to either Employee OR SuperAdmin (optional fields).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Link to either Employee OR SuperAdmin (one must be set)
    employee = models.OneToOneField(
        Employee,
        on_delete=models.CASCADE,
        related_name='credentials',
        null=True,
        blank=True,
        help_text="Employee these credentials belong to (if employee)"
    )
    
    superadmin = models.OneToOneField(
        SuperAdmin,
        on_delete=models.CASCADE,
        related_name='credentials',
        null=True,
        blank=True,
        help_text="SuperAdmin these credentials belong to (if superadmin)"
    )
    
    password_hash = models.CharField(
        max_length=255,
        help_text="Hashed password"
    )
    
    last_login = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last login timestamp"
    )
    
    last_login_ip = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address of last login"
    )
    
    password_changed_at = models.DateTimeField(
        default=timezone.now,
        help_text="When password was last changed"
    )
    
    failed_login_attempts = models.IntegerField(
        default=0,
        help_text="Count of consecutive failed login attempts"
    )
    
    locked_until = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Account locked until this time (after too many failed attempts)"
    )
    
    class Meta:
        verbose_name = "User Credentials"
        verbose_name_plural = "User Credentials"
        db_table = "auth_user_credentials"
    
    def __str__(self):
        if self.employee:
            return f"Credentials for {self.employee.full_name} ({self.employee.employee_code})"
        elif self.superadmin:
            return f"Credentials for {self.superadmin.full_name} ({self.superadmin.superadmin_code})"
        return f"Credentials #{self.id}"
    
    def clean(self):
        """Ensure exactly one of employee or superadmin is set"""
        from django.core.exceptions import ValidationError
        if not self.employee and not self.superadmin:
            raise ValidationError("Must link to either an Employee or SuperAdmin")
        if self.employee and self.superadmin:
            raise ValidationError("Cannot link to both Employee and SuperAdmin")
    
    def set_password(self, raw_password):
        """Hash and set password"""
        self.password_hash = make_password(raw_password)
        self.password_changed_at = timezone.now()
        self.failed_login_attempts = 0  # Reset on password change
        self.locked_until = None
    
    def check_password(self, raw_password):
        """Verify password"""
        return check_password(raw_password, self.password_hash)
    
    def is_locked(self):
        """Check if account is locked"""
        if self.locked_until and timezone.now() < self.locked_until:
            return True
        return False
    
    def record_failed_login(self):
        """Record failed login attempt and lock if threshold exceeded"""
        self.failed_login_attempts += 1
        
        # Lock account after 5 failed attempts for 30 minutes
        if self.failed_login_attempts >= 5:
            self.locked_until = timezone.now() + timedelta(minutes=30)
        
        self.save()
    
    def record_successful_login(self, ip_address=None):
        """Record successful login"""
        self.last_login = timezone.now()
        self.last_login_ip = ip_address
        self.failed_login_attempts = 0
        self.locked_until = None
        self.save()


class RefreshToken(models.Model):
    """
    Stores JWT refresh tokens.
    
    Refresh tokens are long-lived (7 days) and used to generate
    new access tokens without re-login.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='refresh_tokens',
        null=True,
        blank=True,
        help_text="Employee this token belongs to"
    )
    
    superadmin = models.ForeignKey(
        SuperAdmin,
        on_delete=models.CASCADE,
        related_name='refresh_tokens',
        null=True,
        blank=True,
        help_text="SuperAdmin this token belongs to"
    )
    
    token = models.TextField(
        unique=True,
        help_text="JWT token (RS256 tokens are ~700+ chars, TextField avoids length limit)"
    )
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When token was created"
    )
    
    expires_at = models.DateTimeField(
        help_text="When token expires"
    )
    
    is_revoked = models.BooleanField(
        default=False,
        help_text="Has this token been revoked?"
    )
    
    device_info = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Device/browser info (User-Agent)"
    )
    
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address where token was created"
    )
    
    class Meta:
        verbose_name = "Refresh Token"
        verbose_name_plural = "Refresh Tokens"
        db_table = "auth_refresh_token"
        indexes = [
            models.Index(fields=['token']),
            models.Index(fields=['employee', 'is_revoked']),
            models.Index(fields=['expires_at']),
        ]

    def __str__(self):
        if self.employee:
            return f"Refresh token for {self.employee.employee_code}"
        if self.superadmin:
            return f"Refresh token for {self.superadmin.superadmin_code}"
        return f"Refresh token #{self.id}"
    
    def is_expired(self):
        """Check if token has expired"""
        return timezone.now() > self.expires_at
    
    def is_valid(self):
        """Check if token is valid (not expired and not revoked)"""
        return not self.is_expired() and not self.is_revoked
    
    def revoke(self):
        """Revoke this token (logout)"""
        self.is_revoked = True
        self.save()


class BlacklistedToken(models.Model):
    """
    Stores blacklisted JWT access tokens.
    
    When user logs out, their access token is added here
    to prevent further use until it expires naturally.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    token = models.TextField(
        unique=True,
        help_text="JWT access token (RS256 tokens are ~700+ chars, TextField avoids length limit)"
    )
    
    blacklisted_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When token was blacklisted"
    )
    
    expires_at = models.DateTimeField(
        help_text="When token naturally expires (can be cleaned up after)"
    )
    
    reason = models.CharField(
        max_length=100,
        default='logout',
        help_text="Reason for blacklisting (logout, security, etc.)"
    )
    
    class Meta:
        verbose_name = "Blacklisted Token"
        verbose_name_plural = "Blacklisted Tokens"
        db_table = "auth_blacklisted_token"
        indexes = [
            models.Index(fields=['token']),
            models.Index(fields=['expires_at']),
        ]
    
    def __str__(self):
        return f"Blacklisted token (expires: {self.expires_at})"
    
    @classmethod
    def is_blacklisted(cls, token):
        """Check if a token is blacklisted"""
        return cls.objects.filter(token=token).exists()
    
    @classmethod
    def cleanup_expired(cls):
        """Remove expired blacklisted tokens (run periodically)"""
        expired_count = cls.objects.filter(expires_at__lt=timezone.now()).delete()[0]
        return expired_count
