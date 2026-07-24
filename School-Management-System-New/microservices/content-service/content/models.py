from django.db import models
from users.managers import OrganizationManager


class Module(models.Model):
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


class Lesson(models.Model):
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


class ContentItem(models.Model):
    """Actual file or link inside a Lesson"""
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


class StudentContentProgress(models.Model):
    """Tracks which student has completed which lesson"""
    objects = OrganizationManager()
    all_objects = models.Manager()

    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE,
        null=True, blank=True, related_name='content_progress'
    )
    student_id = models.IntegerField()
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='progress_records')
    is_completed = models.BooleanField(default=False)
    last_accessed = models.DateTimeField(auto_now=True)
    completion_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('student_id', 'lesson')

    def __str__(self):
        return f"Student {self.student_id} — {self.lesson.title} ({'done' if self.is_completed else 'in progress'})"
