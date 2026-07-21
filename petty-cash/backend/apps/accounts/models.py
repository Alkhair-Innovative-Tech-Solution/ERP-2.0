from django.contrib.auth.models import AbstractUser
from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal


class Branch(models.Model):
    BRANCH_TYPES = [
        ('head_office', 'Head Office'),
        ('school', 'School Campus'),
        ('college', 'College'),
        ('hospital', 'Hospital'),
        ('medical_center', 'Medical Center'),
        ('it_institute', 'IT Institute'),
    ]
    type = models.CharField(max_length=20, choices=BRANCH_TYPES)
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, unique=True)
    location = models.CharField(max_length=255, blank=True)
    contact = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    contact_person = models.CharField(max_length=200, blank=True)
    contact_email = models.EmailField(blank=True)
    is_head_office = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'accounts'
        db_table = 'branches'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_type_display()})"


class User(AbstractUser):
    ROLE_CHOICES = [
        ('finance_head', 'Finance Head'),
        ('accounts_head', 'Accounts Head'),
        ('branch_manager', 'Branch Manager'),
        ('data_entry_operator', 'Data Entry Operator'),
        ('program_officer', 'Program Officer'),
        ('auditor', 'Auditor / Reviewer'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='branch_manager')
    department = models.CharField(max_length=100, blank=True)
    employee_id = models.CharField(max_length=50, blank=True, unique=True, null=True)
    phone = models.CharField(max_length=20, blank=True)
    spending_limit = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('5000.00'),
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    branch = models.ForeignKey(
        'accounts.Branch', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='users'
    )

    class Meta:
        app_label = 'accounts'
        db_table = 'users'

    def __str__(self):
        return f"{self.get_full_name()} ({self.get_role_display()})"

    @property
    def can_edit(self):
        return self.role in ['data_entry_operator', 'branch_manager', 'accounts_head', 'finance_head']

    @property
    def can_approve(self):
        return self.role in ['branch_manager', 'accounts_head', 'finance_head']

    @property
    def can_view_all_branches(self):
        return self.role in ['accounts_head', 'finance_head', 'program_officer']
