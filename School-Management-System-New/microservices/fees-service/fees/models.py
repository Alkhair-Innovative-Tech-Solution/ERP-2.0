from django.db import models
from django.utils import timezone
from users.managers import OrganizationManager


class CentralAuthFieldsMixin(models.Model):
    """
    Phase C2: additive, nullable fields for the central-auth repoint.
    Same shape as content-service's C1 mixin — dual-run, existing
    `organization` FK / OrganizationManager untouched.

    tenant_id:       stamped from the verified token's tenant_id claim,
                      used to scope reads for central-auth requests
                      (views.py branches on isinstance(user, CentralAuthUser)
                      and filters on this instead of `organization`).
    central_org_id:   maps this row's local `users.Organization` to its
                      central-auth Organization equivalent. Not yet
                      populated by anything (SMS is single-org today,
                      no real backfill data exists per Phase B0) — present
                      so the column exists when it's needed.
    """
    tenant_id = models.UUIDField(null=True, blank=True, db_index=True)
    central_org_id = models.UUIDField(null=True, blank=True, db_index=True)

    class Meta:
        abstract = True


class BankAccount(CentralAuthFieldsMixin):
    organization = models.ForeignKey(
        'users.Organization', on_delete=models.CASCADE,
        null=True, blank=True, related_name='bank_accounts'
    )
    bank_name = models.CharField(max_length=100)
    account_title = models.CharField(max_length=150)
    account_number = models.CharField(max_length=50)
    iban = models.CharField(max_length=34, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.bank_name} — {self.account_title}"

class FeeType(CentralAuthFieldsMixin):
    FREQUENCY_CHOICES = [
        ('daily', 'Daily'),
        ('monthly', 'Monthly'),
        ('yearly', 'Yearly'),
        ('one_time', 'One Time'),
    ]
    
    objects = OrganizationManager()
    
    organization = models.ForeignKey('users.Organization', on_delete=models.CASCADE, null=True, blank=True, related_name='fee_types')
    name = models.CharField(max_length=100)
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES, default='monthly')
    is_default = models.BooleanField(default=False, help_text="Default types cannot be deleted")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.get_frequency_display()})"


class FeeStructure(CentralAuthFieldsMixin):
    objects = OrganizationManager()
    
    organization = models.ForeignKey('users.Organization', on_delete=models.CASCADE, null=True, blank=True, related_name='fee_structures')
    name = models.CharField(max_length=150)
    campus = models.ForeignKey('campus.Campus', on_delete=models.CASCADE, related_name='fee_structures')
    level = models.ForeignKey('classes.Level', on_delete=models.SET_NULL, null=True, blank=True, related_name='fee_structures')
    grade = models.ForeignKey('classes.Grade', on_delete=models.SET_NULL, null=True, blank=True, related_name='fee_structures')
    section = models.ForeignKey('classes.ClassRoom', on_delete=models.SET_NULL, null=True, blank=True, related_name='fee_structures')
    is_default = models.BooleanField(default=False, help_text="if grade=None, it's school default")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class FeeLineItem(models.Model):
    fee_structure = models.ForeignKey(FeeStructure, on_delete=models.CASCADE, related_name='line_items')
    fee_type = models.ForeignKey(FeeType, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    frequency = models.CharField(max_length=20, choices=FeeType.FREQUENCY_CHOICES, blank=True, null=True) # Copied from FeeType

    def save(self, *args, **kwargs):
        if not self.frequency and self.fee_type:
            self.frequency = self.fee_type.frequency
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.fee_structure.name} - {self.fee_type.name}: {self.amount}"


