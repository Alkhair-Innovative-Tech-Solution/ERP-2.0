"""
Employee models for the Auth Service.

This module contains the core Employee model with dual identifier system:
- employee_id: Simple organization-wide ID (IAK-0001) - AUTO-GENERATED
- employee_code: Detailed department-specific code (C06-M-24-T-0001) - AUTO-GENERATED

All models inherit from SoftDeleteModel for soft delete functionality.
"""
import uuid, re
from django.db import models
from django.core.exceptions import ValidationError
# ObjectDoesNotExist
from .utils import SoftDeleteModel
from django.contrib.auth.models import AbstractUser, BaseUserManager

# class UserManager(BaseUserManager):
#     def create_user(self, email, password=None, **extra_fields):
#         if not email:
#             raise ValueError('The Email field must be set')
#         email = self.normalize_email(email)
#         user = self.model(email=email, **extra_fields)
#         user.set_password(password)
#         user.save(using=self._db)
#         return user

#     def create_superuser(self, email, password=None, **extra_fields):
#         extra_fields.setdefault('is_staff', True)
#         extra_fields.setdefault('is_superuser', True)
#         return self.create_user(email, password, **extra_fields)

# class User(AbstractUser):
#     username = None
#     email = models.EmailField(unique=True)
    
#     # Link to Employee
#     employee = models.OneToOneField(
#         'Employee', 
#         on_delete=models.SET_NULL, 
#         null=True, 
#         blank=True,
#         related_name='user_account'
#     )

#     USERNAME_FIELD = 'email'
#     REQUIRED_FIELDS = []

#     objects = UserManager()

#     def __str__(self):
#         return self.email

class Organization(SoftDeleteModel):
    """
    The root entity (NGO or Company). 
    Centralizes global settings and basic info.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, help_text="Organization Name (e.g., Al-Khidmat Foundation)")
    org_code = models.CharField(max_length=10, unique=True, help_text="Short code for the organization (e.g., AKF)")
    website = models.URLField(blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    logo_url = models.URLField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    
    class Meta:
        verbose_name = "Organization"
        verbose_name_plural = "Organizations"
    def __str__(self):
        return f"{self.name} ({self.org_code})"


class Institution(SoftDeleteModel):
    """
    Specific entities under the Organization (Schools, Hospitals, Kitchens).
    Replaces AcademicInstitutionInformation with a more generic structure.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='institutions')
    inst_code = models.CharField(max_length=20, unique=True, help_text="Unique code (e.g., AIT01, AMC01)")
    name = models.CharField(max_length=255)
    
    INST_TYPE_CHOICES = [
        ('educational', 'Educational (School, College, University)'),
        ('healthcare', 'Healthcare (Hospital, Clinic, Lab)'),
        ('social_welfare', 'Social Welfare (Kitchen, Shelter, Center)'),
        ('administrative', 'Administrative (Office, branch)'),
        ('technical', 'Technical / Vocational'),
        ('operational', 'Operational / Project Site'),
        ('other', 'Other'),
    ]
    inst_type = models.CharField(max_length=30, choices=INST_TYPE_CHOICES)

    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    contact_number = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        verbose_name = "Institution"
        verbose_name_plural = "Institutions"

    def __str__(self):
        return f"{self.name} ({self.inst_code})"
    def branch_count(self):
        return self.branches.filter(is_deleted=False).count()

    def employee_count(self):
        from .models import EmployeeAssignment
        return EmployeeAssignment.objects.filter(
            department__branch__institution=self, is_deleted=False
        ).values('employee').distinct().count()

