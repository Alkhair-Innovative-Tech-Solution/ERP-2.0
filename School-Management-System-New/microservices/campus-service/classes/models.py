from django.db import models
from users.managers import OrganizationManager
from django.utils.crypto import get_random_string
from django.core.exceptions import ValidationError
from django.db.models import Q
from campus.models import CentralAuthFieldsMixin

# Teacher model assumed in 'teachers' app
TEACHER_MODEL = "teachers.Teacher"

# Shift choices — the school only ever runs Morning and Afternoon shifts.
SHIFT_CHOICES = [
    ('morning', 'Morning'),
    ('afternoon', 'Afternoon'),
    ('both', 'Both'),
]

# ----------------------
class Level(CentralAuthFieldsMixin, models.Model):
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    # Phase C5: unfiltered manager — needed by the central-auth read path
    # (see campus_service/dual_auth.py's central_tenant_qs). Not a schema
    # change (no migration needed — a Manager isn't a field).
    all_objects = models.Manager()
    """
    School levels: Pre-Primary, Primary, Secondary, etc.
    Now includes shift information for better organization.
    """
    name = models.CharField(
        max_length=50, 
        help_text="Enter level name (e.g. Foundation, Primary, Middle)"
    )
    shift = models.CharField(
        max_length=20,
        choices=SHIFT_CHOICES,
        default='morning',
        help_text="Shift for this level"
    )
    code = models.CharField(max_length=25, blank=True, null=True, editable=False)

    # Organization
    organization = models.ForeignKey('users.Organization', on_delete=models.CASCADE, null=True, blank=True, related_name='levels')
    
    # Campus connection - set to null if campus is deleted (data preservation)
    campus = models.ForeignKey(
        'campus.Campus',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='levels',
        help_text="Campus this level belongs to"
    )
    
    # Coordinator assignment stored directly (cross-service — coordinator lives in staff-service DB)
    assigned_coordinator_id = models.PositiveIntegerField(null=True, blank=True)
    assigned_coordinator_name = models.CharField(max_length=255, null=True, blank=True)
    assigned_coordinator_code = models.CharField(max_length=50, null=True, blank=True)
    coordinator_assigned_at = models.DateTimeField(null=True, blank=True)
    # Phase C5: assigned_coordinator_id is a bare int (a staff-service
    # Coordinator PK) — a CentralAuthUser/central identity's id is a UUID,
    # can't go in a PositiveIntegerField. Separate nullable UUID column
    # carries the central-auth identity instead. FLAGGED: assign_coordinator
    # (classes/views.py) only accepts a bare int coordinator_id from the
    # client payload today — no central UUID is supplied through this
    # endpoint, so this column is schema-only/unpopulated in this phase
    # (see docs/PHASE_C5_CAMPUS_SERVICE_RESULT.md), same class of gap as
    # C4's SubjectTeacherAssignmentCreateSerializer.teacher_id.
    central_assigned_coordinator_id = models.UUIDField(null=True, blank=True, db_index=True)

    def save(self, *args, **kwargs):
        # Detect name or campus change to update child grades
        is_new = self.pk is None
        name_changed = False
        if not is_new:
            old_obj = Level.objects.get(pk=self.pk)
            if old_obj.name != self.name or old_obj.campus != self.campus:
                name_changed = True

        if not self.code:
            if self.campus and self.campus.campus_code:
                campus_code = self.campus.campus_code
                shift_code = (self.shift or 'morning')[0].upper()
                
                # Use a loop to find the next available level number
                level_num_val = Level.objects.filter(campus=self.campus).count() + 1
                
                while True:
                    proposed_code = f"{campus_code}-L{level_num_val}-{shift_code}"
                    if not Level.objects.filter(code=proposed_code, campus=self.campus).exists():
                        self.code = proposed_code
                        break
                    level_num_val += 1

        super().save(*args, **kwargs)

        # If name or campus changed, update all child grades to reflect new code structure
        if name_changed:
            for grade in self.grade_set.all():
                grade.code = None # Force regeneration
                grade.save()

    class Meta:
        unique_together = ("campus", "name", "shift")
    
    def __str__(self):
        campus_name = self.campus.campus_name if self.campus else "No Campus"
        return f"{self.name}-{self.shift.title()} ({campus_name})"
    
    @property
    def coordinator(self):
        """Return a lightweight object representing the assigned coordinator (cross-service)."""
        if self.assigned_coordinator_id:
            class _Coord:
                def __init__(self, cid, name):
                    self.id = cid
                    self.full_name = name
                    self.employee_code = None
            return _Coord(self.assigned_coordinator_id, self.assigned_coordinator_name or "")
        # Fallback: try local coordinator table (may be empty in cross-service setups)
        try:
            direct = self.coordinator_set.first()
            if direct:
                return direct
        except Exception:
            pass
        try:
            return self.assigned_coordinators.first()
        except Exception:
            return None

    @property
    def coordinator_name(self):
        """Get coordinator name for display."""
        if self.assigned_coordinator_name:
            return self.assigned_coordinator_name
        # Fallback to local coordinator table
        coord = self.coordinator
        if coord and hasattr(coord, 'full_name'):
            return coord.full_name
        return None

