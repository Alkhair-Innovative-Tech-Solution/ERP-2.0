import uuid
from django.db import models
from users.managers import OrganizationManager


class Subject(models.Model):
    objects = OrganizationManager()
    all_objects = models.Manager()

    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE,
        null=True, blank=True, related_name='subjects'
    )

    name = models.CharField(max_length=255)
    subject_code = models.CharField(max_length=30, blank=True, null=True)
    description = models.TextField(blank=True, null=True)

    # School hierarchy — IDs only (no cross-service DB FK)
    grade_id = models.IntegerField(null=True, blank=True)
    grade_name = models.CharField(max_length=100, blank=True, null=True)
    campus_id = models.IntegerField(null=True, blank=True)
    campus_name = models.CharField(max_length=255, blank=True, null=True)

    is_active = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        grade = f" ({self.grade_name})" if self.grade_name else ""
        return f"{self.name}{grade}"


class SubjectTeacherAssignment(models.Model):
    objects = OrganizationManager()
    all_objects = models.Manager()

    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE,
        null=True, blank=True, related_name='subject_teacher_assignments'
    )
    subject = models.ForeignKey(
        Subject, on_delete=models.CASCADE, related_name='teacher_assignments'
    )

    # Teacher — ID from staff-service JWT, name denormalized
    teacher_id = models.IntegerField()
    teacher_name = models.CharField(max_length=255, blank=True, null=True)
    teacher_email = models.EmailField(blank=True, null=True)

    # Classroom — ID from campus-service, code denormalized
    classroom_id = models.IntegerField(null=True, blank=True)
    classroom_code = models.CharField(max_length=50, blank=True, null=True)
    classroom_label = models.CharField(max_length=100, blank=True, null=True)  # "Grade 7 - A (Morning)"

    academic_year = models.CharField(max_length=10, default='2025-26')
    is_active = models.BooleanField(default=True)
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by_id = models.IntegerField(null=True, blank=True)

    class Meta:
        unique_together = ['subject', 'teacher_id', 'classroom_id', 'academic_year']
        ordering = ['-assigned_at']

    def __str__(self):
        return f"{self.subject.name} → {self.teacher_name} ({self.classroom_label})"
