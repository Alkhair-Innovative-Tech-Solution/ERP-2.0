import uuid
from django.db import models  # type: ignore

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

class Specialization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # ðŸ”¹ Multi-Tenancy
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    active = models.BooleanField(default=True)
    
    # Soft Delete Fields
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name_plural = "Specializations"

class Course(models.Model):
    LEVEL_CHOICES = [
        (1, "Beginner"),
        (2, "Advanced"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # ðŸ”¹ Multi-Tenancy
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    specialization = models.ForeignKey(
        Specialization, on_delete=models.CASCADE, related_name="courses"
    )
    name = models.CharField(max_length=255)
    course_code = models.CharField(max_length=50, null=True, blank=True)
    description = models.TextField(blank=True, null=True)
    additional_description = models.TextField(blank=True, null=True)
    level = models.IntegerField(choices=LEVEL_CHOICES, default=1)
    duration = models.IntegerField(default=6, help_text="Duration in months")
    iq_required = models.BooleanField(default=False)
    prerequisite_course = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="prerequisites",
    )
    next_level_course = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="next_levels",
    )
    image = models.ImageField(
        upload_to="images/",
        height_field=None,
        width_field=None,
        max_length=None,
        null=True, 
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    admission_status = models.CharField(
        max_length=20,
        choices=[('open', 'Open'), ('closed', 'Closed'), ('coming_soon', 'Coming Soon')],
        default='coming_soon'
    )
    admission_open_date = models.DateField(null=True, blank=True)
    course_start_date = models.DateField(null=True, blank=True)
    course_end_date = models.DateField(null=True, blank=True)
    active = models.BooleanField(default=True)
    
    # ðŸ”¹ Branch Assignment
    branches = models.ManyToManyField('Branch', blank=True, related_name='courses', help_text="Branches where this course is offered")
    
    # Soft Delete Fields
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    def update_admission_status(self):
        from datetime import date
        today = date.today()
        
        # Check if any ACTIVE scheduled classes exist for this course
        has_active_schedules = self.scheduled_classes.filter(active=True).exists()
        
        # Automation Logic
        if self.course_start_date and today >= self.course_start_date:
            self.admission_status = 'closed'
        elif self.admission_open_date and today >= self.admission_open_date and has_active_schedules:
            self.admission_status = 'open'
        else:
            # If dates are open but NO active schedules, it's still 'coming_soon'
            self.admission_status = 'coming_soon'
            
    def save(self, *args, **kwargs):
        self.update_admission_status()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.get_level_display()})"

    class Meta:
        verbose_name = "Course"
        verbose_name_plural = "Courses"