class Branch(SoftDeleteModel):
    """
    Physical locations/branches under an Institution.
    For Schools: Each campus is a branch
    For Hospitals: Each hospital location is a branch
    For Kitchens: Each kitchen location is a branch
    
    This replaces the need for each campus to be a separate institution.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    institution = models.ForeignKey(
        Institution, 
        on_delete=models.CASCADE, 
        related_name='branches',
        help_text="Parent institution this branch belongs to"
    )
    
    # ========================================
    # IDENTIFIERS
    # ========================================
    branch_id = models.CharField(
        max_length=50, 
        unique=True, 
        editable=False,
        help_text="Auto-generated: BRANCH-001, BRANCH-002, etc."
    )
    branch_code = models.CharField(
        max_length=20, 
        unique=True,  # MUST be globally unique across all branches
        help_text="Unique code for employee code generation (e.g., C01, C02, H01)"
    )
    branch_name = models.CharField(max_length=255)
    
    # ========================================
    # COMMON FIELDS (All Branches)
    # ========================================
    
    # Location
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    district = models.CharField(max_length=100, blank=True, null=True)
    postal_code = models.CharField(max_length=20, blank=True, null=True)
    
    # Contact
    contact_number = models.CharField(max_length=20, blank=True, null=True)
    secondary_contact = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    
    # Branch Head/Manager
    branch_head_name = models.CharField(max_length=255, blank=True, null=True)
    branch_head_contact = models.CharField(max_length=50, blank=True, null=True)
    branch_head_email = models.EmailField(blank=True, null=True)
    
    # Establishment
    established_year = models.PositiveIntegerField(
        blank=True, 
        null=True,
        help_text="Year this branch was established (common field)"
    )
    registration_number = models.CharField(
        max_length=100, 
        blank=True, 
        null=True,
        help_text="Official registration/license number"
    )
    
    # Status
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('closed', 'Closed'),
        ('under_construction', 'Under Construction'),
    ]
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='active'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Branch"
        verbose_name_plural = "Branches"
        ordering = ['branch_code']
        indexes = [
            models.Index(fields=['branch_code']),
        ]
    
    def save(self, *args, **kwargs):
        # Auto-generate branch_id if not provided
        if not self.branch_id:
            last = Branch.all_objects.all().order_by('branch_id').last()
            if last and last.branch_id:
                try:
                    num_part = last.branch_id.split('-')[-1]
                    new_num = int(num_part) + 1
                except (ValueError, IndexError):
                    new_num = 1
            else:
                new_num = 1
            self.branch_id = f"BRANCH-{new_num:03d}"
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.branch_name} ({self.branch_code})"
        
class Department(SoftDeleteModel):
    """
    Departments can be Global (linked to Org) or Local (linked to Institution).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey('Branch', on_delete=models.CASCADE, null=True, blank=True, related_name='departments')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='global_departments', null=True, blank=True)
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, null=True, blank=True, related_name='local_departments')
    
    dept_code = models.CharField(max_length=10, help_text="e.g., HR, FIN, ACAD")
    dept_name = models.CharField(max_length=200)
    
    description = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name = "Department"
        verbose_name_plural = "Departments"
        unique_together = [
            ['institution', 'dept_code'],
            ['organization', 'dept_code'],
            ['branch', 'dept_code']
        ]

    def clean(self):
        from django.core.exceptions import ValidationError
        parents = [self.branch, self.institution, self.organization]
        set_parents = [p for p in parents if p is not None]
        if len(set_parents) != 1:
            raise ValidationError(
                "Department must have exactly one parent: branch, institution, or organization."
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def is_global(self):
        return self.branch is None and self.institution is None and self.organization is not None

    @property
    def department_id(self):
        return str(self.id)

    def __str__(self):
        if self.branch:
            scope = self.branch.branch_code
        elif self.institution:
            scope = self.institution.inst_code
        else:
            scope = "Global"
        return f"{self.dept_name} [{scope}]"

class Designation(SoftDeleteModel):
    """
    Position types within a Department.
    Includes a JSON Schema for role-specific dynamic data.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='designations')
    
    position_name = models.CharField(max_length=100, help_text="e.g., Teacher, Surgeon, Manager")
    position_code = models.CharField(max_length=10, help_text="Short code for ID generation (e.g., T, D, M)")
    description = models.TextField(blank=True, null=True)
    
    # 🆕 DYNAMIC SCHEMA
    # Defines what extra data is required for this specific designation
    # format: [{"name": "field_id", "label": "Label", "type": "text|number|date|choice|entity_link", "target": "service.Model"}]
    attribute_schema = models.JSONField(
        default=list, 
        blank=True, 
        help_text="JSON schema for designation-specific attributes (Google Form style)"
    )

    class Meta:
        verbose_name = "Designation"
        verbose_name_plural = "Designations"
        unique_together = [['department', 'position_code']]

    def __str__(self):
        if self.department.branch:
            scope = self.department.branch.branch_code
        elif self.department.institution:
            scope = self.department.institution.inst_code
        elif self.department.is_global:
            scope = "Global"
        else:    
            scope = "Unknown"

        return f"{self.position_name} ({self.department.dept_name} - {scope})"

class Employee(SoftDeleteModel):
    """
    Central Employee Identity. Stores ALL common personal & HR data.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # NGO-wide ID (IAK-0001 -> IAK-10000)
    employee_id = models.CharField(
        max_length=20, unique=True, editable=False, blank=True, db_index=True,
        help_text="Central Organization ID"
    )
    
    # Derived from Primary Assignment
    employee_code = models.CharField(
        max_length=50, unique=True, editable=False, blank=True, null=True, db_index=True,
        help_text="Generated from Primary Assignment"
    )
    
    organization = models.ForeignKey(Organization, on_delete=models.PROTECT, related_name='employees', null=True, blank=True)
    
    # Core Personal Data
    full_name = models.CharField(max_length=200)
    cnic = models.CharField(max_length=15, unique=True)
    personal_phone = models.CharField(max_length=20, blank=True, null=True)
    personal_email = models.EmailField(blank=True, null=True) # REMOVED unique=True
    resume_url = models.URLField(blank=True, null=True, help_text="Reference to File Service")
    dob = models.DateField()
    
    GENDER_CHOICES = [('male', 'Male'), ('female', 'Female'), ('other', 'Other')]
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    
    MARITAL_STATUS_CHOICES = [
        ('single', 'Single'), ('married', 'Married'), 
        ('divorced', 'Divorced'), ('widowed', 'Widowed')
    ]
    marital_status = models.CharField(max_length=20, choices=MARITAL_STATUS_CHOICES, blank=True, null=True)
    nationality = models.CharField(max_length=100, default='Pakistani')
    religion = models.CharField(max_length=100, blank=True, null=True)
    
    EMPLOYMENT_TYPE_CHOICES = [
        ('full_time', 'Full-time'),
        ('part_time', 'Part-time'),
        ('contract', 'Contract'),
        ('intern', 'Intern')
    ]
    employment_type = models.CharField(max_length=20, choices=EMPLOYMENT_TYPE_CHOICES, default='full_time')
    
    # Address Details
    residential_address = models.TextField(blank=True, null=True)
    permanent_address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)

    # Emergency Contact
    emergency_contact_name = models.CharField(max_length=200, blank=True, null=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True, null=True)

    # Organization Contact
    org_email = models.EmailField(blank=True, null=True, unique=True, help_text="Official Organization Email")
    org_phone = models.CharField(max_length=20, blank=True, null=True, help_text="Official Mobile/Extension")
    
    # Bank Information
    bank_name = models.CharField(max_length=200, blank=True, null=True)
    account_number = models.CharField(max_length=50, blank=True, null=True)
    
    # Education & Work Experience (Comprehensive HR History)
    education_history = models.JSONField(default=list, blank=True, help_text="[{degree, institute, passingYear, grade}]")
    work_experience = models.JSONField(default=list, blank=True, help_text="[{employer, jobTitle, startDate, endDate, responsibilities}]")
    
    is_active = models.BooleanField(default=True)

    @property
    def email(self):
        return self.org_email or self.personal_email or ""

    @property
    def phone(self):
        return self.org_phone or self.personal_phone or ""

    @property
    def primary_assignment(self):
        return self.assignments.filter(is_primary=True).first()

    @property
    def department(self):
        pa = self.primary_assignment
        return pa.department if pa else None

    @property
    def designation(self):
        pa = self.primary_assignment
        return pa.designation if pa else None

    class Meta:
        verbose_name = "Employee"
        verbose_name_plural = "Employees"

    def save(self, *args, **kwargs):
        if not self.employee_id:
            last = Employee.all_objects.all().order_by('employee_id').last()
            num = (int(last.employee_id.split('-')[-1]) + 1) if last and last.employee_id else 1
            padding = 4 if num < 10000 else len(str(num))
            prefix = self.organization.org_code if self.organization else "IAK"
            self.employee_id = f"{prefix}-{num:0{padding}d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.full_name} ({self.employee_id})"

