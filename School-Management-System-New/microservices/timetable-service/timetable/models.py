from django.db import models
from users.managers import OrganizationManager
from django.core.exceptions import ValidationError
from django.utils import timezone


class CentralAuthFieldsMixin(models.Model):
    """
    Phase C9: additive, nullable fields for the central-auth repoint. Same
    shape as C1-C8 — dual-run, the existing `organization` FK is untouched;
    these are new, parallel fields used only by the central-auth code path
    (see timetable_service/dual_auth.py, timetable/views.py).

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


class Subject(CentralAuthFieldsMixin, models.Model):
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    # Phase C9: was missing entirely (the C5-class hazard) — added so the
    # central-auth path (and this model's own `save()`'s `Subject.objects.filter
    # (code=...)` uniqueness-check loop) has a working bypass. Note `save()`'s
    # own uniqueness loop still uses `.objects` (legacy-only call site,
    # untouched — see the central-path override in views.py instead).
    all_objects = models.Manager()
    """
    Subject model for managing school subjects
    """
    name = models.CharField(max_length=100, help_text="Subject name (e.g., Mathematics, English)")
    code = models.CharField(max_length=20, unique=True, blank=True, help_text="Auto-generated subject code")
    description = models.TextField(blank=True, null=True, help_text="Subject description")

    # Campus-specific subjects
    campus = models.ForeignKey(
        'campus.Campus',
        on_delete=models.CASCADE,
        related_name='subjects',
        help_text="Campus this subject belongs to"
    )

    # Organization
    organization = models.ForeignKey(
        'users.Organization',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='subjects'
    )
    
    # Level-specific (optional - some subjects are for specific levels)
    level = models.ForeignKey(
        'classes.Level',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='subjects',
        help_text="Level this subject is for (optional)"
    )
    
    is_active = models.BooleanField(default=True, help_text="Is this subject currently active?")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        # Make subjects unique per campus and level so a subject
        # can be reused across different levels/shifts within the same campus.
        unique_together = ('name', 'campus', 'level')
        ordering = ['name']
        verbose_name = "Subject"
        verbose_name_plural = "Subjects"
    def save(self, *args, **kwargs):
        # Auto-generate code if not provided
        if not self.code:
            # Create code from name (first 3 letters + campus code)
            name_part = ''.join(self.name.split())[:3].upper()
            campus_code = self.campus.campus_code if self.campus else 'XXX'
            base_code = f"{campus_code}-{name_part}"
            
            # Ensure uniqueness
            counter = 1
            self.code = base_code
            while Subject.objects.filter(code=self.code).exists():
                self.code = f"{base_code}{counter}"
                counter += 1

        # Inherit organization from campus if not provided
        if not self.organization and self.campus:
            self.organization = self.campus.organization
            
        super().save(*args, **kwargs)
    
    def __str__(self):
        campus_name = self.campus.campus_name if self.campus else "No Campus"
        return f"{self.name} ({campus_name})"


class ClassTimeTable(CentralAuthFieldsMixin, models.Model):
    """
    Time Table for a specific classroom
    """
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    all_objects = models.Manager()  # unfiltered — for internal/cross-org operations
    DAY_CHOICES = [
        ('monday', 'Monday'),
        ('tuesday', 'Tuesday'),
        ('wednesday', 'Wednesday'),
        ('thursday', 'Thursday'),
        ('friday', 'Friday'),
        ('saturday', 'Saturday'),
    ]
    
    # Classroom
    classroom = models.ForeignKey(
        'classes.ClassRoom',
        on_delete=models.CASCADE,
        related_name='class_timetable_periods',
        help_text="Classroom for this period"
    )
    
    # Organization
    organization = models.ForeignKey(
        'users.Organization', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='class_timetables'
    )
    
    # Subject and Teacher (nullable — slots can be created without assignment)
    subject = models.ForeignKey(
        Subject,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='class_periods',
        help_text="Subject being taught"
    )
    teacher = models.ForeignKey(
        'teachers.Teacher',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='class_teaching_periods',
        help_text="Teacher assigned to this period"
    )
    # Phase C9: teacher/created_by are real FKs to teachers.Teacher/users.User
    # — a CentralAuthUser/central identity can't be assigned to either
    # directly. Separate nullable UUID columns carry the central-auth
    # identity instead.
    central_teacher_id = models.UUIDField(null=True, blank=True, db_index=True)

    # Time Information
    day = models.CharField(max_length=10, choices=DAY_CHOICES, help_text="Day of the week")
    start_time = models.TimeField(help_text="Period start time")
    end_time = models.TimeField(help_text="Period end time")

    # Additional Info
    is_break = models.BooleanField(default=False, help_text="Is this a break period?")
    notes = models.TextField(blank=True, null=True, help_text="Additional notes")

    # Metadata
    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_class_periods',
        help_text="User who created this period"
    )
    central_created_by_id = models.UUIDField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['classroom', 'day', 'start_time'],
                name='unique_class_period'
            ),
        ]
        ordering = ['classroom', 'day', 'start_time']
        verbose_name = "Class Time Table"
        verbose_name_plural = "Class Time Tables"
    
    def clean(self):
        """Validate period data"""
        super().clean()
        
        # Validate time range
        if self.start_time and self.end_time:
            if self.start_time >= self.end_time:
                raise ValidationError("Start time must be before end time")
        
        # Check for overlapping periods for the same classroom
        if self.classroom and self.day and self.start_time and self.end_time:
            overlapping = ClassTimeTable.all_objects.filter(
                classroom=self.classroom,
                day=self.day,
                start_time__lt=self.end_time,
                end_time__gt=self.start_time
            ).exclude(pk=self.pk)

            if overlapping.exists():
                raise ValidationError(
                    f"This classroom already has a period scheduled during this time on {self.get_day_display()}"
                )

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

    def __str__(self):
        subject = self.subject.name if self.subject_id else "Free"
        return f"{self.classroom} - {subject} ({self.get_day_display()} {self.start_time.strftime('%H:%M')})"
    
    @property
    def time_slot(self):
        return f"{self.start_time.strftime('%H:%M')} - {self.end_time.strftime('%H:%M')}"


class TeacherTimeTable(CentralAuthFieldsMixin, models.Model):
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    # Phase C9: was missing entirely (the C5-class hazard, explicitly
    # flagged by this phase's prompt for the double-booking conflict
    # check specifically) — added. `clean()`'s conflict query below now
    # uses this + an explicit tenant filter instead of the blind `.objects`.
    all_objects = models.Manager()
    """
    Time Table for a specific teacher
    """
    DAY_CHOICES = [
        ('monday', 'Monday'),
        ('tuesday', 'Tuesday'),
        ('wednesday', 'Wednesday'),
        ('thursday', 'Thursday'),
        ('friday', 'Friday'),
        ('saturday', 'Saturday'),
    ]
    
    # Teacher
    teacher = models.ForeignKey(
        'teachers.Teacher',
        on_delete=models.CASCADE,
        related_name='teacher_timetable_periods',
        help_text="Teacher for this period"
    )
    central_teacher_id = models.UUIDField(null=True, blank=True, db_index=True)

    # Organization
    organization = models.ForeignKey(
        'users.Organization', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='teacher_timetables'
    )
    
    # Subject and Classroom
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name='teacher_periods',
        help_text="Subject being taught"
    )
    classroom = models.ForeignKey(
        'classes.ClassRoom',
        on_delete=models.CASCADE,
        related_name='teacher_teaching_periods',
        help_text="Classroom where teaching"
    )
    
    # Time Information
    day = models.CharField(max_length=10, choices=DAY_CHOICES, help_text="Day of the week")
    start_time = models.TimeField(help_text="Period start time")
    end_time = models.TimeField(help_text="Period end time")
    
    # Additional Info
    is_break = models.BooleanField(default=False, help_text="Is this a break period?")
    notes = models.TextField(blank=True, null=True, help_text="Additional notes")
    
    # Metadata
    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_teacher_periods',
        help_text="User who created this period"
    )
    central_created_by_id = models.UUIDField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['teacher', 'day', 'start_time'],
                name='unique_teacher_period'
            ),
        ]
        ordering = ['teacher', 'day', 'start_time']
        verbose_name = "Teacher Time Table"
        verbose_name_plural = "Teacher Time Tables"

    def clean(self):
        """Validate period data"""
        super().clean()

        # Validate time range
        if self.start_time and self.end_time:
            if self.start_time >= self.end_time:
                raise ValidationError("Start time must be before end time")

        # Check for teacher conflicts.
        # Phase C9: was `TeacherTimeTable.objects` (OrganizationManager) —
        # blind (queryset.none()) whenever the org context-var isn't
        # populated, which is always true for a central-auth request (see
        # timetable_service/dual_auth.py's module docstring) — silently
        # defeating the whole conflict check on that path. `all_objects`
        # + an explicit tenant_id filter fixes it, scoped to the SAME
        # tenant the row being validated belongs to (self.tenant_id, set
        # by the caller before .full_clean()/.save() — see views.py),
        # never across tenants. Legacy behavior is unchanged: when
        # self.tenant_id is None (every legacy-created row), the tenant
        # filter is skipped entirely and this is byte-identical to the
        # original `TeacherTimeTable.objects.filter(...)` call in intent
        # (all_objects sees the same rows objects would, for a legacy
        # request where the org context-var IS populated) — see the
        # conflict-check proof in docs/PHASE_C9_TIMETABLE_SERVICE_RESULT.md.
        if self.teacher and self.day and self.start_time and self.end_time:
            teacher_conflicts = TeacherTimeTable.all_objects.filter(
                teacher=self.teacher,
                day=self.day,
                start_time__lt=self.end_time,
                end_time__gt=self.start_time
            ).exclude(pk=self.pk)
            if self.tenant_id:
                from django.db.models import Q
                teacher_conflicts = teacher_conflicts.filter(
                    Q(tenant_id=self.tenant_id) | Q(tenant_id__isnull=True)
                )

            if teacher_conflicts.exists():
                raise ValidationError(
                    f"Teacher {self.teacher.full_name} is already assigned to another class during this time"
                )
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

    def __str__(self):
        teacher = self.teacher.full_name if self.teacher_id else "Unassigned"
        subject = self.subject.name if self.subject_id else "Free"
        return f"{teacher} - {subject} ({self.get_day_display()} {self.start_time.strftime('%H:%M')})"
    
    @property
    def time_slot(self):
        return f"{self.start_time.strftime('%H:%M')} - {self.end_time.strftime('%H:%M')}"


class ShiftTiming(CentralAuthFieldsMixin, models.Model):
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    # Phase C9: was missing entirely (the C5-class hazard) — added.
    all_objects = models.Manager()
    """
    Dynamic shift timings for campuses
    """
    SHIFT_CHOICES = [
        ('morning', 'Morning'),
        ('afternoon', 'Afternoon'),
    ]
    
    TIMETABLE_TYPE_CHOICES = [
        ('class', 'Class Timetable'),
        ('teacher', 'Teacher Timetable'),
    ]

    campus = models.ForeignKey(
        'campus.Campus',
        on_delete=models.CASCADE,
        related_name='shift_timings',
        help_text="Campus this timing belongs to"
    )
    
    # Organization
    organization = models.ForeignKey(
        'users.Organization', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='shift_timings'
    )
    shift = models.CharField(max_length=20, choices=SHIFT_CHOICES)
    timetable_type = models.CharField(
        max_length=20, 
        choices=TIMETABLE_TYPE_CHOICES, 
        default='class',
        help_text="Type of timetable (class or teacher)"
    )
    name = models.CharField(max_length=50, help_text="Period name (e.g., Period 1, Break)")
    
    start_time = models.TimeField(help_text="Start time")
    end_time = models.TimeField(help_text="End time")
    
    is_break = models.BooleanField(default=False, help_text="Is this a break?")
    order = models.PositiveIntegerField(default=0, help_text="Ordering for display")
    days = models.JSONField(default=list, blank=True, null=True, help_text="Days this timing applies to (e.g., ['Monday', 'Tuesday']). Empty means all days.")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['campus', 'shift', 'timetable_type', 'order', 'start_time']
        verbose_name = "Shift Timing"
        verbose_name_plural = "Shift Timings"

    def save(self, *args, **kwargs):
        # Inherit organization from campus if not provided
        if not self.organization and self.campus:
            self.organization = self.campus.organization
        super().save(*args, **kwargs)

    def __str__(self):
        days_str = ', '.join(self.days) if self.days else 'All days'
        timetable_label = dict(self.TIMETABLE_TYPE_CHOICES).get(self.timetable_type, self.timetable_type)
        return f"{self.campus.campus_name} ({self.shift} - {timetable_label}) - {self.name}: {self.start_time.strftime('%H:%M')}-{self.end_time.strftime('%H:%M')} [{days_str}]"

