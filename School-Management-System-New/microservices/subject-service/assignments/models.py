from django.db import models
from users.managers import OrganizationManager


class Assignment(models.Model):
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

    # Creator from JWT token
    created_by_id = models.IntegerField(null=True, blank=True)
    created_by_name = models.CharField(max_length=255, blank=True, null=True)

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


class Submission(models.Model):
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

    # Student from JWT token
    student_id = models.IntegerField()
    student_name = models.CharField(max_length=255, blank=True, null=True)

    submitted_file = models.FileField(upload_to='submissions/', null=True, blank=True)
    submission_text = models.TextField(blank=True, null=True)
    grade = models.IntegerField(null=True, blank=True)
    feedback = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='SUBMITTED')

    submitted_at = models.DateTimeField(auto_now_add=True)
    graded_by_id = models.IntegerField(null=True, blank=True)
    graded_by_name = models.CharField(max_length=255, blank=True, null=True)
    graded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ['assignment', 'student_id']
        ordering = ['-submitted_at']

    def __str__(self):
        return f"Submission for {self.assignment.title} by {self.student_name}"

    @property
    def submitted_file_url(self):
        if self.submitted_file:
            return self.submitted_file.url
        return None
