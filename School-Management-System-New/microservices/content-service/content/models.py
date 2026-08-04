from django.db import models
from users.managers import OrganizationManager


class CentralAuthFieldsMixin(models.Model):
    """
    Phase C1: additive, nullable fields for the central-auth repoint.
    Dual-run — the existing `organization` FK and OrganizationManager-based
    `objects` manager on each model are untouched; these are new, parallel
    fields used only by the central-auth code path (see content/views.py,
    content/dual_auth.py).

    tenant_id:       stamped from the verified token's tenant_id claim on
                      create, used to scope reads for central-auth requests
                      (mirrors central_auth/tenant.py's TenantQuerySet
                      shape, applied manually in views.py rather than via
                      a replacement manager — see dual_auth.py's docstring
                      for why the default manager can't be reused as-is).
    central_org_id:   maps this row's local `users.Organization` to its
                      central-auth Organization equivalent. Nullable,
                      backfillable — synthetic-only for now (Phase B0
                      found no real SMS org/user data anywhere yet).
    """
    tenant_id = models.UUIDField(null=True, blank=True, db_index=True)
    central_org_id = models.UUIDField(null=True, blank=True, db_index=True)

    class Meta:
        abstract = True


class Module(CentralAuthFieldsMixin):
    """Chapter/Unit of a Subject — e.g. 'Chapter 1: Algebra'"""
    objects = OrganizationManager()
    all_objects = models.Manager()

    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE,
        null=True, blank=True, related_name='modules'
    )
    # FK to subject-service — stored as plain int, no cross-DB FK
    subject_id = models.IntegerField()
    subject_name = models.CharField(max_length=255, blank=True, null=True)

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.title}"


class Lesson(CentralAuthFieldsMixin):
    """Individual topic within a Module"""
    objects = OrganizationManager()
    all_objects = models.Manager()

    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE,
        null=True, blank=True, related_name='lessons'
    )
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name='lessons')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)
    duration_minutes = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.module.title} — {self.title}"


class ContentItem(CentralAuthFieldsMixin):
    """Actual file or link inside a Lesson"""
    objects = models.Manager()
    all_objects = models.Manager()

    CONTENT_TYPE_CHOICES = [
        ('VIDEO', 'Video'),
        ('DOCUMENT', 'Document'),
        ('PRESENTATION', 'Presentation'),
        ('LINK', 'External Link'),
        ('IMAGE', 'Image'),
        ('QUIZ', 'Quiz Link'),
    ]

    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE,
        null=True, blank=True, related_name='content_items'
    )
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='contents')
    title = models.CharField(max_length=255)
    content_type = models.CharField(max_length=20, choices=CONTENT_TYPE_CHOICES, default='DOCUMENT')
    file = models.FileField(upload_to='content/', blank=True, null=True)
    url = models.URLField(blank=True, null=True)
    is_preview = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.lesson.title} — {self.title}"


class StudentContentProgress(CentralAuthFieldsMixin):
    """Tracks which student has completed which lesson"""
    objects = OrganizationManager()
    all_objects = models.Manager()

    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE,
        null=True, blank=True, related_name='content_progress'
    )
    # SMS-local integer user id (legacy path only). Nullable — widened
    # rather than kept required, since central-auth-authenticated rows
    # can't populate it (their identity is a central-auth UUID, not an
    # SMS-local int — see central_user_id below). Existing rows keep
    # their value; nothing backfilled.
    student_id = models.IntegerField(null=True, blank=True)
    # Central-auth NonStaffIdentity id (student), for rows created via a
    # central-auth token. Separate field, not a repurposed student_id —
    # the two are different identity spaces (SMS-local int vs central-auth
    # UUID) and can't share a column.
    central_user_id = models.UUIDField(null=True, blank=True, db_index=True)
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='progress_records')
    is_completed = models.BooleanField(default=False)
    last_accessed = models.DateTimeField(auto_now=True)
    completion_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('student_id', 'lesson')
        constraints = [
            models.UniqueConstraint(
                fields=['central_user_id', 'lesson'],
                condition=models.Q(central_user_id__isnull=False),
                name='uniq_central_user_lesson_progress',
            ),
        ]

    def __str__(self):
        who = self.student_id if self.student_id is not None else self.central_user_id
        return f"Student {who} — {self.lesson.title} ({'done' if self.is_completed else 'in progress'})"
