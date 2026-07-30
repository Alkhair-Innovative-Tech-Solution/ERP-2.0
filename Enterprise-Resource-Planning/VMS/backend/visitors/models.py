import uuid
from django.db import models

from central_auth.tenant import TenantManager


class Visitor(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.UUIDField(null=True, blank=True, db_index=True)
    full_name = models.CharField(max_length=200)
    cnic = models.CharField(max_length=15, unique=True, null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    company = models.CharField(max_length=200, null=True, blank=True)
    photo = models.ImageField(upload_to='visitors/', null=True, blank=True)
    is_blacklisted = models.BooleanField(default=False)
    blacklist_reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = TenantManager()

    class Meta:
        indexes = [
            models.Index(fields=['cnic']),
            models.Index(fields=['phone']),
            models.Index(fields=['email']),
        ]

    def __str__(self):
        return f"{self.full_name} ({self.cnic or self.phone or self.email})"


class KioskKey(models.Model):
    """
    Maps a public self-service kiosk (QR check-in page) to a tenant.

    The QR check-in page has no user token, so there's no other way for it
    to say which tenant's data a submission belongs to. The kiosk is
    configured with this key (e.g. baked into its check-in page URL/config);
    it sends the key on every public submission, and endpoints resolve it to
    a tenant_id via `resolve_kiosk_tenant()` in views.py. A missing key
    falls back to tenant_id=NULL (today's behavior — safe while only one
    tenant exists); an unknown/inactive key is rejected with 400 rather than
    silently falling back, since that almost certainly means a config error.
    """
    key = models.CharField(max_length=64, unique=True)
    tenant_id = models.UUIDField()
    label = models.CharField(max_length=200, blank=True, help_text="e.g. 'Main Gate — Idara Al-Khair'")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.label or self.key} -> tenant {self.tenant_id}"


class Host(models.Model):
    """External hosts - people visitors come to meet."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.UUIDField(null=True, blank=True, db_index=True)
    name = models.CharField(max_length=200)
    department = models.CharField(max_length=200, null=True, blank=True)
    employee_id = models.CharField(max_length=50, null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    objects = TenantManager()

    def __str__(self):
        return f"{self.name} - {self.department}"


class Employee(models.Model):
    """Internal employees - for 'Other' host selection by receptionist."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.UUIDField(null=True, blank=True, db_index=True)
    name = models.CharField(max_length=200)
    department = models.CharField(max_length=200)
    designation = models.CharField(max_length=200)
    employee_id = models.CharField(max_length=50, unique=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    email = models.EmailField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = TenantManager()

    class Meta:
        indexes = [
            models.Index(fields=['employee_id']),
            models.Index(fields=['email']),
            models.Index(fields=['department']),
        ]

    def __str__(self):
        return f"{self.name} - {self.designation} ({self.department})"


class Visit(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = 'scheduled', 'Scheduled'
        PENDING_APPROVAL = 'pending_approval', 'Pending Approval'
        CHECKED_IN = 'checked_in', 'Checked In'
        CHECKED_OUT = 'checked_out', 'Checked Out'
        CANCELLED = 'cancelled', 'Cancelled'
        REJECTED = 'rejected', 'Rejected'

    class EntryType(models.TextChoices):
        RECEPTIONIST = 'receptionist', 'Via Receptionist'
        QR_SELF = 'qr_self', 'QR Self Check-in'
        SCHEDULED = 'scheduled', 'Pre-Scheduled'

    class Purpose(models.TextChoices):
        INTERVIEW = 'interview', 'Interview'
        MEETING = 'meeting', 'Meeting'
        DELIVERY = 'delivery', 'Delivery/Courier'
        CONTRACTOR = 'contractor', 'Contractor/Worker'
        OFFICIAL = 'official', 'Official Visit'
        VIP = 'vip', 'VIP/Client/Donor'
        INTERNAL = 'internal', 'Internal Visit (Own Campus/College/Hospital)'
        OTHER = 'other', 'Other'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.UUIDField(null=True, blank=True, db_index=True)
    visitor = models.ForeignKey(Visitor, on_delete=models.CASCADE, related_name='visits')
    host = models.ForeignKey(Host, on_delete=models.SET_NULL, null=True, blank=True, related_name='visits')
    employee_host = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='visits', help_text="Employee selected as host via 'Other' option")
    host_name_manual = models.CharField(max_length=200, null=True, blank=True)
    purpose = models.CharField(max_length=20, choices=Purpose.choices, null=True, blank=True)
    purpose_other = models.TextField(null=True, blank=True, help_text="Custom purpose when 'Other' is selected")
    # Condition-based fields
    interview_position = models.CharField(max_length=200, null=True, blank=True, help_text="For Interview: position applied for")
    contractor_company = models.CharField(max_length=200, null=True, blank=True, help_text="For Contractor: company name")
    contractor_designation = models.CharField(max_length=200, null=True, blank=True, help_text="For Contractor: designation")
    contractor_address = models.TextField(null=True, blank=True, help_text="For Contractor: company address")
    delivery_company = models.CharField(max_length=200, null=True, blank=True, help_text="For Delivery: delivery company name")
    official_department = models.CharField(max_length=200, null=True, blank=True, help_text="For Official: department/organization")
    official_rank = models.CharField(max_length=200, null=True, blank=True, help_text="For Official: rank/designation")
    vip_category = models.CharField(max_length=200, null=True, blank=True, help_text="For VIP: category (VIP/Client/Donor)")
    internal_department = models.CharField(max_length=200, null=True, blank=True, help_text="Department/campus for internal visits")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING_APPROVAL)
    entry_type = models.CharField(max_length=20, choices=EntryType.choices, default=EntryType.RECEPTIONIST)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    visiting_id = models.CharField(max_length=20, unique=True, null=True, blank=True)
    checked_in_at = models.DateTimeField(null=True, blank=True)
    expected_checkout_at = models.DateTimeField(null=True, blank=True, help_text="Expected/estimated checkout time")
    checked_out_at = models.DateTimeField(null=True, blank=True)
    is_late = models.BooleanField(default=False, help_text="True if checkout is 30+ minutes late")
    card_expired = models.BooleanField(default=False, help_text="True after checkout - card no longer valid")
    # Was a FK to django.contrib.auth.models.User; central-auth-authenticated
    # requests carry a CentralAuthUser (token claims), not a Django User row,
    # so identity is stored as the employee_code string instead.
    approved_by = models.CharField(max_length=50, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    is_returning = models.BooleanField(default=False)
    is_overnight = models.BooleanField(default=False)
    overnight_notified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = TenantManager()

    class Meta:
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['checked_in_at']),
            models.Index(fields=['visiting_id']),
            models.Index(fields=['created_at']),
            models.Index(fields=['purpose']),
        ]
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.visiting_id and self.status == self.Status.SCHEDULED:
            import random, string
            self.visiting_id = 'VID-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.visitor.full_name} - {self.status} ({self.created_at.date()})"
