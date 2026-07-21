"""
Admin configuration for courses
"""
from django.contrib import admin
from django import forms
from django.core.exceptions import ValidationError
from .models import Course, CourseEnrollment, Assignment, ScheduledClass, Announcement, TimeSlot, AssignmentSubmission, Attendance, StudentAttendance


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('course_code', 'title', 'instructor_id', 'category', 'level', 'is_published', 'created_at')
    list_filter = ('is_published', 'level', 'category', 'created_at', 'instructor_id')
    search_fields = ('course_code', 'title', 'description', 'category', 'instructor_id')
    fieldsets = (
        ('Basic Information', {
            'fields': ('course_code', 'title', 'description')
        }),
        ('Course Details', {
            'fields': ('category', 'level', 'duration', 'duration_unit')
        }),
        ('Instructor Assignment', {
            'fields': ('instructor_id',),
            'description': 'Assign a teacher to this course. Enter teacher user ID from auth-service.'
        }),
        ('Media & Attachments', {
            'fields': ('thumbnail', 'attachment', 'intro_video')
        }),
        ('Status', {
            'fields': ('is_published',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ('created_at', 'updated_at')


@admin.register(CourseEnrollment)
class CourseEnrollmentAdmin(admin.ModelAdmin):
    list_display = ('course', 'student_id', 'enrolled_at', 'is_active')
    list_filter = ('is_active', 'enrolled_at')
    search_fields = ('student_id', 'course__title')


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'assignment_type', 'total_marks', 'due_date', 'is_published', 'has_attachment', 'created_at')
    list_filter = ('assignment_type', 'is_published', 'due_date', 'created_at')
    search_fields = ('title', 'course__title', 'description')
    fieldsets = (
        ('Basic Information', {
            'fields': ('course', 'title', 'description', 'instructions')
        }),
        ('Assignment Details', {
            'fields': ('assignment_type', 'total_marks', 'due_date', 'is_published', 'created_by_id', 'attachment')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ('created_at', 'updated_at')
    
    def has_attachment(self, obj):
        """Check if assignment has attachment"""
        return bool(obj.attachment)
    has_attachment.boolean = True
    has_attachment.short_description = 'Has Attachment'


@admin.register(TimeSlot)
class TimeSlotAdmin(admin.ModelAdmin):
    list_display = ('slot_name', 'start_time', 'end_time', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('slot_name',)
    ordering = ('start_time',)


class ScheduledClassAdminForm(forms.ModelForm):
    """Custom form for ScheduledClass with days checkboxes"""
    days = forms.MultipleChoiceField(
        choices=ScheduledClass.DAYS_CHOICES,
        widget=forms.CheckboxSelectMultiple,
        required=False,
        help_text='Select days for this class'
    )
    
    class Meta:
        model = ScheduledClass
        fields = '__all__'
        # class_code field has been removed from model, no need to exclude
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            # Load existing days from JSONField
            if isinstance(self.instance.days, list):
                self.initial['days'] = self.instance.days
        else:
            self.initial['days'] = []
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        # Save days as list
        instance.days = self.cleaned_data.get('days', [])
        
        # Run validation before saving
        try:
            instance.full_clean()
        except ValidationError as e:
            # Add validation errors to form
            for field, errors in e.error_dict.items():
                for error in errors:
                    self.add_error(field, error)
            return instance
        
        if commit:
            instance.save()
        return instance


@admin.register(ScheduledClass)
class ScheduledClassAdmin(admin.ModelAdmin):
    form = ScheduledClassAdminForm
    list_display = ('course', 'get_course_code', 'class_name', 'instructor_id', 'time_slot', 'room', 'get_days_display', 'status', 'created_at')
    list_filter = ('status', 'time_slot', 'course', 'instructor_id')
    search_fields = ('class_name', 'course__course_code', 'course__title', 'room', 'instructor_id')
    fieldsets = (
        ('Class Information', {
            'fields': ('course', 'class_name'),
            'description': 'Select a course (course code will be used automatically) and enter class name (e.g., "Morning Batch", "Evening Batch").'
        }),
        ('Schedule', {
            'fields': ('time_slot', 'days', 'room'),
            'description': 'Select time slot (e.g., 3-5 PM, 5-7 PM) and days (Monday, Wednesday, Friday). Make sure time slots exist in TimeSlot admin first.'
        }),
        ('Instructor & Capacity', {
            'fields': ('instructor_id', 'max_students'),
            'description': 'Enter teacher user ID (number) from auth-service. This should match the instructor_id in Course model.'
        }),
        ('Status', {
            'fields': ('status',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ('created_at', 'updated_at')
    
    def get_course_code(self, obj):
        """Display course code from related Course"""
        return obj.course.course_code if obj.course else '-'
    get_course_code.short_description = 'Course Code'
    get_course_code.admin_order_field = 'course__course_code'
    
    def get_days_display(self, obj):
        """Display days as comma-separated string"""
        if isinstance(obj.days, list):
            return ', '.join(obj.days)
        return '-'
    get_days_display.short_description = 'Days'


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('title', 'course__title')


@admin.register(AssignmentSubmission)
class AssignmentSubmissionAdmin(admin.ModelAdmin):
    list_display = ('assignment', 'student_id', 'status', 'marks_obtained', 'submitted_at', 'graded_at')
    list_filter = ('status', 'submitted_at', 'graded_at')
    search_fields = ('assignment__title', 'student_id', 'feedback')
    readonly_fields = ('submitted_at', 'graded_at', 'is_late')
    fieldsets = (
        ('Submission Information', {
            'fields': ('assignment', 'student_id', 'submission_file_url', 'submission_text', 'submitted_at')
        }),
        ('Grading', {
            'fields': ('status', 'marks_obtained', 'feedback', 'graded_by_id', 'graded_at')
        }),
        ('Additional Info', {
            'fields': ('is_late',),
            'classes': ('collapse',)
        }),
    )
    
    def is_late(self, obj):
        """Check if submission is late"""
        return obj.is_late()
    is_late.boolean = True
    is_late.short_description = 'Is Late'


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ('scheduled_class', 'date', 'marked_by', 'total_students', 'present_count', 'absent_count', 'late_count', 'leave_count', 'created_at')
    list_filter = ('date', 'scheduled_class', 'marked_by', 'created_at')
    search_fields = ('scheduled_class__class_name', 'scheduled_class__course__course_code', 'marked_by')
    readonly_fields = ('total_students', 'present_count', 'absent_count', 'late_count', 'leave_count', 'created_at', 'updated_at')
    fieldsets = (
        ('Attendance Information', {
            'fields': ('scheduled_class', 'date', 'marked_by')
        }),
        ('Attendance Summary', {
            'fields': ('total_students', 'present_count', 'absent_count', 'late_count', 'leave_count'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    ordering = ('-date', 'scheduled_class')


@admin.register(StudentAttendance)
class StudentAttendanceAdmin(admin.ModelAdmin):
    list_display = ('attendance', 'student_id', 'status', 'remarks', 'created_at')
    list_filter = ('status', 'attendance__date', 'attendance__scheduled_class')
    search_fields = ('student_id', 'attendance__scheduled_class__class_name', 'remarks')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Student Attendance Information', {
            'fields': ('attendance', 'student_id', 'status', 'remarks')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    ordering = ('attendance__date', 'student_id')

