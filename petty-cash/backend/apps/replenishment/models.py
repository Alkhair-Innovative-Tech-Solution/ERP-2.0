from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal


class ReplenishmentRequest(models.Model):
    REQUEST_STATUS = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    ]
    branch = models.ForeignKey('accounts.Branch', on_delete=models.CASCADE, related_name='replenishment_requests')
    fund = models.ForeignKey('funds.CashFund', on_delete=models.CASCADE, related_name='replenishment_requests')
    amount_requested = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    reason = models.TextField()
    program_tag = models.CharField(max_length=100, blank=True)
    req_number = models.CharField(max_length=50, blank=True, verbose_name='REQ #')
    status = models.CharField(max_length=20, choices=REQUEST_STATUS, default='pending')
    requested_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='replenishment_requests')
    approved_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='replenishment_approvals')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'replenishment'
        db_table = 'replenishment_requests'
        ordering = ['-created_at']

    def __str__(self):
        return f"Replenishment Request PKR {self.amount_requested} - {self.status}"


class Replenishment(models.Model):
    amount = models.DecimalField(
        max_digits=10, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    date = models.DateField()
    reference_number = models.CharField(max_length=100, blank=True)
    source_bank_account = models.CharField(max_length=100, blank=True)
    donor_fund_tag = models.CharField(max_length=100, blank=True)
    transfer_proof = models.FileField(upload_to='transfers/%Y/%m/', null=True, blank=True)
    notes = models.TextField(blank=True)
    request = models.ForeignKey(
        'replenishment.ReplenishmentRequest', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='replenishments'
    )
    added_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, related_name='replenishments'
    )
    approved_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='replenishments_approved'
    )
    branch = models.ForeignKey(
        'accounts.Branch', on_delete=models.CASCADE, related_name='replenishments',
        null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'replenishment'
        db_table = 'replenishments'
        ordering = ['-date']

    def __str__(self):
        b = f" @ {self.branch.name}" if self.branch else ""
        return f"Replenishment PKR {self.amount} on {self.date}{b}"
