from django.db import models
from users.managers import OrganizationManager
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db.models import Q, Count, Sum
from datetime import datetime, timedelta
import json

User = get_user_model()


class CentralAuthFieldsMixin(models.Model):
    """
    Phase C10: additive, nullable fields for the central-auth repoint. Same
    shape as C1-C9's mixin (campus-service's `campus/models.py`,
    timetable-service's `timetable/models.py`, etc.) — dual-run, the
    existing `organization` FK and OrganizationManager-based `objects`
    manager on each model are untouched; these are new, parallel fields
    used only by the central-auth code path (see
    attendance_service/dual_auth.py, attendance/views.py).

    tenant_id:       stamped from the verified token's tenant_id claim on
                      create, used to scope reads for central-auth requests.
    central_org_id:   maps this row's local `users.Organization` to its
                      central-auth Organization equivalent. Nullable,
                      backfillable — synthetic-only for now.
    """
    tenant_id = models.UUIDField(null=True, blank=True, db_index=True)
    central_org_id = models.UUIDField(null=True, blank=True, db_index=True)

    class Meta:
        abstract = True


class Attendance(CentralAuthFieldsMixin, models.Model):
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    # Phase C10: unfiltered manager — needed by the central-auth read path
    # (see attendance_service/dual_auth.py's central_tenant_qs), mirroring
    # the C5-class hazard fix established in every prior phase (this model
    # had NO unfiltered manager at all before this phase — confirmed by
    # grep, zero `all_objects` hits anywhere in this file).
    all_objects = models.Manager()
    """Model for tracking classroom attendance with audit trail"""
    classroom = models.ForeignKey(
        'classes.ClassRoom',
        on_delete=models.CASCADE,
        related_name='attendances'
    )
    
    # Organization
    organization = models.ForeignKey(
        'users.Organization', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='attendances'
    )
    date = models.DateField()
    marked_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='marked_attendances'
    )
    
    # Audit fields
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_attendances'
    )
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_attendances'
    )
    marked_at = models.DateTimeField(auto_now_add=True)
    last_edited_at = models.DateTimeField(null=True, blank=True)
    update_history = models.JSONField(default=list, blank=True)
    is_final = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deleted_attendances'
    )
    
    # State management
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('under_review', 'Under Review'),
        ('approved', 'Approved'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    submitted_at = models.DateTimeField(null=True, blank=True)
    submitted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='submitted_attendances')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_attendances')
    finalized_at = models.DateTimeField(null=True, blank=True)
    finalized_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='finalized_attendances')
    reopened_at = models.DateTimeField(null=True, blank=True)
    reopened_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reopened_attendances')
    reopen_reason = models.TextField(null=True, blank=True)

    # Phase C10: central-auth counterparts of the 8 legacy audit-trail
    # person-FKs above. A CentralAuthUser has no row in this service's
    # local `users.User` table, so the legacy FK is left NULL on that path
    # (see attendance_service/dual_auth.py's central_person_id / the
    # views.py workflow functions) and the acting identity is stamped here
    # instead. Nullable, additive — dual-run, nothing removed.
    central_marked_by_id = models.UUIDField(null=True, blank=True, db_index=True)
    central_created_by_id = models.UUIDField(null=True, blank=True, db_index=True)
    central_updated_by_id = models.UUIDField(null=True, blank=True, db_index=True)
    central_deleted_by_id = models.UUIDField(null=True, blank=True, db_index=True)
    central_submitted_by_id = models.UUIDField(null=True, blank=True, db_index=True)
    central_reviewed_by_id = models.UUIDField(null=True, blank=True, db_index=True)
    central_finalized_by_id = models.UUIDField(null=True, blank=True, db_index=True)
    central_reopened_by_id = models.UUIDField(null=True, blank=True, db_index=True)

    # Archive fields for holiday replacement
    replaced_by_holiday = models.BooleanField(default=False)
    replaced_at = models.DateTimeField(null=True, blank=True)
    archived_data = models.JSONField(null=True, blank=True)
    
    # Calculated fields
    total_students = models.PositiveIntegerField(default=0)
    present_count = models.PositiveIntegerField(default=0)
    absent_count = models.PositiveIntegerField(default=0)
    late_count = models.PositiveIntegerField(default=0)
    leave_count = models.PositiveIntegerField(default=0)
    excused_count = models.PositiveIntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['classroom', 'date']
        ordering = ['-date', 'classroom']
        verbose_name = "Attendance"
        verbose_name_plural = "Attendances"
        indexes = [
            models.Index(fields=['classroom', 'date', 'status']),
        ]
    
    def __str__(self):
        return f"{self.classroom} - {self.date}"
    
    @property
    def is_editable(self):
        """Check if attendance can be edited based on status"""
        if self.status == 'approved':
            return False
        if self.status == 'under_review':
            # Teachers can edit within 7 days, coordinators can always edit
            return (timezone.now().date() - self.date).days <= 7
        if self.status == 'draft':
            # Legacy support for draft status
            return (timezone.now().date() - self.date).days <= 7
        if self.status == 'submitted':
            # Legacy support for submitted status
            return True  # Coordinator can edit
        return False
    
    @property
    def attendance_percentage(self):
        """Present students as a percentage of those expected to attend.

        Defined in attendance.services.metrics — do not reimplement it here or
        at a call site. Approved leave is excluded from the denominator, so a
        class where everyone present attended reads 100% even if some students
        were on leave.
        """
        from attendance.services.metrics import attendance_percentage
        return attendance_percentage(
            present=self.present_count,
            total=self.total_students,
            leave=self.leave_count,
            excused=self.excused_count,
        )
    
    def clean(self):
        """Validate attendance data"""
        # Prevent future dates
        if self.date and self.date > timezone.now().date():
            raise ValidationError("Cannot mark attendance for future dates")
        
        # Validate classroom exists and is active
        if self.classroom and not self.classroom.grade:
            raise ValidationError("Classroom must have an associated grade")
    
    def update_counts(self):
        """Update attendance counts from student attendance records"""
        student_attendances = self.student_attendances.all()
        self.total_students = student_attendances.count()
        self.present_count = student_attendances.filter(status='present').count()
        self.absent_count = student_attendances.filter(status='absent').count()
        self.late_count = student_attendances.filter(status='late').count()
        self.leave_count = student_attendances.filter(status='leave').count()
        # 'excused' is a valid StudentAttendance status; without its own counter
        # it stayed inside total_students but outside every count, silently
        # dragging the percentage down as though the student were absent.
        self.excused_count = student_attendances.filter(status='excused').count()
        # Use update_fields to prevent infinite recursion
        super(Attendance, self).save(update_fields=[
            'total_students', 'present_count', 'absent_count', 
            'late_count', 'leave_count', 'excused_count', 'updated_at'
        ])
    
    def add_edit_history(self, user, action, reason=None, changes=None):
        """Add entry to edit history"""
        from django.db.models import Model as DjangoModel
        # Resolve _TokenUser → real DB User for FK field; keep original for JSON meta
        if isinstance(user, DjangoModel):
            db_user = user
        else:
            uid = getattr(user, 'id', None) or getattr(user, 'pk', None)
            db_user = None
            if uid:
                try:
                    # Phase C10: a CentralAuthUser's `id` is a UUID string,
                    # not this table's (integer) primary key — `pk=uid`
                    # would raise ValueError (not User.DoesNotExist) deep
                    # inside the ORM's query-building, uncaught by the
                    # narrower except below, and add_edit_history() is
                    # called from every workflow step. int(uid) no-ops for
                    # every legacy caller (uid is already an int there) and
                    # safely routes a central-auth caller to db_user=None.
                    db_user = User.objects.get(pk=int(uid))
                except (User.DoesNotExist, TypeError, ValueError):
                    pass

        user_name = (
            user.get_full_name() if hasattr(user, 'get_full_name') else None
        ) or getattr(user, 'username', '') or str(user)

        history_entry = {
            'timestamp': timezone.now().isoformat(),
            'user_id': getattr(user, 'id', None),
            'user_name': user_name,
            'action': action,
            'reason': reason,
            'changes': changes or {}
        }
        self.update_history.append(history_entry)
        self.last_edited_at = timezone.now()
        self.updated_by = db_user
        self.save(update_fields=['update_history', 'last_edited_at', 'updated_by'])
    
    def soft_delete(self, user, reason=None):
        """Soft delete attendance record"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.deleted_by = user
        self.add_edit_history(user, 'deleted', reason)
        self.save()
    
    def restore(self, user, reason=None):
        """Restore soft deleted attendance record"""
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.add_edit_history(user, 'restored', reason)
        self.save()
    
    def save(self, *args, **kwargs):
        # Auto-set organization from classroom if not set
        if not self.organization and self.classroom:
            self.organization = self.classroom.organization
            
        # Run validation
        self.clean()
        
        # Set created_by if not set
        if not self.pk and not self.created_by:
            # This will be set by the view
            pass
        
        # Don't call update_counts here to avoid recursion
        # update_counts will be called explicitly when needed
        super().save(*args, **kwargs)


class StudentAttendance(CentralAuthFieldsMixin, models.Model):
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    # Phase C10: unfiltered manager — same C5-class hazard fix as Attendance
    # above (no `all_objects` existed on this model before this phase either).
    all_objects = models.Manager()
    """Model for tracking individual student attendance with audit trail"""
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('late', 'Late'),
        ('leave', 'Leave'),
        ('excused', 'Excused'),
    ]
    
    student = models.ForeignKey(
        'students.Student',
        on_delete=models.CASCADE,
        related_name='attendances'
    )
    attendance = models.ForeignKey(
        Attendance,
        on_delete=models.CASCADE,
        related_name='student_attendances'
    )
    
    # Organization
    organization = models.ForeignKey(
        'users.Organization', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='student_attendances'
    )
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='present'
    )
    remarks = models.TextField(blank=True, null=True)
    
    # Audit fields
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_student_attendances'
    )
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_student_attendances'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    # Phase C10: central-auth counterparts of the 2 legacy audit-trail
    # person-FKs above — same reasoning as Attendance's central_*_by_id
    # block.
    central_created_by_id = models.UUIDField(null=True, blank=True, db_index=True)
    central_updated_by_id = models.UUIDField(null=True, blank=True, db_index=True)

    class Meta:
        unique_together = ['student', 'attendance']
        ordering = ['attendance__date', 'student__name']
        verbose_name = "Student Attendance"
        verbose_name_plural = "Student Attendances"
    
    def __str__(self):
        return f"{self.student.name} - {self.attendance.date} - {self.get_status_display()}"
    
    def clean(self):
        """Validate student attendance data"""
        # Ensure student belongs to the classroom
        if self.student and self.attendance and self.student.classroom != self.attendance.classroom:
            raise ValidationError("Student must belong to the same classroom as the attendance record")
    
    def save(self, *args, **kwargs):
        # Auto-set organization from attendance if not set
        if not self.organization and self.attendance:
            self.organization = self.attendance.organization
            
        self.clean()
        super().save(*args, **kwargs)


class Holiday(models.Model):
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    """Model for tracking holidays defined by coordinators"""
    date = models.DateField()
    reason = models.CharField(max_length=200)

    # Organization
    organization = models.ForeignKey(
        'users.Organization', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='holidays'
    )
    # Keep level for backward compatibility (nullable for existing records)
    level = models.ForeignKey('classes.Level', on_delete=models.CASCADE, related_name='holidays', null=True, blank=True)
    # New: Support multiple levels
    levels = models.ManyToManyField('classes.Level', related_name='holiday_set', blank=True)
    # New: Optional grade-specific holidays
    grades = models.ManyToManyField('classes.Grade', related_name='holidays', blank=True)
    # Track targeted shifts (derived from level shifts)
    shifts = models.JSONField(default=list, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_holidays')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        # Remove unique_together constraint as we now support multiple levels
        # Will handle uniqueness in API validation
        ordering = ['-date']
    
    def __str__(self):
        level_names = ', '.join([l.name for l in self.levels.all()]) if self.levels.exists() else (self.level.name if self.level else 'No Level')
        grade_names = ', '.join([g.name for g in self.grades.all()]) if self.grades.exists() else None
        shift_names = ', '.join(sorted(set(self.shifts))) if self.shifts else None
        if grade_names:
            descriptor = f"{level_names} - {grade_names}"
        else:
            descriptor = level_names
        if shift_names:
            descriptor = f"{descriptor} [{shift_names}]"
        return f"{self.date} - {self.reason} ({descriptor})"


class AttendanceBackfillPermission(models.Model):
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    """Model for tracking backfill permissions granted by coordinators"""
    classroom = models.ForeignKey('classes.ClassRoom', on_delete=models.CASCADE)
    
    # Organization
    organization = models.ForeignKey(
        'users.Organization', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='backfill_permissions'
    )
    date = models.DateField()
    granted_to = models.ForeignKey(User, on_delete=models.CASCADE, related_name='backfill_permissions')
    granted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='granted_backfill_permissions')
    reason = models.TextField()
    deadline = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['classroom', 'date', 'granted_to']
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.classroom} - {self.date} - {self.granted_to.username}"
    
    @property
    def is_expired(self):
        return timezone.now() > self.deadline


class AuditLog(models.Model):
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    """Unified audit log for all system actions"""
    ACTION_TYPES = [
        ('create', 'Create'),
        ('update', 'Update'),
        ('delete', 'Delete'),
        ('restore', 'Restore'),
        ('mark', 'Mark Attendance'),
        ('submit', 'Submit'),
        ('review', 'Review'),
        ('finalize', 'Finalize'),
        ('reopen', 'Reopen'),
        ('approve', 'Approve'),
        ('reject', 'Reject'),
        ('assign', 'Assign'),
        ('unassign', 'Unassign'),
        ('password_change', 'Password Change'),
        ('status_change', 'Status Change'),
    ]

    FEATURE_TYPES = [
        ('attendance', 'Attendance'),
        ('student', 'Student'),
        ('teacher', 'Teacher'),
        ('coordinator', 'Coordinator'),
        ('principal', 'Principal'),
        ('classroom', 'Classroom'),
        ('grade', 'Grade'),
        ('level', 'Level'),
        ('campus', 'Campus'),
        ('user', 'User'),
        ('result', 'Result'),
        ('transfer', 'Transfer'),
    ]

    feature = models.CharField(max_length=50, choices=FEATURE_TYPES)
    action = models.CharField(max_length=50, choices=ACTION_TYPES)
    entity_type = models.CharField(max_length=100)
    entity_id = models.IntegerField()
    is_recovered = models.BooleanField(default=False)

    # Organization
    organization = models.ForeignKey(
        'users.Organization',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='audit_logs'
    )
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    timestamp = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    changes = models.JSONField(default=dict, blank=True)
    reason = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['feature', 'action']),
            models.Index(fields=['entity_type', 'entity_id']),
            models.Index(fields=['user', 'timestamp']),
        ]
    
    def __str__(self):
        return f"{self.feature} - {self.action} by {self.user.username if self.user else 'System'}"


class Weekend(models.Model):
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    """Model to track weekends (Sundays) for each level"""
    # Make date non-unique; uniqueness is enforced on (level, date)
    date = models.DateField()
    level = models.ForeignKey('classes.Level', on_delete=models.CASCADE, related_name='weekends')

    # Organization
    organization = models.ForeignKey(
        'users.Organization', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='weekends'
    )
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_weekends')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-date']
        indexes = [
            models.Index(fields=['date']),
            models.Index(fields=['level', 'date']),
        ]
        unique_together = ['date', 'level']
    
    def __str__(self):
        return f"Weekend - {self.date} ({self.level.name})"


class StaffAttendance(models.Model):
    objects = OrganizationManager()

    SOURCE_CHOICES = [
        ('biometric', 'Biometric Machine'),
        ('manual', 'Manual Entry'),
    ]
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('late', 'Late'),
        ('leave', 'Leave'),
        ('half_day', 'Half Day'),
    ]

    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE,
        null=True, blank=True, related_name='teacher_attendances'
    )
    user = models.ForeignKey(
        'users.User', on_delete=models.CASCADE,
        related_name='staff_attendances'
    )
    # Keeping teacher link optionally if needed for profile ref, but user is primary
    teacher = models.ForeignKey(
        'teachers.Teacher', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='staff_attendances'
    )
    campus = models.ForeignKey(
        'campus.Campus', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='teacher_attendances'
    )
    date = models.DateField()

    check_in_time  = models.TimeField(null=True, blank=True)
    check_out_time = models.TimeField(null=True, blank=True)
    working_hours  = models.DurationField(null=True, blank=True)

    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default='absent')
    late_minutes = models.IntegerField(default=0)
    early_departure_minutes = models.IntegerField(default=0)

    source    = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='manual')
    device    = models.ForeignKey(
        'BiometricDevice', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='attendance_logs'
    )

    marked_by = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='marked_teacher_attendances'
    )
    remarks   = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'date']
        ordering = ['-date', 'user__first_name']

    def __str__(self):
        return f"{self.user.get_full_name()} — {self.date} — {self.get_status_display()}"

    @property
    def late_formatted(self):
        if not self.late_minutes or self.late_minutes <= 0:
            return ""
        hours = self.late_minutes // 60
        mins = self.late_minutes % 60
        return f"{hours}h {mins}m" if hours > 0 else f"{mins}m"

    @property
    def early_departure_formatted(self):
        if not self.early_departure_minutes or self.early_departure_minutes <= 0:
            return ""
        hours = self.early_departure_minutes // 60
        mins = self.early_departure_minutes % 60
        return f"{hours}h {mins}m" if hours > 0 else f"{mins}m"

    def save(self, *args, **kwargs):
        if self.check_in_time and self.check_out_time:
            from datetime import time as time_type
            def to_time(val):
                if isinstance(val, time_type):
                    return val
                if isinstance(val, str):
                    parts = val.split(':')
                    return time_type(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)
                return val
            dummy = datetime(2000, 1, 1)
            ci = datetime.combine(dummy.date(), to_time(self.check_in_time))
            co = datetime.combine(dummy.date(), to_time(self.check_out_time))
            if co > ci:
                self.working_hours = co - ci
        super().save(*args, **kwargs)



class EmployeeShiftTiming(models.Model):
    """
    Per-employee timing assignment.
    If shift_type is set (morning/afternoon/full_day), times come from CampusDefaultTiming.
    If shift_type is 'custom', check_in_time/check_out_time are used directly.
    """
    SHIFT_CHOICES = [
        ('morning',   'Morning'),
        ('afternoon', 'Afternoon'),
        ('full_day',  'Full Day'),
        ('custom',    'Custom'),
    ]

    objects = OrganizationManager()

    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE,
        null=True, blank=True, related_name='employee_shift_timings'
    )
    user = models.OneToOneField(
        User, on_delete=models.CASCADE,
        related_name='shift_timing',
        null=True, blank=True
    )
    shift_type     = models.CharField(max_length=20, choices=SHIFT_CHOICES, default='custom', null=True, blank=True)
    check_in_time  = models.TimeField(null=True, blank=True, help_text="Used only when shift_type='custom'")
    check_out_time = models.TimeField(null=True, blank=True, help_text="Used only when shift_type='custom'")
    grace_minutes  = models.PositiveIntegerField(default=10)
    is_active      = models.BooleanField(default=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['user__first_name']

    def __str__(self):
        return f"{self.user.get_full_name()} — In:{self.check_in_time} Out:{self.check_out_time}"


class CampusDefaultTiming(models.Model):
    """
    Per-shift campus timing preset.
    One record per (campus, shift_type). Used for late calculation fallback.
    """
    SHIFT_CHOICES = [
        ('morning',   'Morning'),
        ('afternoon', 'Afternoon'),
        ('full_day',  'Full Day'),
    ]

    objects = OrganizationManager()

    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE,
        null=True, blank=True, related_name='campus_default_timings'
    )
    campus = models.ForeignKey(
        'campus.Campus', on_delete=models.CASCADE,
        related_name='default_timings'
    )
    shift_type     = models.CharField(max_length=20, choices=SHIFT_CHOICES, default='full_day')
    check_in_time  = models.TimeField()
    check_out_time = models.TimeField()
    grace_minutes  = models.PositiveIntegerField(default=10)
    is_active      = models.BooleanField(default=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('organization', 'campus', 'shift_type')

    def __str__(self):
        return f"Campus {self.campus} [{self.shift_type}] — {self.check_in_time}–{self.check_out_time}"


class BiometricDevice(models.Model):
    """
    A biometric attendance machine (face / fingerprint / RFID).
    device_type distinguishes the vendor/protocol so one ingestion layer
    can serve ZKTeco (ADMS) and Foxit FoxFace (face) and future devices.
    """
    DEVICE_TYPE_CHOICES = [
        ('zkteco',  'ZKTeco (fingerprint / RFID)'),
        ('foxface', 'Foxit FoxFace (face)'),
    ]

    objects = OrganizationManager()

    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE,
        null=True, blank=True, related_name='biometric_devices'
    )
    campus = models.ForeignKey(
        'campus.Campus', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='biometric_devices'
    )
    name         = models.CharField(max_length=100)
    device_type  = models.CharField(max_length=20, choices=DEVICE_TYPE_CHOICES, default='zkteco')
    # ip_address / port are only meaningful for local ADMS devices (ZKTeco).
    # FoxFace devices are cloud-pull, so these are optional.
    ip_address   = models.GenericIPAddressField(null=True, blank=True)
    port         = models.PositiveIntegerField(default=4370)
    serial_number = models.CharField(max_length=100, unique=True)
    device_model = models.CharField(max_length=100, blank=True)
    is_active    = models.BooleanField(default=True)
    last_sync    = models.DateTimeField(null=True, blank=True)
    # Live connectivity, mirrored from the vendor platform (FoxFace) by the status
    # sync. None = unknown / never checked. is_active is just an admin on/off toggle.
    is_online    = models.BooleanField(null=True, blank=True, default=None)
    last_status_check = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.serial_number or self.ip_address})"


class BiometricEmployeeMapping(models.Model):
    objects = OrganizationManager()

    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE,
        null=True, blank=True, related_name='biometric_mappings'
    )
    device = models.ForeignKey(
        BiometricDevice, on_delete=models.CASCADE,
        related_name='employee_mappings'
    )
    # Device-side person id (ZKTeco PIN like "5", or FoxFace person_id / employee_code)
    device_user_id   = models.CharField(max_length=50)
    device_user_name = models.CharField(max_length=150, blank=True)
    user             = models.ForeignKey('users.User', on_delete=models.CASCADE, null=True, blank=True, related_name='biometric_mappings')
    teacher          = models.ForeignKey('teachers.Teacher', on_delete=models.SET_NULL, null=True, blank=True, related_name='employee_mappings')
    employee_code    = models.CharField(max_length=50, blank=True)

    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        unique_together = ['device', 'device_user_id']
        ordering = ['device_user_id']

    def __str__(self):
        return f"Device:{self.device_user_id} → {self.employee_code or 'Unmapped'}"

    def save(self, *args, **kwargs):
        # Auto-sync employee_code from User or Teacher profile
        if not self.employee_code:
            if self.user:
                self.employee_code = getattr(self.user, 'employee_code', '')
            elif self.teacher:
                self.employee_code = getattr(self.teacher, 'employee_code', '')
        super().save(*args, **kwargs)
