from django.db import models
from users.managers import OrganizationManager
from subjects.models import CentralAuthFieldsMixin


class Assignment(CentralAuthFieldsMixin, models.Model):
    objects = OrganizationManager()
    all_objects = models.Manager()

    ASSIGNMENT_TYPE_CHOICES = [
        ('Individual', 'Individual'),
        ('Group', 'Group'),
        ('Project', 'Project'),
        ('Quiz', 'Quiz'),
        ('Homework', 'Homework'),
        ('Material', 'Material'),
    ]

    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE,
        null=True, blank=True, related_name='assignments'
    )
    subject = models.ForeignKey(
        'subjects.Subject', on_delete=models.CASCADE, related_name='assignments'
    )

    # Classroom scope — null means applies to all classrooms of subject
    classroom_id = models.IntegerField(null=True, blank=True)
    classroom_code = models.CharField(max_length=50, blank=True, null=True)
    classroom_label = models.CharField(max_length=100, blank=True, null=True)

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    instructions = models.TextField(blank=True, null=True)
    assignment_type = models.CharField(
        max_length=50, choices=ASSIGNMENT_TYPE_CHOICES, default='Individual'
    )
    total_marks = models.IntegerField(default=100)
    due_date = models.DateTimeField(null=True, blank=True)
    is_published = models.BooleanField(default=True)
    attachment = models.FileField(upload_to='assignments/', null=True, blank=True)
    quiz_form_url = models.URLField(null=True, blank=True)
    quiz_responses_url = models.URLField(null=True, blank=True)

    # Creator from JWT token. Phase C4: a CentralAuthUser's id is a UUID,
    # can't go in this IntegerField — central_created_by_id carries it
    # instead, populated on the central-auth path.
    created_by_id = models.IntegerField(null=True, blank=True)
    created_by_name = models.CharField(max_length=255, blank=True, null=True)
    central_created_by_id = models.UUIDField(null=True, blank=True, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.subject.name})"

    @property
    def attachment_url(self):
        if self.attachment:
            return self.attachment.url
        return None


class Submission(CentralAuthFieldsMixin, models.Model):
    objects = OrganizationManager()
    all_objects = models.Manager()

    STATUS_CHOICES = [
        ('SUBMITTED', 'Submitted'),
        ('GRADED', 'Graded'),
        ('LATE', 'Late'),
        ('RETURNED', 'Returned'),
        ('SEEN', 'Seen'),
    ]

    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE,
        null=True, blank=True, related_name='submissions'
    )
    assignment = models.ForeignKey(
        Assignment, on_delete=models.CASCADE, related_name='submissions'
    )

    # Student from JWT token. Phase C4: student_id is a bare int (the
    # student-service Student PK / legacy local User PK) — a CentralAuthUser
    # id is a UUID, can't go in an IntegerField. Widened to nullable;
    # central_student_id carries the central-auth identity instead.
    student_id = models.IntegerField(null=True, blank=True)
    student_name = models.CharField(max_length=255, blank=True, null=True)
    central_student_id = models.UUIDField(null=True, blank=True, db_index=True)

    submitted_file = models.FileField(upload_to='submissions/', null=True, blank=True)
    submission_text = models.TextField(blank=True, null=True)
    grade = models.IntegerField(null=True, blank=True)
    feedback = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='SUBMITTED')

    submitted_at = models.DateTimeField(auto_now_add=True)
    graded_by_id = models.IntegerField(null=True, blank=True)
    graded_by_name = models.CharField(max_length=255, blank=True, null=True)
    graded_at = models.DateTimeField(null=True, blank=True)
    central_graded_by_id = models.UUIDField(null=True, blank=True, db_index=True)

    class Meta:
        unique_together = ['assignment', 'student_id']
        ordering = ['-submitted_at']
        constraints = [
            # Phase C4: student_id is now nullable (see field comment
            # above) — Postgres treats each NULL as distinct, so
            # unique_together alone would let the SAME central-auth
            # student double-submit (both rows have student_id=NULL).
            # Same pattern as C1's StudentContentProgress partial constraint.
            models.UniqueConstraint(
                fields=['assignment', 'central_student_id'],
                condition=models.Q(central_student_id__isnull=False),
                name='unique_assignment_central_student',
            ),
        ]

    def __str__(self):
        return f"Submission for {self.assignment.title} by {self.student_name}"

    @property
    def submitted_file_url(self):
        if self.submitted_file:
            return self.submitted_file.url
        return None
