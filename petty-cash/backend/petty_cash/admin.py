from django.contrib import admin
from apps.accounts.models import User, Branch
from apps.expenses.models import ExpenseCategory, Transaction
from apps.funds.models import CashFund, FundType, FundTransfer
from apps.settings.models import MonthlyBudget, SystemSetting, AuditLog
from apps.replenishment.models import Replenishment, ReplenishmentRequest
from apps.approvals.models import ApprovalRequest
from apps.notifications.models import Notification
from apps.reports.models import ReportTemplate

@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ['name', 'type', 'code', 'location', 'is_head_office', 'is_active']
    list_filter = ['type', 'is_active', 'is_head_office']
    search_fields = ['name', 'code']

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['username', 'get_full_name', 'role', 'branch', 'department', 'employee_id', 'spending_limit', 'is_active']
    list_filter = ['role', 'is_active']
    search_fields = ['username', 'first_name', 'last_name', 'employee_id']

@admin.register(ExpenseCategory)
class ExpenseCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'category_type', 'parent', 'is_allowed', 'monthly_limit', 'is_active']
    list_filter = ['is_allowed', 'is_active', 'category_type']

@admin.register(MonthlyBudget)
class MonthlyBudgetAdmin(admin.ModelAdmin):
    list_display = ['year', 'month', 'department', 'branch', 'total_budget', 'created_by']
    list_filter = ['year', 'month', 'branch']

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ['date', 'amount', 'category', 'branch', 'description', 'entered_by', 'approval_status', 'is_void']
    list_filter = ['is_void', 'approval_status', 'category', 'date', 'branch']
    search_fields = ['description', 'vendor_name', 'narration', 'payee']
    readonly_fields = ['created_at', 'updated_at']

@admin.register(FundType)
class FundTypeAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'category', 'is_active']
    list_filter = ['category', 'is_active']

@admin.register(CashFund)
class CashFundAdmin(admin.ModelAdmin):
    list_display = ['current_balance', 'low_balance_threshold', 'fund_type', 'status', 'branch', 'updated_at']
    list_filter = ['status', 'fund_type', 'branch']

@admin.register(Replenishment)
class ReplenishmentAdmin(admin.ModelAdmin):
    list_display = ['date', 'amount', 'reference_number', 'source_bank_account', 'branch', 'added_by']
    list_filter = ['branch']

@admin.register(ReplenishmentRequest)
class ReplenishmentRequestAdmin(admin.ModelAdmin):
    list_display = ['amount_requested', 'status', 'branch', 'requested_by', 'created_at']
    list_filter = ['status', 'branch']

@admin.register(ApprovalRequest)
class ApprovalRequestAdmin(admin.ModelAdmin):
    list_display = ['content_type', 'object_id', 'status', 'requested_by', 'approved_by', 'requested_at']
    list_filter = ['status', 'content_type']

@admin.register(FundTransfer)
class FundTransferAdmin(admin.ModelAdmin):
    list_display = ['source_fund', 'destination_fund', 'amount', 'status', 'requested_by', 'created_at']
    list_filter = ['status']

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['recipient', 'notif_type', 'title', 'is_read', 'created_at']
    list_filter = ['notif_type', 'is_read']

@admin.register(SystemSetting)
class SystemSettingAdmin(admin.ModelAdmin):
    list_display = ['key', 'value', 'value_type', 'is_active', 'updated_at']
    list_filter = ['value_type', 'is_active']
    search_fields = ['key']

@admin.register(ReportTemplate)
class ReportTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'audience', 'is_active', 'created_at']
    list_filter = ['audience', 'is_active']

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['timestamp', 'user', 'action', 'model_name', 'description']
    list_filter = ['action', 'model_name']
    readonly_fields = ['timestamp']
