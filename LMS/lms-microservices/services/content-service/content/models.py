import uuid
from django.db import models


class Module(models.Model):
    """Hierarchy Level 1: Sections or Chapters of a Course"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    course_id = models.UUIDField()
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.title}"


class Lesson(models.Model):
    """Hierarchy Level 2: Individual lessons within a Module"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name='lessons')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)
    duration_minutes = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.module.title} - {self.title}"


class ContentItem(models.Model):
    """Hierarchy Level 3: Actual files or links within a Lesson"""
    CONTENT_TYPE_CHOICES = [
        ('VIDEO', 'Video'),
        ('DOCUMENT', 'Document'),
        ('PRESENTATION', 'Presentation'),
        ('LINK', 'External Link'),
        ('IMAGE', 'Image'),
        ('QUIZ', 'Quiz Link'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
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


class UserContentProgress(models.Model):
    """Tracks which user has completed which content/lesson"""
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    user_id = models.UUIDField()
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE)
    is_completed = models.BooleanField(default=False)
    last_accessed = models.DateTimeField(auto_now=True)
    completion_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('user_id', 'lesson')


class ActivityLog(models.Model):
    """Tracks user activity for analytics and progress tracking."""
    ACTION_CHOICES = [
        ('view', 'View'),
        ('complete', 'Complete'),
        ('submit', 'Submit'),
        ('download', 'Download'),
        ('start', 'Start'),
    ]

    ENTITY_CHOICES = [
        ('lesson', 'Lesson'),
        ('content_item', 'Content Item'),
        ('assignment', 'Assignment'),
        ('course', 'Course'),
        ('module', 'Module'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    user_id = models.UUIDField()
    user_role = models.CharField(max_length=20, blank=True, default='')

    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    entity_type = models.CharField(max_length=20, choices=ENTITY_CHOICES)
    entity_id = models.UUIDField()
    course_id = models.UUIDField(null=True, blank=True)

    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user_id', 'created_at']),
            models.Index(fields=['course_id', 'action']),
            models.Index(fields=['entity_type', 'entity_id']),
            models.Index(fields=['organization_id']),
        ]

    def __str__(self):
        return f"{self.user_id} {self.action} {self.entity_type} at {self.created_at}"
