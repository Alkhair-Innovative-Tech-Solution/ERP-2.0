import uuid
from django.db import models # type: ignore
from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
) # type: ignore


class Branch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=10, unique=True, help_text="Short code: PH, NG, GS")
    name = models.CharField(max_length=100)
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, default="Karachi")
    contact_phone = models.CharField(max_length=20, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.code})"

    class Meta:
        verbose_name_plural = "Branches"
        ordering = ["name"]


class UserManager(BaseUserManager):
    def create_user(self, full_name, cnic, email, phone, password=None, role="student"):
        if not email:
            raise ValueError("Users must have an email address")

        user = self.model(
            full_name=full_name,
            cnic=cnic,
            email=self.normalize_email(email),
            phone=phone,
            role=role,
        )

        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, full_name, cnic, email, phone, password=None):
        user = self.create_user(full_name, cnic, email, phone, password, role="admin")
        user.is_staff = True
        user.is_admin = True
        user.is_superuser = True
        user.save(using=self._db)
        return user


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ("admin", "Admin"),
        ("teacher", "Teacher"),
        ("student", "Student"),
        ("coordinator", "Coordinator"),
        ("account_officer", "Account Officer"),
        ("lead", "Lead"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.CharField(max_length=255)
    cnic = models.CharField(max_length=15, null=True, blank=True)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=15, null=True, blank=True)
    password = models.CharField(max_length=255)
    last_login = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="student")
    created_at = models.DateTimeField(auto_now_add=True)

    # 🔹 Branch Assignment (nullable for Admin who can access all branches)
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')

    # 🔹 Multi-Tenancy (Organization & Campus from org-service)
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    campus_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Campus")

    # 🔹 Permission fields
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    
    # Soft Delete Fields
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    is_admin = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)

    # Force password change flag
    must_change_password = models.BooleanField(default=False)

    # 🔹 Granular Feature Access (JSON toggle per feature)
    features_access = models.JSONField(default=dict, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name", "cnic", "phone"]

    def __str__(self):   
        return self.full_name
    class Meta:
        verbose_name_plural = "Users"

    def save(self, *args, **kwargs):
        # Automate hashing if password is not already hashed
        if self.password and not self.password.startswith(('pbkdf2_sha256$', 'bcrypt$', 'argon2$')):
            self.set_password(self.password)
        super().save(*args, **kwargs)

    @property
    def student_profile(self):
        return getattr(self, 'student', None)

    @property
    def student_id(self):
        return self.student_profile.student_id if self.student_profile else ""

    @property
    def father_name(self):
        if not self.student_profile: return ""
        try:
            return self.student_profile.guardian_info.father_name if self.student_profile.guardian_info else ""
        except Exception:
            return ""

    @property
    def address(self):
        if not self.student_profile: return ""
        try:
            return self.student_profile.residential_info.address if self.student_profile.residential_info else ""
        except Exception:
            return ""

    @property
    def whatsapp_number(self):
        return self.student_profile.whatsapp_number if self.student_profile else ""

    @property
    def gender(self):
        return self.student_profile.gender if self.student_profile else ""

    @property
    def test_score(self):
        return self.student_profile.test_score if self.student_profile else 0

    @property
    def has_paid_deposit(self):
        return self.student_profile.has_paid_deposit if self.student_profile else False

    @property
    def level(self):
        return self.student_profile.level if self.student_profile else ""

    @property
    def batch(self):
        return self.student_profile.batch if self.student_profile else ""

    @property
    def specialization(self):
        return self.student_profile.specialization if self.student_profile else ""

    @property
    def date_of_birth(self):
        return self.student_profile.date_of_birth if self.student_profile else None

class Student(models.Model):
    STATUS_CHOICES = [
        ("initial", "Initial"),
        ("pending_interview", "Pending Interview"),
        ("enrolled", "Enrolled"),
        ("rejected", "Rejected"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="initial")
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='students')
    # 🔹 Multi-Tenancy
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    campus_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Campus")
    image = models.ImageField(
        upload_to="images/",
        height_field=None,
        width_field=None,
        max_length=None,
        null=True, 
        blank=True,
    )
    completed_courses = models.JSONField(default=list)
    eligible_course = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    receipt_code = models.CharField(max_length=20, null=True, blank=True)
    receipt_code_verified = models.BooleanField(default=False)
    lms_account_created = models.BooleanField(default=False)
    lms_user_id = models.UUIDField(null=True, blank=True)
    student_id = models.CharField(max_length=50, null=True, blank=True, unique=True)
    terms_agreed = models.BooleanField(default=False)
    whatsapp_number = models.CharField(max_length=20, null=True, blank=True)
    gender = models.CharField(max_length=10, null=True, blank=True)
    
    # Newly added fields for ID Card
    level = models.CharField(max_length=50, null=True, blank=True, default="Level 1")
    specialization = models.CharField(max_length=255, null=True, blank=True)
    batch = models.CharField(max_length=50, null=True, blank=True)
    
    study_work_status = models.CharField(max_length=50, null=True, blank=True)
    study_work_details = models.TextField(null=True, blank=True)
    
    studied_at_idara = models.BooleanField(default=False)
    studying_at_idara = models.BooleanField(default=False)
    signature = models.TextField(null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    
    # 🔹 Data Sync from Admission Lead
    test_score = models.IntegerField(null=True, blank=True)
    has_paid_deposit = models.BooleanField(default=False)

    def generate_next_student_id(self, course_code=None):
        """Generates the next sequential ID in format AIT-[BRANCH]-YYYY-[CODE]-XXXX"""
        from django.utils import timezone
        current_year = timezone.now().year
        
        # Get branch code if available
        branch_code = ""
        if self.branch:
            branch_code = f"-{self.branch.code}"
        
        if course_code:
            prefix = f"AIT{branch_code}-{current_year}-{course_code.upper()}-"
        else:
            prefix = f"AIT{branch_code}-{current_year}-"
            
        # Find the highest existing ID for the current year/prefix
        last_student = Student.objects.filter(student_id__startswith=prefix).order_by('-student_id').first()
        
        if last_student and last_student.student_id:
            try:
                # Extract the numeric part (always the last segment)
                last_number = int(last_student.student_id.split('-')[-1])
                new_number = last_number + 1
            except (ValueError, IndexError):
                new_number = 1
        else:
            new_number = 1
            
        return f"{prefix}{new_number:04d}"

    def save(self, *args, **kwargs):
        # Auto-generate student_id if status is enrolled and it's missing
        if self.status == 'enrolled' and not self.student_id:
            course_code = getattr(self, '_course_code', None)
            self.student_id = self.generate_next_student_id(course_code=course_code)
        super().save(*args, **kwargs)

    class Meta:
        verbose_name_plural = "Students"

class StudentAcademicRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name='academic_record')
    highest_qualification = models.CharField(max_length=100, null=True, blank=True)
    institute_name = models.CharField(max_length=255, null=True, blank=True)
    passing_year = models.IntegerField(null=True, blank=True)
    grade_or_cgpa = models.CharField(max_length=20, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Student Academic Records"

class GuardianInfo(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name='guardian_info')
    father_name = models.CharField(max_length=255, null=True, blank=True)
    father_cnic = models.CharField(max_length=15, null=True, blank=True)
    father_phone = models.CharField(max_length=15, null=True, blank=True)
    relationship_to_student = models.CharField(max_length=100, null=True, blank=True) # e.g. Father, Mother
    emergency_contact_name = models.CharField(max_length=255, null=True, blank=True)
    emergency_contact_phone = models.CharField(max_length=15, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Guardian Information"

class ResidentialInfo(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name='residential_info')
    address = models.TextField(null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    state_or_province = models.CharField(max_length=100, null=True, blank=True)
    zip_code = models.CharField(max_length=20, null=True, blank=True)
    country = models.CharField(max_length=100, default="Pakistan")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Residential Information"

class ReceiptCode(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=20, unique=True)
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='receipt_codes')
    # 🔹 Multi-Tenancy
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    campus_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Campus")
    student_email = models.EmailField()
    student_name = models.CharField(max_length=255)
    course_id = models.UUIDField(null=True, blank=True)
    scheduled_class_id = models.UUIDField(null=True, blank=True, help_text="Session selected by student at registration")
    test_score = models.IntegerField(null=True, blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)
    added_by_admin = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='added_receipt_codes')
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

class Teacher(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='teachers')
    branches = models.ManyToManyField(Branch, blank=True, related_name='cross_branch_teachers', help_text="Additional branches this teacher can teach at")
    # 🔹 Multi-Tenancy
    organization_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Organization")
    campus_id = models.UUIDField(null=True, blank=True, help_text="FK to org-service Campus")
    specialization = models.CharField(max_length=255)
    qualification = models.CharField(max_length=255)
    image = models.ImageField(
        upload_to="images/",
        height_field=None,
        width_field=None,
        max_length=None,
        null=True, 
        blank=True,
    )
    experience = models.IntegerField()
    availability = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Teachers"

class TeacherAttendance(models.Model):
    STATUS_CHOICES = [
        ('PRESENT', 'Present'),
        ('ABSENT', 'Absent'),
        ('LATE', 'Late'),
        ('LEAVE', 'Leave'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='attendance_records')
    date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PRESENT')
    remarks = models.TextField(blank=True, null=True)
    marked_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='marked_teacher_attendances')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['teacher', 'date']
        verbose_name_plural = "Teacher Attendances"

class PasswordResetToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    token = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)

    def is_valid(self):
        from django.utils import timezone
        return not self.used and self.expires_at > timezone.now()

    def __str__(self):
        return f"Token for {self.user.email}"

    class Meta:
        verbose_name_plural = "Password Reset Tokens"

class StudentTransferHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='transfer_history')
    receipt_code = models.ForeignKey(ReceiptCode, on_delete=models.CASCADE, related_name='transfer_history')
    from_branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='outgoing_transfers')
    to_branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='incoming_transfers')
    from_course_id = models.UUIDField()
    to_course_id = models.UUIDField()
    from_section_id = models.UUIDField(null=True, blank=True)
    to_section_id = models.UUIDField(null=True, blank=True)
    reason = models.TextField(blank=True, null=True)
    transferred_at = models.DateTimeField(auto_now_add=True)
    transferred_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"Transfer for {self.student.user.email} from {self.from_course_id} to {self.to_course_id}"

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

class RolePermission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(max_length=20, unique=True)
    permissions = models.JSONField(default=dict) # e.g. {"view_deposits": true, ...}
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Permissions for {self.role}"

    class Meta:
        verbose_name_plural = "Role Permissions"