class StudentFee(CentralAuthFieldsMixin):
    STATUS_CHOICES = [
        ('unpaid', 'Unpaid'),
        ('issued', 'Issued'),
        ('partial', 'Partial'),
        ('paid', 'Paid'),
    ]
    
    objects = OrganizationManager()
    
    organization = models.ForeignKey('users.Organization', on_delete=models.CASCADE, null=True, blank=True, related_name='student_fees')
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='fees')
    fee_structure = models.ForeignKey(FeeStructure, on_delete=models.SET_NULL, null=True, blank=True)
    month = models.PositiveIntegerField()
    year = models.PositiveIntegerField()
    invoice_number = models.CharField(max_length=50, unique=True, blank=True)
    
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    remaining_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='unpaid')
    due_date = models.DateField()
    late_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    other_charges = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    fee_structure_details = models.JSONField(default=dict, blank=True) # snapshot of line items
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('student', 'month', 'year')

    def save(self, *args, **kwargs):
        # remaining_amount is computed: total - paid
        # User specified logic: Calculate arrears as sum of remaining_amount of previous unpaid fees
        # But this model field stores its own remaining amount.
        self.remaining_amount = self.total_amount + self.late_fee + self.other_charges - self.paid_amount
        
        # Status management
        if self.remaining_amount <= 0:
            self.status = 'paid'
        elif self.paid_amount > 0:
            self.status = 'partial'
        
        is_new = not self.pk
        super().save(*args, **kwargs)

        if is_new and not self.invoice_number:
            campus_id = self.student.campus.id if self.student and self.student.campus else "0"
            self.invoice_number = f"SCH-{campus_id}-CH-{self.year}-{self.id:05d}"
            StudentFee.objects.filter(pk=self.pk).update(invoice_number=self.invoice_number)

    def __str__(self):
        return f"{self.student.name} - {self.month}/{self.year} - {self.status}"


class Payment(models.Model):
    METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('bank', 'Bank'),
    ]
    
    student_fee = models.ForeignKey(StudentFee, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default='cash')
    received_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True)
    # Phase C2: central-auth staff id who recorded this payment. A
    # CentralAuthUser isn't a users.User row, so it can't be assigned to
    # `received_by` (a real FK) — this is the separate field the recipe
    # calls for. No `organization`/tenant_id needed on Payment itself; it's
    # already scoped via student_fee.organization (legacy) / student_fee's
    # own tenant_id (central-auth), matching the existing query pattern.
    central_user_id = models.UUIDField(null=True, blank=True, db_index=True)
    payment_date = models.DateField(default=timezone.now)
    receipt_number = models.CharField(max_length=50, unique=True, blank=True)
    
    # bank fields
    bank_name = models.CharField(max_length=100, blank=True, null=True)
    transaction_id = models.CharField(max_length=100, blank=True, null=True)
    deposit_date = models.DateField(blank=True, null=True)

    def save(self, *args, **kwargs):
        is_new = not self.pk
        super().save(*args, **kwargs)
        if is_new and not self.receipt_number:
            year = self.payment_date.year
            self.receipt_number = f"RCP-{year}-{self.id:03d}"
            Payment.objects.filter(pk=self.pk).update(receipt_number=self.receipt_number)

    def __str__(self):
        return f"{self.receipt_number} - {self.amount}"


class PaymentTransaction(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    challan = models.ForeignKey(
        StudentFee, on_delete=models.CASCADE, related_name='transactions'
    )
    student = models.ForeignKey(
        'students.Student', on_delete=models.CASCADE,
        related_name='payment_transactions'
    )
    bank_account = models.ForeignKey(
        BankAccount, on_delete=models.SET_NULL, null=True, blank=True
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_id = models.CharField(max_length=100)
    screenshot = models.ImageField(
        upload_to='payment_screenshots/', blank=True, null=True
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='pending'
    )
    reject_reason = models.TextField(blank=True)
    verified_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='verified_transactions'
    )
    # Phase C2: same reasoning as Payment.central_user_id above — a
    # CentralAuthUser can't be assigned to verified_by (a real FK to
    # users.User).
    central_verified_by_id = models.UUIDField(null=True, blank=True, db_index=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"TXN-{self.id} | {self.student.name} | {self.status}"
