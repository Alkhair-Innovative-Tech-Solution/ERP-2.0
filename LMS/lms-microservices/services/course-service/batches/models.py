import uuid
from django.db import models
# from users.models import Student, Teacher
from courses.models import Course  # Import Course model

class Batch(models.Model):
    STATUS_CHOICES = [
        ("Scheduled", "Scheduled"),
        ("Ongoing", "Ongoing"),
        ("Completed", "Completed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="batches")
    teacher_id = models.UUIDField(null=True, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    max_seats = models.IntegerField(default=30)
    available_seats = models.IntegerField(default=30)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Scheduled")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.course.name} - {self.start_date} to {self.end_date}"
    class Meta:
        verbose_name_plural = "Batches"

class Enrollment(models.Model):
    STATUS_CHOICES = [
        ("Enrolled", "Enrolled"),
        ("Waitlisted", "Waitlisted"),
        ("Completed", "Completed"),
        ("Dropped", "Dropped"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student_id = models.UUIDField()
    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name="enrollments")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Enrolled")
    enrollment_date = models.DateTimeField(auto_now_add=True)
    completion_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Student {self.student_id} - {self.batch.course.name} ({self.status})"
    class Meta:
        verbose_name_plural = "Enrollments"

class TeacherAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    teacher_id = models.UUIDField()
    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name="teacher_assignments")
    history = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True)
    assigned_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Teacher {self.teacher_id} assigned to {self.batch.course.name}"

class Interview(models.Model):
    STATUS_CHOICES = [
        ("Scheduled", "Scheduled"),
        ("Completed", "Completed"),
        ("Rejected", "Rejected"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student_id = models.UUIDField()
    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name="interviews")
    interview_date = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Scheduled")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Interview for Student {self.student_id} - {self.batch.course.name} ({self.status})"
    class Meta:
        verbose_name_plural = "Interviews"