class EmployeeAssignment(SoftDeleteModel):
    """
    Handles multiple roles for an Employee across Institutions/Departments.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='assignments')
    
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name='assignments')
    designation = models.ForeignKey(Designation, on_delete=models.PROTECT, related_name='assignments')
    
    joining_date = models.DateField()
    is_primary = models.BooleanField(default=True, help_text="Determines the central Employee Code")
    is_active = models.BooleanField(default=True)
    
    SHIFT_CHOICES = [
        ('morning', 'Morning'), ('afternoon', 'Afternoon'), ('night', 'Night'),
        ('general', 'General/Office'), ('hourly', 'Hourly Base'), ('both', 'Both (M+A)')
    ]
    shift = models.CharField(max_length=20, choices=SHIFT_CHOICES, default='general')
    
    # Dynamic Role Data (Designation specific)
    role_data = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "Employee Assignment"
        verbose_name_plural = "Employee Assignments"
        unique_together = [['employee', 'department', 'designation']]

    def save(self, *args, **kwargs):
        if self.is_primary:
            EmployeeAssignment.objects.filter(employee=self.employee).exclude(pk=self.pk).update(is_primary=False)
        
        super().save(*args, **kwargs)
        
        if self.is_primary:
            # Prefix logic: derive branch from designation chain
            dept = self.designation.department
            if dept.is_global:
                prefix = dept.dept_code
            elif dept.branch_id:
                prefix = dept.branch.branch_code
            elif dept.institution_id:
                prefix = dept.institution.inst_code
            else:
                prefix = dept.organization.org_code if dept.organization_id else dept.dept_code

            shift_code = self.shift[0].upper() if self.shift != 'general' else 'G'
            year = str(self.joining_date.year)[-2:]
            role = self.designation.position_code
            seq = self.employee.employee_id.split('-')[-1]
            
            new_code = f"{prefix}-{shift_code}-{year}-{role}-{seq}"
            old_code = self.employee.employee_code
            
            if old_code != new_code:
                self.employee.employee_code = new_code
                self.employee.save(update_fields=['employee_code'])
                
                # Trigger Email Notification
                from .notifications import send_employee_code_notification
                send_employee_code_notification(self.employee, new_code)
                
                # Store new code in instance for Admin feedback
                self._new_employee_code = new_code

    def __str__(self):
        dept = self.designation.department
        if dept.branch_id:
            scope = dept.branch.branch_code
        elif dept.institution_id:
            scope = dept.institution.inst_code
        else:
            scope = "Global"
        return f"{self.employee.full_name} - {self.designation.position_name} ({scope})"