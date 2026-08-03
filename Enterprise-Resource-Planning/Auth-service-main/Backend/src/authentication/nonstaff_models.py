"""
NonStaffIdentity model for Auth Service.

Identity for people who log in but are not employees — e.g. SMS students.
Mirrors SuperAdmin's existing shape (superadmin_models.py): a self-contained
identity with no department/branch/designation/employee_code, so it can reuse
UserCredentials/JWT machinery unchanged. See
docs/PHASE_A2_STUDENT_IDENTITY_RESULT.md for the design rationale — this is
IDENTITY ONLY (login + role + tenant); profile data (roll number, class,
family info, ...) stays in the owning service (e.g. SMS), linked by this
identity's id.
"""
import uuid
from django.db import models
from employees.models import Tenant
from employees.utils import SoftDeleteModel


class NonStaffIdentity(SoftDeleteModel):
    """
    Lightweight, non-employee identity. Unlike Employee, `tenant` is required
    directly (there is no EmployeeAssignment/Organization chain to derive it
    from), and there is deliberately no department/branch/designation/
    employee_code — those are HR concepts that don't apply here.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        related_name='non_staff_identities',
        help_text="Tenant this identity belongs to (required — no HR chain to derive it from)"
    )

    PERSON_TYPE_CHOICES = [
        ('student', 'Student'),
    ]
    person_type = models.CharField(
        max_length=20,
        choices=PERSON_TYPE_CHOICES,
        default='student',
        help_text="What kind of non-staff identity this is"
    )

    identity_code = models.CharField(
        max_length=50,
        unique=True,
        help_text="Login identifier, analogous to Employee.employee_code / SuperAdmin.superadmin_code"
    )

    # SMS migration (Phase B2): original SMS users_user.id for this identity,
    # when created by importing an SMS student. Null for any non-imported
    # identity. Unique so re-running the importer updates the same row
    # instead of creating a duplicate. Mirrors Employee.legacy_user_id (B1).
    legacy_user_id = models.BigIntegerField(
        null=True, blank=True, unique=True, db_index=True,
        help_text="Original SMS users_user.id (Phase B import key), null if not imported from SMS"
    )

    full_name = models.CharField(max_length=200)
    email = models.EmailField(blank=True, null=True)

    role = models.CharField(
        max_length=50,
        blank=True,
        help_text=(
            "Free-form role label (e.g. SMS's 'student'). No role/permission "
            "catalog wiring yet — deferred to the phase that builds the actual "
            "login flow. See docs/PHASE_A2_STUDENT_IDENTITY_RESULT.md."
        )
    )

    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Non-Staff Identity"
        verbose_name_plural = "Non-Staff Identities"
        db_table = "auth_non_staff_identity"

    def __str__(self):
        return f"{self.full_name} ({self.identity_code})"