class StudentCourseProgress(models.Model):
    STATUS_CHOICES = [
        ("not_started", "Not Started"),
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # ðŸ”¹ Multi-Tenancy
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    student_id = models.UUIDField()
    course = models.ForeignKey(
        Course, on_delete=models.CASCADE, related_name="student_progress"
    )
    grade = models.TextField(blank=True, null=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="not_started"
    )
    completion_date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Student {self.student_id} - {self.course} ({self.status})"

    class Meta:
        verbose_name_plural = "StudentCourseProgress"


class CourseRegistrationHistory(models.Model):
    REGISTRATION_STATUS_CHOICES = [
        ("enrolled", "Enrolled"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("dropped", "Dropped"),
        ("transferred", "Transferred"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # ðŸ”¹ Multi-Tenancy
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    student_id = models.UUIDField()
    course = models.ForeignKey(
        Course, on_delete=models.CASCADE, related_name="registered_students"
    )
    scheduled_class = models.ForeignKey(
        'ScheduledClass', on_delete=models.SET_NULL, null=True, blank=True, related_name="enrolled_students"
    )
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='enrollments')
    status = models.CharField(
        max_length=20, choices=REGISTRATION_STATUS_CHOICES, default="enrolled"
    )
    registration_date = models.DateTimeField(auto_now_add=True)
    roll_number = models.CharField(max_length=50, null=True, blank=True, unique=True)

    def generate_roll_number(self):
        """Generates contextual roll number: AIT-[BRANCH]-YEAR-CODE-SEC-XXXX"""
        from django.utils import timezone
        year = timezone.now().year
        course_code = self.course.course_code or "CRS"
        section = self.scheduled_class.section if (self.scheduled_class and self.scheduled_class.section) else "1"
        
        branch_code = ""
        if self.branch:
            branch_code = f"-{self.branch.code}"
        
        prefix = f"AIT{branch_code}-{year}-{course_code}-{section}-"
        
        # Count existing students in this specific section/course for the year
        last_reg = CourseRegistrationHistory.objects.filter(
            roll_number__startswith=prefix
        ).order_by('-roll_number').first()
        
        if last_reg and last_reg.roll_number:
            try:
                last_number = int(last_reg.roll_number.split('-')[-1])
                new_number = last_number + 1
            except (ValueError, IndexError):
                new_number = 1
        else:
            new_number = 1
            
        return f"{prefix}{new_number:04d}"

    def save(self, *args, **kwargs):
        if not self.roll_number and self.status.lower() == 'enrolled':
            self.roll_number = self.generate_roll_number()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Student {self.student_id} - {self.course} ({self.status})"

    class Meta:
        verbose_name_plural = "CourseRegistrationHistory"

class Room(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # ðŸ”¹ Multi-Tenancy
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    # ðŸ”¹ Campus (Primary - replaces Branch)
    campus_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Campus")
    # ðŸ”¹ Branch (Deprecated - kept for backward compatibility)
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='rooms')
    name = models.CharField(max_length=100)
    capacity = models.IntegerField(default=30)
    active = models.BooleanField(default=True)

    def __str__(self):
        campus_str = f" (Campus: {self.campus_id})" if self.campus_id else ""
        branch_str = f" ({self.branch.code})" if self.branch else ""
        return f"{self.name}{campus_str or branch_str}"

    class Meta:
        unique_together = ['branch', 'name']

class ScheduledClass(models.Model):
    STRENGTH_CHOICES = [
        ('seats_available', 'Seats Available'),
        ('full', 'Full'),
        ('filling_fast', 'Filling Fast'),
    ]

    STATUS_CHOICES = [
        ('upcoming', 'Upcoming'),
        ('active', 'Active'),
        ('completed', 'Completed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # ðŸ”¹ Multi-Tenancy
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="scheduled_classes")
    # ðŸ”¹ Campus (Primary - replaces Branch)
    campus_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Campus")
    # ðŸ”¹ Branch (Deprecated - kept for backward compatibility)
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='scheduled_classes')
    instructor_id = models.UUIDField() # Teacher ID from auth-service
    teacher_name = models.CharField(max_length=255, null=True, blank=True)
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="room_scheduled_classes")
    
    start_time = models.TimeField()
    end_time = models.TimeField()
    days = models.JSONField(default=list) # e.g. ["MON", "WED", "FRI"]
    ramdan_time = models.CharField(max_length=100, null=True, blank=True)
    
    section = models.CharField(max_length=50, null=True, blank=True)
    lab_room = models.CharField(max_length=100, null=True, blank=True, help_text="e.g. 1 | A")
    strength_status = models.CharField(max_length=20, choices=STRENGTH_CHOICES, default='seats_available')
    
    whatsapp_group_link_boys = models.URLField(max_length=500, null=True, blank=True)
    whatsapp_group_link_girls = models.URLField(max_length=500, null=True, blank=True)
    content_shared = models.BooleanField(default=False)
    
    admission_open_date = models.DateField(null=True, blank=True)
    course_start_date = models.DateField(null=True, blank=True)
    course_end_date = models.DateField(null=True, blank=True)
    
    exam_date = models.DateField(null=True, blank=True)
    exam_status = models.CharField(max_length=50, null=True, blank=True)
    certificate_date = models.DateField(null=True, blank=True)
    certificate_status = models.CharField(max_length=50, null=True, blank=True)
    
    total_students = models.IntegerField(default=0)
    total_applications = models.IntegerField(default=0)
    assistant_teacher_id = models.UUIDField(null=True, blank=True)
    additional_teacher_ids = models.JSONField(default=list, blank=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='upcoming')
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def update_class_status(self):
        from datetime import date
        today = date.today()
        
        if self.course_end_date and today > self.course_end_date:
            self.status = 'completed'
            self.active = False # Match user logic: only active courses show Active status
        elif self.course_start_date and today < self.course_start_date:
            self.status = 'upcoming'
            self.active = True
        else:
            self.status = 'active'
            self.active = True

    def save(self, *args, **kwargs):
        self.update_class_status()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.course.name} - Sec {self.section} ({self.start_time} to {self.end_time})"

    class Meta:
        verbose_name_plural = "Scheduled Classes"

class Assignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # ðŸ”¹ Multi-Tenancy
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="assignments")
    scheduled_class = models.ForeignKey(ScheduledClass, on_delete=models.CASCADE, related_name="assignments", null=True, blank=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    instructions = models.TextField(blank=True, null=True)
    assignment_type = models.CharField(max_length=50, default="Individual")
    is_published = models.BooleanField(default=True)
    total_marks = models.IntegerField(default=100)
    due_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by_id = models.UUIDField(null=True, blank=True)
    attachment = models.FileField(upload_to="assignments/", null=True, blank=True)

    @property
    def attachment_url(self):
        if self.attachment:
            return self.attachment.url
        return None

    def __str__(self):
        return f"{self.title} ({self.course.name})"


# Late submission policy fields for Assignment
# (Applied via migration - see courses/migrations/)

class Submission(models.Model):
    STATUS_CHOICES = [
        ('SUBMITTED', 'Submitted'),
        ('GRADED', 'Graded'),
        ('LATE', 'Late'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # ðŸ”¹ Multi-Tenancy
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name="submissions")
    student_id = models.UUIDField()
    submitted_file = models.FileField(upload_to="submissions/", null=True, blank=True)
    submission_text = models.TextField(blank=True, null=True)
    grade = models.IntegerField(null=True, blank=True)
    feedback = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='SUBMITTED')
    submitted_at = models.DateTimeField(auto_now_add=True)
    graded_by_id = models.UUIDField(null=True, blank=True)

    @property
    def submitted_file_url(self):
        if self.submitted_file:
            return self.submitted_file.url
        return None

    def __str__(self):
        return f"Submission for {self.assignment.title} by {self.student_id}"


class Attendance(models.Model):
    """Per-classroom per-day attendance record with state machine."""
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('under_review', 'Under Review'),
        ('approved', 'Approved'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization_id = models.UUIDField(null=True, blank=True)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="attendance_records")
    scheduled_class = models.ForeignKey(ScheduledClass, on_delete=models.CASCADE, related_name="class_attendance", null=True, blank=True)
    date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    total_students = models.IntegerField(default=0)
    present_count = models.IntegerField(default=0)
    absent_count = models.IntegerField(default=0)
    late_count = models.IntegerField(default=0)
    leave_count = models.IntegerField(default=0)
    update_history = models.JSONField(default=list, blank=True)
    is_final = models.BooleanField(default=False)
    submitted_by_id = models.UUIDField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_by_id = models.UUIDField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    approved_by_id = models.UUIDField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['scheduled_class', 'date']
        verbose_name_plural = "Attendance"


class StudentAttendance(models.Model):
    """Individual student attendance within an Attendance record."""
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('late', 'Late'),
        ('leave', 'Leave'),
        ('excused', 'Excused'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student_id = models.UUIDField()
    attendance = models.ForeignKey(Attendance, on_delete=models.CASCADE, related_name='student_attendances')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    remarks = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ['student_id', 'attendance']
        verbose_name_plural = "Student Attendances"


class Holiday(models.Model):
    """Coordinator-defined holidays."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization_id = models.UUIDField(null=True, blank=True)
    name = models.CharField(max_length=255)
    date = models.DateField()
    description = models.TextField(blank=True, null=True)
    created_by_id = models.UUIDField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.date})"

    class Meta:
        verbose_name_plural = "Holidays"
        ordering = ['-date']


class Weekend(models.Model):
    """Weekend days (auto-created for Sundays)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization_id = models.UUIDField(null=True, blank=True)
    day_of_week = models.IntegerField()  # 0=Sunday, 6=Saturday
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ['organization_id', 'day_of_week']
        verbose_name_plural = "Weekends"


class StaffAttendance(models.Model):
    """Staff/teacher daily attendance record."""
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('late', 'Late'),
        ('leave', 'Leave'),
        ('half_day', 'Half Day'),
        ('not_marked', 'Not Marked'),
    ]
    SOURCE_CHOICES = [
        ('biometric', 'Biometric'),
        ('manual', 'Manual'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization_id = models.UUIDField(null=True, blank=True)
    user_id = models.UUIDField()
    campus_id = models.UUIDField(null=True, blank=True)
    date = models.DateField()
    check_in_time = models.TimeField(null=True, blank=True)
    check_out_time = models.TimeField(null=True, blank=True)
    working_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='not_marked')
    late_minutes = models.IntegerField(default=0)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='manual')
    device_id = models.UUIDField(null=True, blank=True)
    marked_by_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user_id', 'date']
        verbose_name_plural = "Staff Attendances"


class ZKTecoDevice(models.Model):
    """ZKTeco biometric device registry."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization_id = models.UUIDField(null=True, blank=True)
    name = models.CharField(max_length=255)
    ip_address = models.GenericIPAddressField()
    port = models.IntegerField(default=4370)
    serial_number = models.CharField(max_length=100, unique=True)
    device_model = models.CharField(max_length=100, blank=True, null=True)
    campus_id = models.UUIDField(null=True, blank=True)
    last_sync = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.serial_number})"

    class Meta:
        verbose_name_plural = "ZKTeco Devices"


class ZKTecoEmployeeMapping(models.Model):
    """Maps device user IDs to system users."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    device = models.ForeignKey(ZKTecoDevice, on_delete=models.CASCADE, related_name='mappings')
    device_user_id = models.CharField(max_length=50)
    user_id = models.UUIDField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['device', 'device_user_id']
        verbose_name_plural = "ZKTeco Employee Mappings"


class AttendanceBackfillPermission(models.Model):
    """Coordinator grants teacher permission to mark past-date attendance."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    granted_to_id = models.UUIDField()  # teacher user_id
    granted_by_id = models.UUIDField()  # coordinator user_id
    scheduled_class = models.ForeignKey(ScheduledClass, on_delete=models.CASCADE, related_name='backfill_permissions')
    deadline = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Attendance Backfill Permissions"


class AttendanceAuditLog(models.Model):
    """Unified audit trail for attendance actions."""
    ACTION_CHOICES = [
        ('create', 'Create'),
        ('update', 'Update'),
        ('submit', 'Submit'),
        ('review', 'Review'),
        ('approve', 'Approve'),
        ('reopen', 'Reopen'),
        ('delete', 'Delete'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    feature = models.CharField(max_length=50, default='attendance')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    entity_type = models.CharField(max_length=50)
    entity_id = models.CharField(max_length=100)
    user_id = models.UUIDField()
    user_name = models.CharField(max_length=255, blank=True, null=True)
    details = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Attendance Audit Logs"
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['feature', 'action']),
            models.Index(fields=['entity_type', 'entity_id']),
            models.Index(fields=['user_id', 'timestamp']),
        ]

class ContentCompletion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # ðŸ”¹ Multi-Tenancy
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    student_id = models.UUIDField()
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="content_completions")
    content_id = models.UUIDField()
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['student_id', 'content_id']
        verbose_name_plural = "Content Completions"

class CourseRating(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # ðŸ”¹ Multi-Tenancy
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    student_id = models.UUIDField()
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="ratings")
    scheduled_class = models.ForeignKey(ScheduledClass, on_delete=models.CASCADE, related_name="course_ratings", null=True, blank=True)
    rating = models.IntegerField(default=5)
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['student_id', 'course', 'scheduled_class']
        verbose_name_plural = "Course Ratings"

class StudentDeposit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # ðŸ”¹ Multi-Tenancy
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    student_id = models.UUIDField()
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="deposits")
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='deposits')
    
    deposit_amount = models.IntegerField(default=3000)
    receipt_number = models.CharField(max_length=50, null=True, blank=True, unique=True)
    is_waived = models.BooleanField(default=False)
    deposit_paid = models.BooleanField(default=True, help_text="Whether the initial deposit itself has been paid (separate from is_waived)")
    
    bag_taken = models.BooleanField(default=True)
    bag_fee = models.IntegerField(default=800)
    bag_paid = models.BooleanField(default=True)
    bag_waived = models.BooleanField(default=False)
    
    id_card_taken = models.BooleanField(default=True)
    id_card_fee = models.IntegerField(default=200)
    id_card_paid = models.BooleanField(default=True)
    id_card_waived = models.BooleanField(default=False)

    certificate_taken = models.BooleanField(default=True)
    certificate_fee = models.IntegerField(default=200, help_text="Certificate issuance fee")
    certificate_paid = models.BooleanField(default=True)
    certificate_waived = models.BooleanField(default=False)
    
    is_returned = models.BooleanField(default=False)
    amount_returned = models.IntegerField(default=0, help_text="Amount dynamically calculated and stored at return time.")
    returned_at = models.DateTimeField(null=True, blank=True)
    
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Soft Delete Fields
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ['student_id', 'course']
        verbose_name_plural = "Student Deposits"
        
    def generate_receipt_number(self):
        """Generates sequential receipt number: AIT-DEP-XXXX"""
        # Find the last deposit to determine the next sequential number
        last_dep = StudentDeposit.objects.all().order_by('-receipt_number').first()
        
        if last_dep and last_dep.receipt_number:
            try:
                # Extract number from format AIT-DEP-0001
                last_number = int(last_dep.receipt_number.split('-')[-1])
                new_number = last_number + 1
            except (ValueError, IndexError):
                new_number = 1
        else:
            new_number = 1
            
        return f"AIT-DEP-{new_number:04d}"

    def save(self, *args, **kwargs):
        if not self.receipt_number:
            self.receipt_number = self.generate_receipt_number()
        super().save(*args, **kwargs)

    def calculate_refund(self):
        deductions = 0
        if self.bag_taken and not self.bag_paid and not self.bag_waived:
            deductions += self.bag_fee
        if self.id_card_taken and not self.id_card_paid and not self.id_card_waived:
            deductions += self.id_card_fee
        if self.certificate_taken and not self.certificate_paid and not self.certificate_waived:
            deductions += self.certificate_fee
        return max(0, self.deposit_amount - deductions)

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

# -----------------------------------------------------------
# ?? FEE MANAGEMENT SYSTEM
# -----------------------------------------------------------

class FeeStructure(models.Model):
    """Admin-configured fee rules per course and/or time slot."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # ðŸ”¹ Multi-Tenancy
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='fee_structures')
    scheduled_class = models.ForeignKey(ScheduledClass, on_delete=models.CASCADE, null=True, blank=True, related_name='fee_structures')
    
    scope = models.CharField(max_length=20, choices=[
        ('course', 'Per Course (all sections)'),
        ('scheduled_class', 'Per Time Slot (section-specific)'),
    ], default='course')
    
    monthly_maintenance_fee = models.IntegerField(default=0, help_text="Monthly recurring fee")
    one_time_fee = models.IntegerField(default=0, help_text="One-time course fee")
    
    payment_plan = models.CharField(max_length=20, choices=[
        ('monthly', 'Monthly'),
        ('one_time', 'One Time'),
    ], default='monthly')
    
    due_day_of_month = models.IntegerField(default=10, help_text="Day of month when fee is due (1-28)")
    
    require_deposit_paid = models.BooleanField(default=True, help_text="Only charge students who have paid deposit")
    
    is_active = models.BooleanField(default=True)
    effective_from = models.DateField(help_text="Fee applies from this date")
    effective_to = models.DateField(null=True, blank=True, help_text="Fee stops applying after this date")
    
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        target = f"{self.course.name}"
        if self.scheduled_class:
            target += f" - Sec {self.scheduled_class.section}"
        return f"Fee: {target} (PKR {self.monthly_maintenance_fee}/mo)"

    class Meta:
        verbose_name_plural = "Fee Structures"
        ordering = ['course__name', 'scope']

