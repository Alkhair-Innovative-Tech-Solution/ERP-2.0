from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal


class FundType(models.Model):
    FUND_CATEGORIES = [
        ('operational', 'Operational'),
        ('program', 'Program Fund'),
        ('donor_restricted', 'Donor-Restricted Fund'),
        ('emergency', 'Emergency Fund'),
        ('project', 'Project Fund'),
    ]
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=FUND_CATEGORIES)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'funds'
        db_table = 'fund_types'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_category_display()})"


class CashFund(models.Model):
    FUND_STATUS = [
        ('active', 'Active'),
        ('suspended', 'Suspended'),
        ('archived', 'Archived'),
    ]
    current_balance = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('0.00')
    )
    low_balance_threshold = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('5000.00')
    )
    fund_type = models.ForeignKey(
        'funds.FundType', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='cash_funds'
    )
    program_tag = models.CharField(max_length=100, blank=True)
    donor_source = models.CharField(max_length=200, blank=True)
    annual_budget = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    max_balance_limit = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=FUND_STATUS, default='active')
    allowed_categories = models.ManyToManyField(
        'expenses.ExpenseCategory', blank=True, related_name='funds'
    )
    branch = models.ForeignKey(
        'accounts.Branch', on_delete=models.CASCADE, related_name='cash_funds',
        null=True, blank=True
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'funds'
        db_table = 'cash_fund'

    def __str__(self):
        b = f" [{self.branch.name}]" if self.branch else ""
        ft = f" ({self.fund_type.name})" if self.fund_type else ""
        return f"Fund: PKR {self.current_balance}{b}{ft}"


class FundTransfer(models.Model):
    TRANSFER_STATUS = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('completed', 'Completed'),
    ]
    source_fund = models.ForeignKey(
        'funds.CashFund', on_delete=models.CASCADE, related_name='transfers_out'
    )
    destination_fund = models.ForeignKey(
        'funds.CashFund', on_delete=models.CASCADE, related_name='transfers_in'
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=TRANSFER_STATUS, default='pending')
    requested_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, related_name='transfers_requested'
    )
    approved_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='transfers_approved'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = 'funds'
        db_table = 'fund_transfers'
        ordering = ['-created_at']

    def __str__(self):
        return f"Transfer PKR {self.amount}: {self.source_fund} → {self.destination_fund}"
