import uuid
from django.db import models

class Branch(models.Model):
    """Mirrors auth-service Branch for local FK references. Synced via API."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.code})"

    class Meta:
        verbose_name_plural = "Branches"
        ordering = ["name"]

class Test(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # 🔹 Multi-Tenancy
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    title = models.CharField(max_length=255)
    course_id = models.UUIDField(help_text="Reference to Course in Course Service")
    specialization_id = models.UUIDField(null=True, blank=True, help_text="Reference to Specialization in Course Service")
    
    passing_marks = models.IntegerField(default=70)
    total_marks = models.IntegerField(default=100)
    duration = models.IntegerField(default=60, help_text="Duration in minutes")
    is_required = models.BooleanField(default=True, help_text="Is test required for enrollment?")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

    class Meta:
        verbose_name_plural = "Tests"
        indexes = [
            models.Index(fields=['course_id', 'specialization_id']),
        ]

class Question(models.Model):
    QUESTION_TYPE_CHOICES = [
        ('single_choice', 'Single Choice'),
        ('true_false', 'True/False'),
        ('multiple_choice', 'Multiple Choice'),
    ]
    DIFFICULTY_CHOICES = [
        ('easy', 'Easy'),
        ('medium', 'Medium'),
        ('hard', 'Hard'),
    ]
    CORRECT_ANSWER_CHOICES = [
        ('A', 'A'),
        ('B', 'B'),
        ('C', 'C'),
        ('D', 'D'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name="questions")
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPE_CHOICES, default='single_choice')
    question_text = models.TextField()
    option_a = models.CharField(max_length=500)
    option_b = models.CharField(max_length=500)
    option_c = models.CharField(max_length=500, blank=True, default='')
    option_d = models.CharField(max_length=500, blank=True, default='')
    correct_answer = models.CharField(max_length=1, choices=CORRECT_ANSWER_CHOICES, blank=True, default='A')
    correct_answers = models.CharField(max_length=10, blank=True, default='', help_text="Comma-separated correct answers for multiple_choice questions")
    marks = models.IntegerField(default=1)
    difficulty = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES, default='medium')
    order = models.IntegerField(default=0, help_text="Display order of questions")
    image = models.ImageField(upload_to='question_images/', null=True, blank=True)
    option_a_image = models.ImageField(upload_to='question_option_images/', null=True, blank=True)
    option_b_image = models.ImageField(upload_to='question_option_images/', null=True, blank=True)
    option_c_image = models.ImageField(upload_to='question_option_images/', null=True, blank=True)
    option_d_image = models.ImageField(upload_to='question_option_images/', null=True, blank=True)

    def __str__(self):
        return f"{self.test.title} - {self.question_text[:50]}"

    class Meta:
        verbose_name_plural = "Questions"
        ordering = ['order', 'id']

class TestAttempt(models.Model):
    STATUS_CHOICES = [
        ('ongoing', 'Ongoing'),
        ('completed', 'Completed'),
        ('expired', 'Expired'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField()
    user_email = models.EmailField()
    test = models.ForeignKey(Test, on_delete=models.CASCADE)
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    answers = models.JSONField(default=dict)
    score = models.IntegerField(null=True, blank=True)
    percentage = models.FloatField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ongoing')
    is_passed = models.BooleanField(default=False)
    attempt_number = models.IntegerField(default=1)
    
    # Store the result of the inter-service call to LMS
    lms_enrollment_id = models.UUIDField(null=True, blank=True, help_text="Stored after successful call to Course Service")
    enrollment_status = models.CharField(
        max_length=20, 
        choices=[('none', 'None'),('pending', 'Pending'),('success', 'Success'),('failed', 'Failed')], 
        default='none'
    )

    def __str__(self):
        return f"{self.user_email} - {self.test.title} - {self.status}"

    class Meta:
        verbose_name_plural = "TestAttempts"
        indexes = [
            models.Index(fields=['user_id', 'test']),
            models.Index(fields=['user_email']),
            models.Index(fields=['status']),
        ]

class EntranceLead(models.Model):
    GENDER_CHOICES = [
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # 🔹 Multi-Tenancy
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    lead_auto_id = models.IntegerField(null=True, blank=True, unique=True)
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='entrance_leads')
    name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    
    # New Fields
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, null=True, blank=True)
    whatsapp_number = models.CharField(max_length=20, null=True, blank=True)
    father_guardian_name = models.CharField(max_length=255, null=True, blank=True)
    guardian_contact = models.CharField(max_length=20, null=True, blank=True)
    relationship_to_student = models.CharField(max_length=100, null=True, blank=True)
    last_qualification = models.TextField(null=True, blank=True)
    full_address = models.TextField(null=True, blank=True)
    cnic_number = models.CharField(max_length=20, null=True, blank=True)
    date_of_birth = models.CharField(max_length=50, null=True, blank=True)
    age = models.IntegerField(null=True, blank=True)
    
    study_work_status = models.CharField(max_length=50, null=True, blank=True) # e.g., Studying, Working, Both
    study_work_details = models.TextField(null=True, blank=True)
    
    studied_at_idara = models.BooleanField(default=False)
    studying_at_idara = models.BooleanField(default=False)
    language_course = models.CharField(max_length=255, null=True, blank=True)
    
    is_terms_agreed = models.BooleanField(default=False)
    signature = models.TextField(null=True, blank=True) # Increase signature length too

    course_name_requested = models.TextField(null=True, blank=True)
    course_code_requested = models.CharField(max_length=50, null=True, blank=True)
    course_id = models.UUIDField(null=True, blank=True)
    scheduled_class_id = models.UUIDField(null=True, blank=True, help_text="Session/ScheduledClass selected during registration")
    has_paid_deposit = models.BooleanField(default=False)
    test_attempt_id = models.UUIDField(null=True, blank=True)
    test_score = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, default='pending') # pending, passed, failed, enrolled
    created_at = models.DateTimeField(auto_now_add=True)

    # Conversion tracking — set when student creates LMS account
    converted_to_student = models.BooleanField(default=False)
    lms_user_id = models.UUIDField(null=True, blank=True, help_text="UUID of the User record in auth-service after account creation")
    converted_at = models.DateTimeField(null=True, blank=True)

    # Soft Delete Fields
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"Lead {self.lead_auto_id}: {self.name} - {self.course_name_requested}"

    class Meta:
        verbose_name_plural = "Entrance Leads"
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['status']),
            models.Index(fields=['course_id']),
            models.Index(fields=['is_deleted']),
            models.Index(fields=['-created_at']),
            models.Index(fields=['lead_auto_id']),
        ]

class Interview(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('scheduled', 'Scheduled'),
        ('completed', 'Completed'),
        ('rejected', 'Rejected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.ForeignKey(EntranceLead, on_delete=models.CASCADE, related_name="interviews")
    interviewer_id = models.UUIDField(null=True, blank=True) # UUID of the teacher/admin
    interviewer_name = models.CharField(max_length=255, blank=True, null=True)
    interview_date = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    score = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Interview for {self.lead.name} on {self.interview_date}"

    class Meta:
        verbose_name_plural = "Interviews"

class AdminActionLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    admin_user_id = models.UUIDField()
    admin_name = models.CharField(max_length=255)
    action_type = models.CharField(max_length=50) # CREATE, UPDATE, DELETE, RESTORE
    model_name = models.CharField(max_length=100)
    object_id = models.CharField(max_length=100)
    details = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

class ReceiptCode(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # 🔹 Multi-Tenancy
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    code = models.CharField(max_length=20, unique=True)
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='receipt_codes')
    student_email = models.EmailField()
    student_name = models.CharField(max_length=255)
    cnic_number = models.CharField(max_length=20, null=True, blank=True, help_text="Copied from EntranceLead at creation")
    course_id = models.UUIDField(null=True, blank=True)
    scheduled_class_id = models.UUIDField(null=True, blank=True, help_text="Session selected by student at registration")
    test_score = models.IntegerField(null=True, blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)

    # Link back to originating lead for traceability
    lead = models.ForeignKey(
        EntranceLead,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='receipt_codes',
        help_text="The EntranceLead that triggered this receipt code"
    )
    
    # We use UUIDField instead of ForeignKey(User) to keep admission-service decoupled from auth-service
    added_by_admin = models.UUIDField(null=True, blank=True) 
    added_to_system_at = models.DateTimeField(null=True, blank=True)
    
    verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)
    lms_account_created = models.BooleanField(default=False)
    lms_user_id = models.UUIDField(null=True, blank=True)
    
    # Financial fields for Deposits
    deposit_amount = models.IntegerField(default=3000)
    bag_taken = models.BooleanField(default=True)
    bag_fee = models.IntegerField(default=800)
    bag_paid = models.BooleanField(default=False)
    bag_waived = models.BooleanField(default=False)
    
    id_card_taken = models.BooleanField(default=True)
    id_card_fee = models.IntegerField(default=200)
    id_card_paid = models.BooleanField(default=False)
    id_card_waived = models.BooleanField(default=False)

    certificate_taken = models.BooleanField(default=True)
    certificate_fee = models.IntegerField(default=200)
    certificate_paid = models.BooleanField(default=False)
    certificate_waived = models.BooleanField(default=False)
    
    is_waived = models.BooleanField(default=False) # Total waiver
    
    # Return fields
    is_returned = models.BooleanField(default=False)
    amount_returned = models.IntegerField(default=0)
    returned_at = models.DateTimeField(null=True, blank=True)
    remarks = models.TextField(blank=True, null=True)
    receipt_number = models.CharField(max_length=50, null=True, blank=True)

    # Soft Delete Fields
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    def calculate_refund(self):
        """Calculates expected refund."""
        if self.is_waived:
            return 0
            
        deductions = 0
        # Only deduct if it was taken and NOT paid upfront and NOT waived
        if self.bag_taken and not self.bag_paid and not self.bag_waived:
            deductions += self.bag_fee
        if self.id_card_taken and not self.id_card_paid and not self.id_card_waived:
            deductions += self.id_card_fee
        if self.certificate_taken and not self.certificate_paid and not self.certificate_waived:
            deductions += self.certificate_fee
            
        return max(0, self.deposit_amount - deductions)

    def __str__(self):
        return f"{self.code} - {self.student_name}"

    class Meta:
        verbose_name_plural = "Receipt Codes"
        indexes = [
            models.Index(fields=['student_email']),
            models.Index(fields=['verified']),
            models.Index(fields=['is_deleted']),
            models.Index(fields=['code']),
        ]
