from django.conf import settings
from django.db import models
from users.managers import OrganizationManager
from django.utils import timezone


class CentralAuthFieldsMixin(models.Model):
    """
    Phase C7: additive, nullable fields for the central-auth repoint. Same
    shape as C1-C6 — dual-run, the existing `organization` FK is untouched;
    these are new, parallel fields used only by the central-auth code path
    (see notification_service/dual_auth.py, notifications/views.py).

    Unlike every prior phase, NONE of this service's models use
    OrganizationManager (confirmed: Notification/Announcement/PushSubscription
    all use Django's plain default manager) — so there is no `all_objects`
    manager to add here, and no OrganizationManager blind spot to work
    around. The mixin still applies because the Organization FK / tenant
    concept itself is unrelated to which manager a model uses.

    tenant_id:       stamped from the verified token's tenant_id claim on
                      create, used to scope reads for central-auth requests.
    central_org_id:   maps this row's local `users.Organization` to its
                      central-auth Organization equivalent. Nullable,
                      backfillable — synthetic-only for now.
    """
    tenant_id = models.UUIDField(null=True, blank=True, db_index=True)
    central_org_id = models.UUIDField(null=True, blank=True, db_index=True)

    class Meta:
        abstract = True


class Notification(CentralAuthFieldsMixin, models.Model):
    # Phase C7: widened to nullable — same reasoning as PushSubscription.user
    # below. Without this, no row could ever be created for a central-auth
    # recipient at all (recipient is required, and a CentralAuthUser can't
    # be assigned to it), which would make central_recipient_id below
    # permanently write-only. Found via a synthetic-data create attempt
    # (NotNullViolation), not by inspection alone.
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True,
        related_name='notifications'
    )
    # Phase C7: recipient/actor are real FKs to users.User — a
    # CentralAuthUser/central identity can't be assigned to them directly
    # (ValueError: must be a "User" instance). Separate nullable UUID
    # columns carry the central-auth identity instead. central_recipient_id
    # is THE core security-relevant field in this service — every
    # central-auth read of "my notifications" is scoped by it (see
    # notifications/views.py's get_queryset), same as `recipient` already
    # does for legacy.
    central_recipient_id = models.UUIDField(null=True, blank=True, db_index=True)

    # Organization
    organization = models.ForeignKey(
        'users.Organization',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications'
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='actor_notifications'
    )
    central_actor_id = models.UUIDField(null=True, blank=True, db_index=True)
    verb = models.CharField(max_length=255)
    target_text = models.CharField(max_length=255, blank=True)
    data = models.JSONField(default=dict, blank=True)
    unread = models.BooleanField(default=True)
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"Notification(to={self.recipient}, verb={self.verb})"

    def mark_read(self):
        self.unread = False
        self.save()


class Announcement(CentralAuthFieldsMixin, models.Model):
    """Broadcast announcements created top-down (org admin → organization,
    principal → their campus) and read by everyone in scope."""

    PRIORITY_CHOICES = [
        ('normal', 'Normal'),
        ('important', 'Important'),
        ('urgent', 'Urgent'),
    ]
    AUDIENCE_CHOICES = [
        ('all', 'Everyone'),
        ('principals', 'Principals'),
        ('coordinators', 'Coordinators'),
        ('teachers', 'Teachers'),
        ('students', 'Students'),
    ]

    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE, null=True, blank=True,
        related_name='announcements'
    )
    # Null campus = organization-wide; a campus = campus-specific
    campus = models.ForeignKey(
        'campus.Campus', on_delete=models.CASCADE, null=True, blank=True,
        related_name='announcements'
    )
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='normal')
    audience = models.CharField(max_length=20, choices=AUDIENCE_CHOICES, default='all')
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='created_announcements'
    )
    # Phase C7: created_by is a real FK to users.User — same reasoning as
    # Notification.central_recipient_id above.
    central_created_by_id = models.UUIDField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Announcement({self.title})"


class PushSubscription(models.Model):
    """A browser Web Push subscription for a user/device. Lets the backend
    deliver OS-level notifications even when the app/tab is closed."""

    # Phase C7: widened to nullable — a central-auth subscriber has no
    # `users.User` row to point this FK at (CentralAuthUser isn't one).
    # `endpoint` is globally unique regardless of which user owns it, so
    # nulling `user` doesn't reopen any uniqueness gap (unlike C1/C4's
    # person+something composite-uniqueness cases). central_user_id (below)
    # carries the central-auth identity instead.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True,
        related_name='push_subscriptions'
    )
    # Phase C7: real FK to users.User — same reasoning as
    # Notification.central_recipient_id above. No CentralAuthFieldsMixin
    # here (PushSubscription has no Organization FK at all).
    central_user_id = models.UUIDField(null=True, blank=True, db_index=True)
    endpoint = models.TextField(unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    user_agent = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"PushSubscription(user={self.user_id})"