# ----------------------
class Grade(CentralAuthFieldsMixin, models.Model):
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    # Phase C5: unfiltered manager — needed by the central-auth read path
    # (see campus_service/dual_auth.py's central_tenant_qs). Not a schema
    # change (no migration needed — a Manager isn't a field).
    all_objects = models.Manager()
    """
    Top-level grade (e.g., Grade 1, Grade 2)
    """
    name = models.CharField(max_length=50)
    code = models.CharField(max_length=25, blank=True, null=True, editable=False)
    order = models.PositiveIntegerField(default=0, help_text="Order for sorting (lower numbers first)")

    # Organization
    organization = models.ForeignKey('users.Organization', on_delete=models.CASCADE, null=True, blank=True, related_name='grades')
    
    # Shift information (synced from level)
    shift = models.CharField(
        max_length=20,
        choices=SHIFT_CHOICES,
        default='morning',
        help_text="Shift for this grade"
    )
    
    # Level connection
    level = models.ForeignKey(
        Level,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='grade_set',
        help_text="Level this grade belongs to"
    )
    
    campus = models.ForeignKey(
        'campus.Campus',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='campus_grades'
    )

    def save(self, *args, **kwargs):
        """
        Auto-generate a human-readable grade code.
        Supports custom names and moving between levels.
        """
        # Sync shift and campus from level if available
        if self.level:
            if self.level.shift:
                self.shift = self.level.shift
            if self.level.campus:
                self.campus = self.level.campus

        # Detect if we need to regenerate code (new object or level changed)
        force_regen = False
        if self.pk:
            old_obj = Grade.objects.get(pk=self.pk)
            if old_obj.level != self.level or old_obj.name != self.name:
                force_regen = True

        if not self.code or force_regen:
            if self.level and self.level.code:
                level_code = self.level.code  # e.g. C04-L2-M

                # Normalize the name for mapping / parsing
                raw_name = (self.name or "").strip()
                normalized = raw_name.lower()

                # Explicit mappings for common names
                grade_mapping = {
                    'nursery': 'N',
                    'kg-i': 'KG1',
                    'kg 1': 'KG1',
                    'kg-i.': 'KG1',
                    'kg-ii': 'KG2',
                    'kg 2': 'KG2',
                    'special class': 'SC',
                }

                grade_code = None

                # 1) Try direct mapping first
                key = normalized.replace('_', ' ').replace('-', ' ').replace('  ', ' ')
                key = ' '.join(key.split())
                grade_code = grade_mapping.get(key)

                # 2) If it's a "Grade X" style name
                if grade_code is None and "grade" in normalized:
                    digits = "".join(ch for ch in normalized if ch.isdigit())
                    if digits:
                        grade_code = f"G{digits}"
                    else:
                        # Try Roman numerals
                        cleaned = normalized.replace('-', ' ')
                        parts = cleaned.split()
                        roman_val = None
                        for p in parts:
                            roman_map = {'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10}
                            if p in roman_map:
                                roman_val = roman_map[p]
                                break
                        if roman_val:
                            grade_code = f"G{roman_val}"

                # 3) Fallback for custom names: Sanitize and use first 4 chars
                if grade_code is None:
                    sanitized = "".join(ch for ch in raw_name if ch.isalnum()).upper()
                    grade_code = sanitized[:4] or "GRD"

                self.code = f"{level_code}-{grade_code}"

                # Uniqueness check for code within same campus
                orig_code = self.code
                count = 1
                query = Grade.objects.filter(code=self.code, campus=self.campus)
                if self.pk:
                    query = query.exclude(pk=self.pk)

                while query.exists():
                    self.code = f"{orig_code}-{count}"
                    query = Grade.objects.filter(code=self.code, campus=self.campus)
                    if self.pk:
                        query = query.exclude(pk=self.pk)
                    count += 1
            else:
                self.code = None

        # Keep `order` in sync with the code we just resolved, so grade ranking
        # (progression KPI, sorted grade lists) works without anyone populating
        # it by hand. Derived from structural codes — see classes.grade_ordering.
        from classes.grade_ordering import grade_order_value
        self.order = grade_order_value(self.code, self.level.code if self.level else None)

        super().save(*args, **kwargs)

    class Meta:
        unique_together = ("level", "name", "shift")
    
    def __str__(self):
        campus_name = self.level.campus.campus_name if self.level and self.level.campus else "No Campus"
        shift_display = self.shift.title() if self.shift else "N/A"
        return f"{self.name} - {shift_display} ({campus_name})"

# ----------------------
class ClassRoom(CentralAuthFieldsMixin, models.Model):
    objects = OrganizationManager()
    all_objects = models.Manager()  # unfiltered — for signals/internal use
    """
    Represents a specific class (Grade + Section)
    Example: "Grade 1 - A"
    """
    SECTION_CHOICES = [(c, c) for c in ("A", "B", "C", "D", "E")]

    organization = models.ForeignKey('users.Organization', on_delete=models.CASCADE, null=True, blank=True, related_name='classrooms')
    grade = models.ForeignKey(Grade, related_name="classrooms", on_delete=models.CASCADE)
    section = models.CharField(max_length=3, choices=SECTION_CHOICES)
    
    # Shift information
    shift = models.CharField(
        max_length=20,
        choices=SHIFT_CHOICES,
        default='morning',
        help_text="Shift for this classroom"
    )
    
    # Allow a teacher to be class teacher of multiple classrooms (e.g., both shifts)
    class_teacher = models.ForeignKey(
        TEACHER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='classroom_set',
        help_text="Class teacher for this classroom"
    )
    # Phase C5: real FK to teachers.Teacher — a CentralAuthUser/central
    # identity can't be assigned to it directly. FLAGGED: assign_teacher
    # (classes/views.py) resolves the teacher via a bare int teacher_id from
    # the client payload (Teacher.objects.get(id=teacher_id)), same as
    # SubjectTeacherAssignment in C4 — no central UUID for THAT teacher is
    # available through this endpoint, so this column is schema-only/
    # unpopulated in this phase (see docs/PHASE_C5_CAMPUS_SERVICE_RESULT.md).
    central_class_teacher_id = models.UUIDField(null=True, blank=True, db_index=True)
    capacity = models.PositiveIntegerField(default=30)
    code = models.CharField(max_length=30, editable=False)

    # Assignment tracking
    assigned_by = models.ForeignKey(
        'users.User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='classroom_assignments_made',
        help_text="User who assigned the class teacher"
    )
    # Phase C5: real FK to users.User — assigned_by IS request.user (the
    # person making the assignment), so unlike class_teacher above, this one
    # CAN be populated correctly on the central-auth path: the acting
    # CentralAuthUser's own id.
    central_assigned_by_id = models.UUIDField(null=True, blank=True, db_index=True)
    assigned_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("grade", "section", "shift")
        ordering = ("grade__name", "section", "shift")

    def __str__(self):
        shift_display = self.shift.title() if self.shift else "N/A"
        campus_name = self.grade.level.campus.campus_name if self.grade and self.grade.level and self.grade.level.campus else "No Campus"
        return f"{self.grade.name} - {self.section} ({shift_display}) [{campus_name}]"

    def get_display_code_components(self):
        # Use grade code if available, otherwise generate from name
        if self.grade and self.grade.code:
            grade_code = self.grade.code
        else:
            grade_code = "".join(self.grade.name.split()).upper()
        return grade_code, self.section

    def get_expected_coordinator(self):
        """Get the coordinator that should be assigned for this classroom"""
        if self.grade and self.grade.level and self.campus:
            from coordinator.models import Coordinator
            return Coordinator.objects.filter(
                level=self.grade.level,
                campus=self.campus,
                is_currently_active=True
            ).first()
        return None

    def save(self, *args, **kwargs):
        if not self.code and self.grade:
            grade_code = self.grade.code
            section = self.section
            shift_code = self.shift[0].upper() if self.shift else 'M'
            
            # Initial proposed code
            proposed_code = f"{grade_code}-{section}-{shift_code}"
            
            # Check for uniqueness within same campus
            campus = self.grade.level.campus if self.grade and self.grade.level else None
            if ClassRoom.objects.filter(code=proposed_code, grade__level__campus=campus).exclude(pk=self.pk).exists():
                count = 1
                while ClassRoom.objects.filter(code=f"{proposed_code}{count}", grade__level__campus=campus).exclude(pk=self.pk).exists():
                    count += 1
                self.code = f"{proposed_code}{count}"
            else:
                self.code = proposed_code
                
        super().save(*args, **kwargs)
    
    # Properties for easy access
    @property
    def level(self):
        return self.grade.level if self.grade else None
    
    @property
    def campus(self):
        return self.grade.level.campus if self.grade and self.grade.level else None
    
    def get_students_for_teacher(self, teacher):
        """
        Get students assigned to this classroom for a specific teacher
        Only returns students from the same campus as the teacher
        """
        if not teacher or not teacher.current_campus:
            return self.students.none()
        
        return self.students.filter(
            campus=teacher.current_campus,
            is_draft=False
        )
    
    def get_available_students_for_assignment(self):
        """
        Get students from same campus and grade who can be assigned to this classroom
        """
        if not self.campus or not self.grade:
            return Student.objects.none()
        
        from students.models import Student
        
        # Normalize grade names for matching
        grade_name_variations = [
            self.grade.name,
            self.grade.name.replace('-', ' '),  # Grade-4 -> Grade 4
            self.grade.name.replace(' ', '-'),  # Grade 4 -> Grade-4
        ]
        
        grade_query = Q()
        for grade_var in grade_name_variations:
            grade_query |= Q(current_grade__icontains=grade_var)
        
        return Student.objects.filter(
            campus=self.campus,
            is_draft=False
        ).filter(grade_query).filter(
            Q(classroom__isnull=True) | Q(classroom=self)
        )