import uuid
from django.db import models
from users.managers import OrganizationManager


class CentralAuthFieldsMixin(models.Model):
    """
    Phase C4: additive, nullable fields for the central-auth repoint. Same
    shape as C1/C2/C3 — dual-run, the existing `organization` FK and
    OrganizationManager-based `objects` manager on each model are untouched;
    these are new, parallel fields used only by the central-auth code path
    (see subject_service/dual_auth.py, subjects/views.py, assignments/views.py).

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
    objects = OrganizationManager()
    all_objects = models.Manager()

    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE,
        null=True, blank=True, related_name='subjects'
    )

    name = models.CharField(max_length=255)
    subject_code = models.CharField(max_length=30, blank=True, null=True)
    description = models.TextField(blank=True, null=True)

    # School hierarchy — IDs only (no cross-service DB FK)
    grade_id = models.IntegerField(null=True, blank=True)
    grade_name = models.CharField(max_length=100, blank=True, null=True)
    campus_id = models.IntegerField(null=True, blank=True)
    campus_name = models.CharField(max_length=255, blank=True, null=True)

    is_active = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        grade = f" ({self.grade_name})" if self.grade_name else ""
        return f"{self.name}{grade}"


class SubjectTeacherAssignment(CentralAuthFieldsMixin, models.Model):
    objects = OrganizationManager()
    all_objects = models.Manager()

    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE,
        null=True, blank=True, related_name='subject_teacher_assignments'
    )
    subject = models.ForeignKey(
        Subject, on_delete=models.CASCADE, related_name='teacher_assignments'
    )

    # Teacher — ID from staff-service JWT, name denormalized.
    # Phase C4: teacher_id is a bare int (a staff-service Teacher PK) — a
    # CentralAuthUser's id is a UUID, can't go in an IntegerField. Widened
    # to nullable; central_teacher_id (the token's own UUID) carries the
    # central-auth identity instead, populated on the central-auth path.
    teacher_id = models.IntegerField(null=True, blank=True)
    teacher_name = models.CharField(max_length=255, blank=True, null=True)
    teacher_email = models.EmailField(blank=True, null=True)
    central_teacher_id = models.UUIDField(null=True, blank=True, db_index=True)

    # Classroom — ID from campus-service, code denormalized. Entity ref,
    # not a person — left as a bare int (see field audit in
    # docs/PHASE_C4_SUBJECT_SERVICE_RESULT.md).
    classroom_id = models.IntegerField(null=True, blank=True)
    classroom_code = models.CharField(max_length=50, blank=True, null=True)
    classroom_label = models.CharField(max_length=100, blank=True, null=True)  # "Grade 7 - A (Morning)"

    academic_year = models.CharField(max_length=10, default='2025-26')
    is_active = models.BooleanField(default=True)
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by_id = models.IntegerField(null=True, blank=True)
    central_assigned_by_id = models.UUIDField(null=True, blank=True, db_index=True)

    class Meta:
        unique_together = ['subject', 'teacher_id', 'classroom_id', 'academic_year']
        ordering = ['-assigned_at']
        constraints = [
            # Phase C4: teacher_id is now nullable — Postgres treats each
            # NULL as distinct, so unique_together alone would let the SAME
            # central-auth teacher be double-assigned (both rows have
            # teacher_id=NULL). Same pattern as C1's StudentContentProgress.
            models.UniqueConstraint(
                fields=['subject', 'central_teacher_id', 'classroom_id', 'academic_year'],
                condition=models.Q(central_teacher_id__isnull=False),
                name='unique_subj_central_teacher_classroom_year',
            ),
        ]

    def __str__(self):
        return f"{self.subject.name} → {self.teacher_name} ({self.classroom_label})"
