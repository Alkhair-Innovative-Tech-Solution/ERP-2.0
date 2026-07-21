from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal


class ExpenseCategory(models.Model):
    CATEGORY_TYPES = [
        ('general', 'General'),
        ('operational', 'Operational'),
        ('program', 'Program Specific'),
    ]
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    category_type = models.CharField(max_length=20, choices=CATEGORY_TYPES, default='general')
    parent = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='subcategories'
    )
    is_allowed = models.BooleanField(default=True)
    monthly_limit = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        app_label = 'expenses'
        db_table = 'expense_categories'
        verbose_name_plural = 'Expense Categories'
        ordering = ['name']

    def __str__(self):
        return self.name


class Transaction(models.Model):
    APPROVAL_STATUS = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    PAYMENT_METHODS = [
        ('cash', 'Cash'),
        ('bank_transfer', 'Bank Transfer'),
        ('cheque', 'Cheque'),
    ]
    cpv_number = models.CharField(max_length=50, blank=True, verbose_name='CPV #')
    date = models.DateField()
    amount = models.DecimalField(
        max_digits=10, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    category = models.ForeignKey(
        'expenses.ExpenseCategory', on_delete=models.PROTECT, related_name='transactions'
    )
    budget = models.ForeignKey(
        'settings.MonthlyBudget', on_delete=models.PROTECT,
        related_name='transactions', null=True, blank=True
    )
    description = models.TextField()
    narration = models.TextField(blank=True)
    payee = models.CharField(max_length=200, blank=True)
    program_tag = models.CharField(max_length=100, blank=True)
    donor_fund_tag = models.CharField(max_length=100, blank=True)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='cash')
    receipt = models.FileField(upload_to='receipts/%Y/%m/', null=True, blank=True)
    vendor_name = models.CharField(max_length=200, blank=True)
    entered_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, related_name='transactions_entered'
    )
    branch = models.ForeignKey(
        'accounts.Branch', on_delete=models.CASCADE, related_name='transactions',
        null=True, blank=True
    )
    approval_status = models.CharField(max_length=20, choices=APPROVAL_STATUS, default='approved')
    approved_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='transactions_approved'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    is_void = models.BooleanField(default=False)
    void_reason = models.TextField(blank=True)
    voided_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions_voided'
    )
    voided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'expenses'
        db_table = 'transactions'
        ordering = ['-date', '-created_at']

    def __str__(self):
        b = f" @ {self.branch.name}" if self.branch else ""
        return f"PKR {self.amount} - {self.category.name} on {self.date}{b}"
