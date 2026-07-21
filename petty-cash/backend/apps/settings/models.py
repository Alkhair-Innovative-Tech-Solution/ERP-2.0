from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal


class MonthlyBudget(models.Model):
    year = models.IntegerField()
    month = models.IntegerField()
    total_budget = models.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    department = models.CharField(max_length=100, blank=True, default='General')
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, related_name='budgets_created'
    )
    branch = models.ForeignKey(
        'accounts.Branch', on_delete=models.CASCADE, related_name='budgets',
        null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'settings'
        db_table = 'monthly_budgets'
        unique_together = ('year', 'month', 'department', 'branch')
        ordering = ['-year', '-month']

    def __str__(self):
        b = f" [{self.branch.name}]" if self.branch else ""
        return f"Budget {self.month}/{self.year} - {self.department}{b}"

    @property
    def total_spent(self):
        return self.transactions.aggregate(
            total=models.Sum('amount', filter=models.Q(is_void=False))
        )['total'] or Decimal('0.00')

    @property
    def remaining(self):
        return self.total_budget - self.total_spent


class SystemSetting(models.Model):
    VALUE_TYPES = [
        ('string', 'String'),
        ('number', 'Number'),
        ('boolean', 'Boolean'),
        ('json', 'JSON'),
    ]
    key = models.CharField(max_length=100, unique=True)
    value = models.JSONField()
    value_type = models.CharField(max_length=20, choices=VALUE_TYPES, default='string')
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    updated_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='settings_updated'
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'settings'
        db_table = 'system_settings'
        ordering = ['key']

    def __str__(self):
        return f"{self.key} = {self.value}"


class AuditLog(models.Model):
    ACTION_CHOICES = [
        ('create', 'Created'),
        ('update', 'Updated'),
        ('void', 'Voided'),
        ('login', 'Login'),
        ('replenish', 'Replenished'),
        ('budget_set', 'Budget Set'),
        ('settings_change', 'Settings Change'),
        ('approve', 'Approved'),
        ('reject', 'Rejected'),
        ('transfer', 'Fund Transfer'),
    ]
    user = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    model_name = models.CharField(max_length=50)
    object_id = models.IntegerField(null=True, blank=True)
    description = models.TextField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'settings'
        db_table = 'audit_logs'
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.user} - {self.action} at {self.timestamp}"
