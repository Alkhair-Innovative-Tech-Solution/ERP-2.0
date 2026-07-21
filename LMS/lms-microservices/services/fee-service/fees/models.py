import uuid
from django.db import models


class FeeType(models.Model):
    FREQUENCY_CHOICES = [
        ('monthly', 'Monthly'),
        ('yearly', 'Yearly'),
        ('one_time', 'One Time'),
        ('daily', 'Daily'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization_id = models.UUIDField()
    name = models.CharField(max_length=100)
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES, default='monthly')
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.get_frequency_display()})"

    class Meta:
        verbose_name_plural = "Fee Types"
        ordering = ["name"]


class FeeStructure(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization_id = models.UUIDField()
    name = models.CharField(max_length=255)
    campus_id = models.UUIDField(null=True, blank=True)
    level_id = models.UUIDField(null=True, blank=True)
    grade_id = models.UUIDField(null=True, blank=True)
    section = models.CharField(max_length=10, null=True, blank=True)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name}"

    class Meta:
        verbose_name_plural = "Fee Structures"
        ordering = ["name"]


class FeeLineItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fee_structure = models.ForeignKey(FeeStructure, on_delete=models.CASCADE, related_name='line_items')
    fee_type = models.ForeignKey(FeeType, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.fee_type.name}: {self.amount}"

    class Meta:
        verbose_name_plural = "Fee Line Items"


class StudentFee(models.Model):
    STATUS_CHOICES = [
        ('unpaid', 'Unpaid'),
        ('issued', 'Issued'),
        ('partial', 'Partial'),
        ('paid', 'Paid'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization_id = models.UUIDField()
    student_id = models.UUIDField()
    fee_structure = models.ForeignKey(FeeStructure, on_delete=models.SET_NULL, null=True, blank=True, related_name='student_fees')
    month = models.IntegerField()
    year = models.IntegerField()
    invoice_number = models.CharField(max_length=50, unique=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    remaining_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='unpaid')
    due_date = models.DateField()
    late_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    other_charges = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    fee_structure_details = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def generate_invoice_number(self):
        from django.utils import timezone
        prefix = f"AIT-FEE-{self.year}-"
        last = StudentFee.objects.filter(invoice_number__startswith=prefix).order_by('-invoice_number').first()
        if last and last.invoice_number:
            try:
                last_num = int(last.invoice_number.split('-')[-1])
                new_num = last_num + 1
            except (ValueError, IndexError):
                new_num = 1
        else:
            new_num = 1
        return f"{prefix}{new_num:05d}"

    def save(self, *args, **kwargs):
        self.remaining_amount = self.total_amount + self.late_fee + self.other_charges - self.paid_amount
        if self.paid_amount >= self.total_amount and self.total_amount > 0:
            self.status = 'paid'
        elif self.paid_amount > 0:
            self.status = 'partial'
        if not self.invoice_number:
            self.invoice_number = self.generate_invoice_number()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Fee: Student {self.student_id} - {self.month}/{self.year} - {self.status}"

    class Meta:
        verbose_name_plural = "Student Fees"
        unique_together = ['student_id', 'month', 'year']
        ordering = ['-year', '-month', 'status']


class Payment(models.Model):
    METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('bank', 'Bank Transfer'),
        ('online', 'Online Payment'),
        ('cheque', 'Cheque'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization_id = models.UUIDField()
    student_fee = models.ForeignKey(StudentFee, on_delete=models.CASCADE, related_name='payments')
    student_id = models.UUIDField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=20, choices=METHOD_CHOICES)
    received_by_id = models.UUIDField(null=True, blank=True)
    received_by_name = models.CharField(max_length=255, blank=True, null=True)
    payment_date = models.DateTimeField(auto_now_add=True)
    receipt_number = models.CharField(max_length=50, unique=True)
    bank_name = models.CharField(max_length=100, blank=True, null=True)
    transaction_id = models.CharField(max_length=100, blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)

    def generate_receipt_number(self):
        from django.utils import timezone
        year = timezone.now().year
        prefix = f"RCP-{year}-"
        last = Payment.objects.filter(receipt_number__startswith=prefix).order_by('-receipt_number').first()
        if last and last.receipt_number:
            try:
                last_num = int(last.receipt_number.split('-')[-1])
                new_num = last_num + 1
            except (ValueError, IndexError):
                new_num = 1
        else:
            new_num = 1
        return f"{prefix}{new_num:05d}"

    def save(self, *args, **kwargs):
        if not self.receipt_number:
            self.receipt_number = self.generate_receipt_number()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Payment: {self.receipt_number} - PKR {self.amount}"

    class Meta:
        verbose_name_plural = "Payments"
        ordering = ['-payment_date']


class PaymentTransaction(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization_id = models.UUIDField()
    student_fee = models.ForeignKey(StudentFee, on_delete=models.CASCADE, related_name='transactions')
    student_id = models.UUIDField()
    bank_account_id = models.UUIDField(null=True, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_id = models.CharField(max_length=100)
    screenshot = models.ImageField(upload_to='payment_screenshots/', null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    verified_by_id = models.UUIDField(null=True, blank=True)
    verified_by_name = models.CharField(max_length=255, blank=True, null=True)
    reject_reason = models.TextField(blank=True, null=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Txn: {self.transaction_id} - {self.status}"

    class Meta:
        verbose_name_plural = "Payment Transactions"
        ordering = ['-created_at']


class BankAccount(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization_id = models.UUIDField()
    bank_name = models.CharField(max_length=100)
    account_title = models.CharField(max_length=255)
    account_number = models.CharField(max_length=50)
    iban = models.CharField(max_length=50, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.bank_name} - {self.account_title}"

    class Meta:
        verbose_name_plural = "Bank Accounts"
        ordering = ["bank_name"]
