"""
Certification models
"""
from django.db import models
import uuid

class Certification(models.Model):
    """Certification model"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # 🔹 Multi-Tenancy
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    student_id = models.CharField(max_length=100) # User ID from auth-service
    course_id = models.UUIDField() # Course ID from course-service
    enrollment_id = models.UUIDField(null=True, blank=True)
    
    certificate_number = models.CharField(max_length=50, unique=True)
    verification_code = models.CharField(max_length=100, unique=True)
    
    student_name = models.CharField(max_length=255)
    course_title = models.CharField(max_length=255)
    course_code = models.CharField(max_length=50)
    
    grade = models.FloatField(null=True, blank=True)
    percentile = models.IntegerField(null=True, blank=True)
    institution_name = models.CharField(max_length=255, default='AIT Institute')
    
    certificate_pdf = models.FileField(upload_to='certificates/', null=True, blank=True)
    qr_code = models.ImageField(upload_to='qrcodes/', null=True, blank=True)
    
    is_verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.CharField(max_length=100, null=True, blank=True)
    
    issued_date = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Legacy fields for compatibility if any
    user_id = models.CharField(max_length=100, null=True, blank=True)
    title = models.CharField(max_length=255, null=True, blank=True)
    certificate_url = models.URLField(blank=True)

    class Meta:
        db_table = 'certifications_certification'
        ordering = ['-issued_date']
    
    def __str__(self):
        return f"{self.certificate_number} - {self.student_name}"