class StudentFeeRecord(models.Model):
    """Auto-generated monthly fee obligation per student."""
    PAYMENT_STATUS = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('partial', 'Partial'),
        ('overdue', 'Overdue'),
        ('waived', 'Waived'),
    ]

    FEE_TYPES = [
        ('monthly', 'Monthly'),
        ('full', 'Full Course'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # ðŸ”¹ Multi-Tenancy
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    student_id = models.UUIDField()
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='student_fee_records')
    scheduled_class = models.ForeignKey(ScheduledClass, on_delete=models.SET_NULL, null=True, blank=True, related_name='student_fee_records')
    fee_structure = models.ForeignKey(FeeStructure, on_delete=models.SET_NULL, null=True, blank=True, related_name='student_records')
    
    fee_type = models.CharField(max_length=20, choices=FEE_TYPES, default='monthly', help_text="Monthly installment or full course payment")
    fee_month = models.DateField(help_text="First day of the fee month (for full payment, the first month of coverage)")
    amount_due = models.IntegerField()
    amount_paid = models.IntegerField(default=0)
    outstanding_balance = models.IntegerField(default=0)
    original_amount = models.IntegerField(null=True, blank=True, help_text="Original amount before discount (for full payments)")
    discount_amount = models.IntegerField(default=0, help_text="Discount applied (for full payments)")
    
    due_date = models.DateField()
    
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS, default='pending')
    
    paid_date = models.DateField(null=True, blank=True)
    collected_by_id = models.UUIDField(null=True, blank=True)
    collected_by_name = models.CharField(max_length=255, null=True, blank=True)
    remarks = models.TextField(blank=True, null=True)
    receipt_number = models.CharField(max_length=50, null=True, blank=True, unique=True, help_text="Auto-generated receipt number")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def generate_receipt_number(self):
        from django.utils import timezone
        today = timezone.now().date()
        prefix = f"RCP-{today.strftime('%Y%m')}-"
        last = StudentFeeRecord.objects.filter(receipt_number__startswith=prefix).order_by('-receipt_number').first()
        if last and last.receipt_number:
            try:
                last_num = int(last.receipt_number.split('-')[-1])
                new_num = last_num + 1
            except (ValueError, IndexError):
                new_num = 1
        else:
            new_num = 1
        return f"{prefix}{new_num:04d}"

    def update_status(self):
        from django.utils import timezone
        today = timezone.now().date()
        if self.payment_status == 'waived':
            return
        if self.amount_paid >= self.amount_due and self.amount_due > 0:
            was_not_paid = self.payment_status != 'paid'
            self.payment_status = 'paid'
            self.outstanding_balance = 0
            if was_not_paid and not self.paid_date:
                self.paid_date = today
        elif self.amount_paid > 0:
            self.payment_status = 'partial'
            self.outstanding_balance = self.amount_due - self.amount_paid
        elif today > self.due_date:
            self.payment_status = 'overdue'
            self.outstanding_balance = self.amount_due
        else:
            self.payment_status = 'pending'
            self.outstanding_balance = self.amount_due

    def save(self, *args, **kwargs):
        self.update_status()
        if self.payment_status == 'paid' and not self.receipt_number:
            self.receipt_number = self.generate_receipt_number()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Fee: Student {self.student_id} - {self.fee_month.strftime('%B %Y')} - {self.payment_status}"

    class Meta:
        verbose_name_plural = "Student Fee Records"
        unique_together = ['student_id', 'course', 'scheduled_class', 'fee_month']
        ordering = ['-fee_month', 'payment_status']

