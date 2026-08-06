from django.db import models
from users.managers import OrganizationManager
from django.utils import timezone


class CentralAuthFieldsMixin(models.Model):
    """
    Phase C6: additive, nullable fields for the central-auth repoint. Same
    shape as C1-C5 — dual-run, the existing `organization` FK and
    OrganizationManager-based `objects` manager on each model are untouched;
    these are new, parallel fields used only by the central-auth code path
    (see support_service/dual_auth.py, requests/views.py, form_builder/views.py).

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


# Choices
CATEGORY_CHOICES = [
    ('leave', 'Leave Request'),
    ('salary', 'Salary Issue'),
    ('facility', 'Facility Complaint'),
    ('resource', 'Resource Request'),
    ('student', 'Student Related'),
    ('admin', 'Administrative Issue'),
    ('other', 'Other'),
]

PRIORITY_CHOICES = [
    ('low', 'Low'),
    ('medium', 'Medium'),
    ('high', 'High'),
    ('urgent', 'Urgent'),
]

STATUS_CHOICES = [
    ('submitted', 'Submitted'),
    ('under_review', 'Under Review'),
    ('in_progress', 'In Progress'),
    ('waiting', 'Waiting'),
    ('pending_principal', 'Pending Principal Approval'),
    ('approved', 'Approved'),
    ('pending_confirmation', 'Pending Teacher Confirmation'),
    ('resolved', 'Resolved'),
    ('rejected', 'Rejected'),
]

class RequestComplaint(CentralAuthFieldsMixin, models.Model):
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    # Phase C6: unfiltered manager — needed by the central-auth read path
    # (see support_service/dual_auth.py's central_tenant_qs). Not a schema
    # change (no migration needed — a Manager isn't a field).
    all_objects = models.Manager()
    """Model for teacher requests and complaints"""

    # Foreign Keys
    teacher = models.ForeignKey('teachers.Teacher', on_delete=models.CASCADE, related_name='requests')
    coordinator = models.ForeignKey('coordinator.Coordinator', on_delete=models.CASCADE, related_name='assigned_requests')
    principal = models.ForeignKey('principals.Principal', on_delete=models.SET_NULL, null=True, blank=True, related_name='forwarded_requests')
    # Phase C6: teacher/coordinator/principal are real FKs to vendored
    # staff-service models — a CentralAuthUser/central identity can't be
    # assigned to them directly (ValueError: must be a "Teacher"/etc.
    # instance). Separate nullable UUID columns carry the central-auth
    # identity instead, populated on the central-auth code path.
    central_teacher_id = models.UUIDField(null=True, blank=True, db_index=True)
    central_coordinator_id = models.UUIDField(null=True, blank=True, db_index=True)
    central_principal_id = models.UUIDField(null=True, blank=True, db_index=True)
    
    # Organization
    organization = models.ForeignKey(
        'users.Organization', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='requests'
    )
    
    # Request Details
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    subject = models.CharField(max_length=200)
    description = models.TextField()
    
    # Status & Priority
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default='submitted')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='low')
    
    # Principal Approval
    requires_principal_approval = models.BooleanField(default=False)
    forwarding_note = models.TextField(blank=True, null=True, help_text="Coordinator's note when forwarding to principal")
    
    # Approval Tracking
    approved_by = models.CharField(max_length=20, blank=True, null=True, help_text="coordinator or principal")
    approved_at = models.DateTimeField(null=True, blank=True)
    
    # Teacher Confirmation
    teacher_confirmed = models.BooleanField(default=False)
    teacher_confirmed_at = models.DateTimeField(null=True, blank=True)
    teacher_satisfaction_note = models.TextField(blank=True, null=True)
    
    # Rejection
    rejection_reason = models.TextField(blank=True, null=True)
    
    # Coordinator Response
    coordinator_notes = models.TextField(blank=True, null=True)
    resolution_notes = models.TextField(blank=True, null=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    forwarded_to_principal_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Request/Complaint"
        verbose_name_plural = "Requests/Complaints"
    
    def __str__(self):
        return f"{self.get_category_display()} - {self.subject} ({self.get_status_display()})"
    
    def save(self, *args, **kwargs):
        # Auto-set reviewed_at when status changes to under_review
        if self.status == 'under_review' and not self.reviewed_at:
            self.reviewed_at = timezone.now()
        
        # Auto-set forwarded_to_principal_at when status changes to pending_principal
        if self.status == 'pending_principal' and not self.forwarded_to_principal_at:
            self.forwarded_to_principal_at = timezone.now()
        
        # Auto-set approved_at when status changes to approved
        if self.status == 'approved' and not self.approved_at:
            self.approved_at = timezone.now()
        
        # Auto-set teacher_confirmed_at when teacher confirms
        if self.teacher_confirmed and not self.teacher_confirmed_at:
            self.teacher_confirmed_at = timezone.now()
            # Auto-set status to resolved when teacher confirms
            if self.status == 'pending_confirmation':
                self.status = 'resolved'
        
        # Auto-set resolved_at when status changes to resolved
        if self.status == 'resolved' and not self.resolved_at:
            self.resolved_at = timezone.now()
        
        super().save(*args, **kwargs)

class RequestComment(CentralAuthFieldsMixin, models.Model):
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    all_objects = models.Manager()
    """Model for comments on requests"""
    # Phase C6: audited — no person FK/id field exists on this model
    # (author identity is only the `user_type` CharField enum below), so no
    # central_*_id column is needed here beyond the Organization mixin.
    
    USER_TYPE_CHOICES = [
        ('teacher', 'Teacher'),
        ('coordinator', 'Coordinator'),
    ]
    
    request = models.ForeignKey(RequestComplaint, on_delete=models.CASCADE, related_name='comments')
    
    # Organization
    organization = models.ForeignKey(
        'users.Organization', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='request_comments'
    )
    user_type = models.CharField(max_length=20, choices=USER_TYPE_CHOICES)
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['created_at']
        verbose_name = "Request Comment"
        verbose_name_plural = "Request Comments"
    
    def __str__(self):
        return f"Comment on {self.request.subject} by {self.get_user_type_display()}"

class RequestStatusHistory(CentralAuthFieldsMixin, models.Model):
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    all_objects = models.Manager()
    """Model to track status changes"""
    # Phase C6: audited — no person FK/id field exists on this model
    # (`changed_by` below is a role-label CharField, not an identity), so no
    # central_*_id column is needed here beyond the Organization mixin.
    
    request = models.ForeignKey(RequestComplaint, on_delete=models.CASCADE, related_name='status_history')
    
    # Organization
    organization = models.ForeignKey(
        'users.Organization', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='request_status_histories'
    )
    old_status = models.CharField(max_length=20, choices=STATUS_CHOICES, null=True, blank=True)
    new_status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    changed_by = models.CharField(max_length=20)  # 'teacher' or 'coordinator'
    notes = models.TextField(blank=True, null=True)
    changed_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-changed_at']
        verbose_name = "Status History"
        verbose_name_plural = "Status Histories"
    
    def __str__(self):
        return f"{self.request.subject}: {self.old_status} → {self.new_status}"
