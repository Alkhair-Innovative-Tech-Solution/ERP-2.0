"""
Course models
"""
import uuid
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError


class Course(models.Model):
    """Course model"""
    LEVEL_CHOICES = [
        ('BEGINNER', 'Beginner'),
        ('INTERMEDIATE', 'Intermediate'),
        ('ADVANCED', 'Advanced'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course_code = models.CharField(max_length=50, unique=True, help_text='Unique course code (e.g., "CS101", "AI-PYTHON")')
    title = models.CharField(max_length=255)
    description = models.TextField()
    instructor_id = models.CharField(max_length=100, blank=True, null=True, help_text='Instructor will be assigned when schedule is created')  # UUID from auth-service
    category = models.CharField(max_length=100, blank=True, null=True, help_text='Course category/type')
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES, blank=True, null=True, help_text='Course difficulty level')
    duration = models.IntegerField(blank=True, null=True, help_text='Course duration')
    duration_unit = models.CharField(max_length=10, default='hours', blank=True, null=True, help_text='Duration unit (hours, days, weeks, months)')
    thumbnail = models.ImageField(upload_to='courses/thumbnails/', blank=True, null=True, help_text='Course thumbnail image')
    attachment = models.FileField(upload_to='courses/attachments/', blank=True, null=True, help_text='Course attachment (PDF, DOC, etc.)')
    intro_video = models.URLField(blank=True, null=True, help_text='Course intro video URL')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_published = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'courses_course'
        ordering = ['-created_at']
    
    def __str__(self):
        return self.title


class CourseEnrollment(models.Model):
    """Course enrollment model"""
    COMPLETION_STATUS_CHOICES = [
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('DROPPED', 'Dropped'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='enrollments')
    student_id = models.IntegerField()  # Student ID from auth-service (integer in database)
    enrolled_at = models.DateTimeField(auto_now_add=True)
    # Existing fields from database
    progress = models.IntegerField(default=0, help_text='Course progress percentage')
    last_accessed = models.DateTimeField(auto_now=True, help_text='Last time student accessed the course')
    scheduled_class = models.ForeignKey(
        'ScheduledClass', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='enrollments',
        db_column='scheduled_class_id'
    )
    # New fields for enrollment management
    is_active = models.BooleanField(default=True, help_text='Whether enrollment is active')
    completion_status = models.CharField(
        max_length=20, 
        choices=COMPLETION_STATUS_CHOICES, 
        default='IN_PROGRESS',
        help_text='Status of course completion'
    )
    completed_at = models.DateTimeField(blank=True, null=True, help_text='Date when course was completed')
    
    class Meta:
        db_table = 'courses_courseenrollment'
        unique_together = ['course', 'student_id']
    
    def clean(self):
        """Validate that student can only have one active enrollment at a time"""
        if self.is_active and self.pk is None:  # Only check for new enrollments
            # Check if student already has an active enrollment
            existing_active = CourseEnrollment.objects.filter(
                student_id=self.student_id,
                is_active=True,
                completion_status='IN_PROGRESS'
            ).exclude(pk=self.pk)
            
            if existing_active.exists():
                existing_course = existing_active.first().course
                raise ValidationError(
                    f'You are already enrolled in "{existing_course.title}" ({existing_course.course_code}). '
                    f'Please complete or drop that course before enrolling in a new one.'
                )
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.student_id} - {self.course.title}"


class Assignment(models.Model):
    """Assignment model"""
    ASSIGNMENT_TYPE_CHOICES = [
        ('HOMEWORK', 'Homework'),
        ('PROJECT', 'Project'),
        ('QUIZ', 'Quiz'),
        ('EXAM', 'Exam'),
        ('ESSAY', 'Essay'),
        ('OTHER', 'Other'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='assignments')
    title = models.CharField(max_length=255)
    description = models.TextField()
    instructions = models.TextField(help_text='Detailed instructions for the assignment')
    total_marks = models.IntegerField(default=100, help_text='Total marks for this assignment')
    due_date = models.DateTimeField()
    assignment_type = models.CharField(
        max_length=20,
        choices=ASSIGNMENT_TYPE_CHOICES,
        default='HOMEWORK',
        help_text='Type of assignment'
    )
    is_published = models.BooleanField(default=False, help_text='Whether assignment is published and visible to students')
    created_by_id = models.IntegerField(help_text='ID of the teacher who created this assignment')
    attachment = models.FileField(
        upload_to='assignments/attachments/',
        blank=True,
        null=True,
        help_text='Attach files (images, documents, PDFs, etc.)'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'courses_assignment'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.course.title} - {self.title}"


class AssignmentSubmission(models.Model):
    """Assignment submission model for students"""
    STATUS_CHOICES = [
        ('SUBMITTED', 'Submitted'),
        ('GRADED', 'Graded'),
        ('RETURNED', 'Returned'),
        ('LATE', 'Late Submission'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='submissions')
    student_id = models.IntegerField(help_text='ID of the student who submitted')
    submission_file_url = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text='URL/path to student submission file',
        db_column='submission_file_url'
    )
    submission_text = models.TextField(blank=True, null=True, help_text='Optional text submission')
    submitted_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='SUBMITTED',
        help_text='Submission status'
    )
    marks_obtained = models.IntegerField(blank=True, null=True, help_text='Marks obtained out of total marks', db_column='marks_obtained')
    feedback = models.TextField(blank=True, null=True, help_text='Teacher feedback')
    graded_by_id = models.IntegerField(blank=True, null=True, help_text='ID of teacher who graded')
    graded_at = models.DateTimeField(blank=True, null=True, help_text='When assignment was graded')
    
    class Meta:
        db_table = 'courses_assignmentsubmission'
        unique_together = ['assignment', 'student_id']  # One submission per student per assignment
        ordering = ['-submitted_at']
    
    def __str__(self):
        return f"{self.assignment.title} - Student {self.student_id}"
    
    def is_late(self):
        """Check if submission is late"""
        try:
            # Check if assignment exists and has due_date
            if self.assignment and self.assignment.due_date and self.submitted_at:
                return self.submitted_at > self.assignment.due_date
        except AssignmentSubmission.assignment.RelatedObjectDoesNotExist:
            # Assignment not set yet, can't check if late
            pass
        return False
    
    def save(self, *args, **kwargs):
        """Override save to set status to LATE if submitted after due date"""
        # Only check if assignment is already set (for updates)
        # Skip this check on initial creation as assignment might not be loaded yet
        if self.pk:  # Only check if object already exists (update case)
            try:
                if self.is_late() and self.status == 'SUBMITTED':
                    self.status = 'LATE'
            except AssignmentSubmission.assignment.RelatedObjectDoesNotExist:
                # Assignment not set, skip late check
                pass
        super().save(*args, **kwargs)


class TimeSlot(models.Model):
    """Time slot model for predefined class timings"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slot_name = models.CharField(max_length=50, unique=True, help_text='Display name like "3-5 PM", "1:30-3:00 PM"')
    start_time = models.TimeField(help_text='Start time (e.g., 15:00 for 3 PM, 13:30 for 1:30 PM)')
    end_time = models.TimeField(help_text='End time (e.g., 17:00 for 5 PM, 15:00 for 3 PM)')
    is_active = models.BooleanField(default=True, help_text='Whether this time slot is active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'courses_timeslot'
        unique_together = [['start_time', 'end_time']]
        ordering = ['start_time']
    
    def __str__(self):
        return self.slot_name


class ScheduledClass(models.Model):
    """Scheduled class model"""
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    DAYS_CHOICES = [
        ('Monday', 'Monday'),
        ('Tuesday', 'Tuesday'),
        ('Wednesday', 'Wednesday'),
        ('Thursday', 'Thursday'),
        ('Friday', 'Friday'),
        ('Saturday', 'Saturday'),
        ('Sunday', 'Sunday'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='scheduled_classes')
    class_name = models.CharField(max_length=255, blank=True, null=True, help_text='Name of the class/section (e.g., "Morning Batch", "Evening Batch")', db_column='section_name')
    instructor_id = models.CharField(max_length=100, blank=True, null=True, help_text='Instructor UUID from auth-service', db_column='instructor_id')
    time_slot = models.ForeignKey(TimeSlot, on_delete=models.PROTECT, related_name='scheduled_classes', db_column='time_slot_id', blank=True, null=True, help_text='Predefined time slot')
    days = models.JSONField(default=list, blank=True, null=True, help_text='Selected days as array ["Monday", "Wednesday", "Friday"]', db_column='class_days')
    room = models.CharField(max_length=100, blank=True, null=True, help_text='Room/location (e.g., "1A", "Room 101", "Lab 2")', db_column='room_number')
    max_students = models.IntegerField(blank=True, null=True, help_text='Maximum students')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'courses_scheduledclass'
        ordering = ['time_slot__start_time', 'class_name']
    
    def clean(self):
        """Validate that instructor and room are not assigned to overlapping classes at same time slot"""
        errors = {}
        
        # Only validate if time_slot and days are provided
        if not self.time_slot or not self.days:
            return
        
        # Ensure days is a list
        if not isinstance(self.days, list) or len(self.days) == 0:
            return
        
        # Query for ACTIVE classes with same time_slot (only check against ACTIVE classes)
        base_query = ScheduledClass.objects.filter(
            time_slot=self.time_slot,
            status='ACTIVE'
        ).exclude(pk=self.pk)  # Exclude current instance for updates
        
        # Check for instructor conflicts
        if self.instructor_id:
            instructor_conflicts = base_query.filter(instructor_id=self.instructor_id)
            
            for conflicting_class in instructor_conflicts:
                if not conflicting_class.days or not isinstance(conflicting_class.days, list):
                    continue
                
                # Check if any day overlaps
                overlapping_days = set(self.days) & set(conflicting_class.days)
                if overlapping_days:
                    class_name = conflicting_class.class_name or f"Class {conflicting_class.id.hex[:8]}"
                    course_code = conflicting_class.course.course_code if conflicting_class.course else "Unknown"
                    time_slot_name = conflicting_class.time_slot.slot_name if conflicting_class.time_slot else "Unknown time"
                    days_str = ', '.join(sorted(conflicting_class.days))
                    overlapping_str = ', '.join(sorted(overlapping_days))
                    
                    errors['instructor_id'] = ValidationError(
                        f"This instructor is already assigned to {course_code} - {class_name} "
                        f"at {time_slot_name} on {days_str}. "
                        f"Overlapping days: {overlapping_str}. "
                        f"Please choose a different time slot or different days.",
                        code='instructor_conflict'
                    )
                    break
        
        # Check for room conflicts
        if self.room:
            room_conflicts = base_query.filter(room=self.room)
            
            for conflicting_class in room_conflicts:
                if not conflicting_class.days or not isinstance(conflicting_class.days, list):
                    continue
                
                # Check if any day overlaps
                overlapping_days = set(self.days) & set(conflicting_class.days)
                if overlapping_days:
                    class_name = conflicting_class.class_name or f"Class {conflicting_class.id.hex[:8]}"
                    course_code = conflicting_class.course.course_code if conflicting_class.course else "Unknown"
                    time_slot_name = conflicting_class.time_slot.slot_name if conflicting_class.time_slot else "Unknown time"
                    days_str = ', '.join(sorted(conflicting_class.days))
                    overlapping_str = ', '.join(sorted(overlapping_days))
                    
                    errors['room'] = ValidationError(
                        f"Room {self.room} is already booked for {course_code} - {class_name} "
                        f"at {time_slot_name} on {days_str}. "
                        f"Overlapping days: {overlapping_str}. "
                        f"Please choose a different room, time slot, or different days.",
                        code='room_conflict'
                    )
                    break
        
        # Raise all errors at once if any found
        if errors:
            raise ValidationError(errors)
    
    def save(self, *args, **kwargs):
        # Run validation before saving
        self.full_clean()
        # Populate start_time and end_time from time_slot if available
        if self.time_slot:
            # These will be stored in the database for backward compatibility
            # but we use time_slot for the actual relationship
            pass
        super().save(*args, **kwargs)
    
    def __str__(self):
        class_display = self.class_name or f"Class {self.id.hex[:8]}"
        return f"{self.course.course_code} - {class_display}"


class Announcement(models.Model):
    """Announcement model"""
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='announcements')
    title = models.CharField(max_length=255)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'courses_announcement'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.course.title} - {self.title}"


class Attendance(models.Model):
    """Attendance model for tracking attendance per scheduled class session"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scheduled_class = models.ForeignKey(
        ScheduledClass,
        on_delete=models.CASCADE,
        related_name='attendances',
        help_text='Scheduled class for this attendance'
    )
    date = models.DateField(help_text='Date of the class session')
    marked_by = models.CharField(
        max_length=100,
        help_text='Instructor ID who marked the attendance'
    )
    # Calculated fields
    total_students = models.PositiveIntegerField(default=0, help_text='Total students in the class')
    present_count = models.PositiveIntegerField(default=0, help_text='Number of present students')
    absent_count = models.PositiveIntegerField(default=0, help_text='Number of absent students')
    late_count = models.PositiveIntegerField(default=0, help_text='Number of late students')
    leave_count = models.PositiveIntegerField(default=0, help_text='Number of students on leave')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'courses_attendance'
        unique_together = ['scheduled_class', 'date']
        ordering = ['-date', 'scheduled_class']
    
    def __str__(self):
        class_display = self.scheduled_class.class_name or f"Class {self.scheduled_class.id.hex[:8]}"
        return f"{self.scheduled_class.course.course_code} - {class_display} - {self.date}"
    
    def update_counts(self):
        """Update attendance counts from student attendance records"""
        student_attendances = self.student_attendances.all()
        self.total_students = student_attendances.count()
        self.present_count = student_attendances.filter(status='present').count()
        self.absent_count = student_attendances.filter(status='absent').count()
        self.late_count = student_attendances.filter(status='late').count()
        self.leave_count = student_attendances.filter(status='leave').count()
        # Use update_fields to prevent infinite recursion
        super(Attendance, self).save(update_fields=[
            'total_students', 'present_count', 'absent_count',
            'late_count', 'leave_count', 'updated_at'
        ])


class StudentAttendance(models.Model):
    """Student attendance model for tracking individual student attendance"""
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('late', 'Late'),
        ('leave', 'Leave'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    attendance = models.ForeignKey(
        Attendance,
        on_delete=models.CASCADE,
        related_name='student_attendances',
        help_text='Attendance record this belongs to'
    )
    student_id = models.IntegerField(help_text='Student ID from auth-service')
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='present',
        help_text='Attendance status'
    )
    remarks = models.TextField(blank=True, null=True, help_text='Optional remarks')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'courses_studentattendance'
        unique_together = ['attendance', 'student_id']
        ordering = ['student_id']
    
    def __str__(self):
        return f"Student {self.student_id} - {self.get_status_display()} - {self.attendance.date}"