class FeePaymentTransaction(models.Model):
    """Individual payment transaction log."""
    PAYMENT_METHODS = [
        ('cash', 'Cash'),
        ('bank', 'Bank Transfer'),
        ('online', 'Online Payment'),
        ('cheque', 'Cheque'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # ðŸ”¹ Multi-Tenancy
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    fee_record = models.ForeignKey(StudentFeeRecord, on_delete=models.CASCADE, related_name='transactions')
    student_id = models.UUIDField()
    
    amount = models.IntegerField()
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='cash')
    transaction_reference = models.CharField(max_length=100, null=True, blank=True)
    
    received_by_id = models.UUIDField(null=True, blank=True)
    received_by_name = models.CharField(max_length=255, null=True, blank=True)
    received_at = models.DateTimeField(auto_now_add=True)
    remarks = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Payment: PKR {self.amount} - {self.payment_method}"

    class Meta:
        verbose_name_plural = "Fee Payment Transactions"
        ordering = ['-received_at']

class StudentWarning(models.Model):
    WARNING_TYPES = [
        ('absent', 'Frequent Absence'),
        ('late', 'Frequent Lateness'),
        ('behavior', 'Behavioral'),
        ('academic', 'Academic Performance'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # ðŸ”¹ Multi-Tenancy
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    student_id = models.UUIDField()
    scheduled_class = models.ForeignKey(ScheduledClass, on_delete=models.CASCADE, related_name="student_warnings", null=True, blank=True)
    warning_type = models.CharField(max_length=20, choices=WARNING_TYPES, default='absent')
    description = models.TextField(blank=True, null=True)
    issued_by_id = models.UUIDField()
    issued_by_name = models.CharField(max_length=255, null=True, blank=True)
    issued_at = models.DateTimeField(auto_now_add=True)
    resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by_id = models.UUIDField(null=True, blank=True)
    resolution_notes = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Warning: {self.get_warning_type_display()} for student {self.student_id}"

    class Meta:
        verbose_name_plural = "Student Warnings"
        ordering = ['-issued_at']

class AttendanceContactLog(models.Model):
    CONTACT_METHODS = [
        ('whatsapp', 'WhatsApp'),
        ('call', 'Phone Call'),
        ('sms', 'SMS'),
        ('email', 'Email'),
        ('in_person', 'In Person'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    attendance = models.ForeignKey(Attendance, on_delete=models.CASCADE, related_name="contact_logs")
    contacted_by_id = models.UUIDField()
    contacted_by_name = models.CharField(max_length=255, null=True, blank=True)
    contacted_at = models.DateTimeField(auto_now_add=True)
    method = models.CharField(max_length=20, choices=CONTACT_METHODS, default='whatsapp')
    remarks = models.TextField(blank=True, null=True)
    resolved = models.BooleanField(default=False)

    class Meta:
        verbose_name_plural = "Attendance Contact Logs"
        ordering = ['-contacted_at']

# -----------------------------------------------------------
# RUBRIC MODELS (append to existing models.py)
# -----------------------------------------------------------

class Rubric(models.Model):
    """Grading rubric for assignments."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization_id = models.UUIDField(null=True, blank=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='rubrics')
    created_by_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Rubrics"
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.course.name})"


class RubricCriterion(models.Model):
    """Individual criterion within a rubric."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rubric = models.ForeignKey(Rubric, on_delete=models.CASCADE, related_name='criteria')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    max_score = models.FloatField(default=10)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name_plural = "Rubric Criteria"
        ordering = ['order']

    def __str__(self):
        return f"{self.rubric.name} - {self.name}"


class AssignmentRubric(models.Model):
    """Links a rubric to a specific assignment."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assignment = models.OneToOneField(Assignment, on_delete=models.CASCADE, related_name='rubric_link')
    rubric = models.ForeignKey(Rubric, on_delete=models.CASCADE)

    class Meta:
        verbose_name_plural = "Assignment Rubrics"

    def __str__(self):
        return f"{self.assignment.title} - {self.rubric.name}"


class SubmissionRubricScore(models.Model):
    """Per-criterion score for a submission."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name='rubric_scores')
    criterion = models.ForeignKey(RubricCriterion, on_delete=models.CASCADE)
    score = models.FloatField()
    feedback = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name_plural = "Submission Rubric Scores"
        unique_together = ['submission', 'criterion']

    def __str__(self):
        return f"{self.submission} - {self.criterion.name}: {self.score}"

