from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import (
    User, Branch, ExpenseCategory, MonthlyBudget, Transaction, CashFund,
    FundType, Replenishment, ReplenishmentRequest, ApprovalRequest,
    FundTransfer, Notification, SystemSetting, ReportTemplate, AuditLog
)
from decimal import Decimal


class BranchSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_type_display', read_only=True)

    class Meta:
        model = Branch
        fields = ['id', 'type', 'type_display', 'name', 'code', 'location',
                  'contact', 'address', 'contact_person', 'contact_email',
                  'is_head_office', 'is_active', 'created_at']


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['full_name'] = user.get_full_name()
        token['employee_id'] = user.employee_id
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'full_name': self.user.get_full_name(),
            'role': self.user.role,
            'role_display': self.user.get_role_display(),
            'department': self.user.department,
            'employee_id': self.user.employee_id,
            'spending_limit': str(self.user.spending_limit),
            'branch': BranchSerializer(self.user.branch).data if self.user.branch else None,
        }
        return data


class UserSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email',
                  'role', 'role_display', 'department', 'employee_id',
                  'phone', 'spending_limit', 'branch', 'branch_name']
        read_only_fields = ['id']


class ExpenseCategorySerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source='parent.name', read_only=True)
    subcategory_count = serializers.SerializerMethodField()

    class Meta:
        model = ExpenseCategory
        fields = ['id', 'name', 'description', 'category_type', 'parent',
                  'parent_name', 'is_allowed', 'monthly_limit',
                  'is_active', 'subcategory_count', 'created_at']

    def get_subcategory_count(self, obj):
        return obj.subcategories.count()


class FundTypeSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    fund_count = serializers.SerializerMethodField()

    class Meta:
        model = FundType
        fields = ['id', 'name', 'code', 'description', 'category',
                  'category_display', 'is_active', 'fund_count', 'created_at']

    def get_fund_count(self, obj):
        return obj.cash_funds.count()


class MonthlyBudgetSerializer(serializers.ModelSerializer):
    total_spent = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    remaining = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    percent_used = serializers.SerializerMethodField()
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = MonthlyBudget
        fields = ['id', 'year', 'month', 'department', 'total_budget',
                  'total_spent', 'remaining', 'percent_used',
                  'notes', 'created_by_name', 'branch', 'branch_name', 'created_at', 'updated_at']

    def get_percent_used(self, obj):
        if obj.total_budget == 0:
            return 0
        return round((obj.total_spent / obj.total_budget) * 100, 1)


class TransactionListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    entered_by_name = serializers.CharField(source='entered_by.get_full_name', read_only=True)
    has_receipt = serializers.SerializerMethodField()
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    approval_status_display = serializers.CharField(source='get_approval_status_display', read_only=True)

    class Meta:
        model = Transaction
        fields = ['id', 'date', 'amount', 'category', 'category_name',
                  'description', 'narration', 'payee', 'vendor_name',
                  'program_tag', 'donor_fund_tag', 'payment_method',
                  'has_receipt', 'approval_status', 'approval_status_display',
                  'is_void', 'entered_by_name', 'branch', 'branch_name', 'created_at']

    def get_has_receipt(self, obj):
        return bool(obj.receipt)


class TransactionDetailSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    entered_by_name = serializers.CharField(source='entered_by.get_full_name', read_only=True)
    voided_by_name = serializers.CharField(source='voided_by.get_full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)
    receipt_url = serializers.SerializerMethodField()
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = Transaction
        fields = ['id', 'date', 'amount', 'category', 'category_name',
                  'budget', 'description', 'narration', 'payee',
                  'program_tag', 'donor_fund_tag', 'payment_method',
                  'receipt', 'receipt_url', 'vendor_name', 'entered_by_name',
                  'approval_status', 'approved_by_name', 'approved_at', 'rejection_reason',
                  'is_void', 'void_reason', 'voided_by_name', 'voided_at',
                  'branch', 'branch_name', 'created_at', 'updated_at']

    def get_receipt_url(self, obj):
        if obj.receipt:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.receipt.url)
        return None


class TransactionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ['date', 'amount', 'category', 'budget', 'description',
                  'narration', 'payee', 'program_tag', 'donor_fund_tag',
                  'payment_method', 'receipt', 'vendor_name', 'branch']

    def validate_category(self, value):
        if not value.is_allowed:
            raise serializers.ValidationError(
                f"'{value.name}' category is not allowed for petty cash expenses."
            )
        if not value.is_active:
            raise serializers.ValidationError("This category is inactive.")
        return value

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value


class CashFundSerializer(serializers.ModelSerializer):
    is_low = serializers.SerializerMethodField()
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    fund_type_name = serializers.CharField(source='fund_type.name', read_only=True)
    fund_type_display = serializers.CharField(source='fund_type.get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    burn_rate = serializers.SerializerMethodField()

    class Meta:
        model = CashFund
        fields = ['id', 'current_balance', 'low_balance_threshold', 'is_low',
                  'fund_type', 'fund_type_name', 'fund_type_display',
                  'program_tag', 'donor_source', 'annual_budget',
                  'max_balance_limit', 'start_date', 'end_date',
                  'status', 'status_display', 'allowed_categories',
                  'burn_rate', 'branch', 'branch_name', 'updated_at']

    def get_is_low(self, obj):
        return obj.current_balance <= obj.low_balance_threshold

    def get_burn_rate(self, obj):
        from django.db.models import Avg, Sum
        from django.utils import timezone
        thirty_days_ago = timezone.now().date() - timezone.timedelta(days=30)
        total = obj.branch.transactions.filter(
            date__gte=thirty_days_ago, is_void=False
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        return float(total) / 30 if total else 0


class ReplenishmentRequestSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    fund_name = serializers.CharField(source='fund.__str__', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.get_full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ReplenishmentRequest
        fields = ['id', 'branch', 'branch_name', 'fund', 'fund_name',
                  'amount_requested', 'reason', 'program_tag',
                  'status', 'status_display', 'requested_by_name',
                  'approved_by_name', 'approved_at', 'rejection_reason',
                  'created_at', 'updated_at']


class ReplenishmentSerializer(serializers.ModelSerializer):
    added_by_name = serializers.CharField(source='added_by.get_full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    transfer_proof_url = serializers.SerializerMethodField()

    class Meta:
        model = Replenishment
        fields = ['id', 'amount', 'date', 'reference_number',
                  'source_bank_account', 'donor_fund_tag',
                  'transfer_proof', 'transfer_proof_url',
                  'notes', 'request', 'added_by_name',
                  'approved_by_name', 'branch', 'branch_name', 'created_at']

    def get_transfer_proof_url(self, obj):
        if obj.transfer_proof:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.transfer_proof.url)
        return None


class ApprovalRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source='requested_by.get_full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    content_type_display = serializers.CharField(source='get_content_type_display', read_only=True)
    related_detail = serializers.SerializerMethodField()

    class Meta:
        model = ApprovalRequest
        fields = ['id', 'content_type', 'content_type_display', 'object_id',
                  'requested_by_name', 'approved_by_name',
                  'status', 'status_display', 'reason', 'response_note',
                  'requested_at', 'responded_at', 'related_detail']

    def get_related_detail(self, obj):
        if obj.content_type == 'expense' or obj.content_type == 'void':
            try:
                txn = Transaction.objects.get(id=obj.object_id)
                return {
                    'amount': str(txn.amount),
                    'description': txn.description,
                    'category_name': txn.category.name if txn.category else None,
                    'vendor_name': txn.vendor_name,
                    'date': txn.date.isoformat() if txn.date else None,
                }
            except Transaction.DoesNotExist:
                return None
        elif obj.content_type == 'replenishment':
            try:
                repl = ReplenishmentRequest.objects.get(id=obj.object_id)
                return {
                    'amount_requested': str(repl.amount_requested),
                    'reason': repl.reason,
                    'program_tag': repl.program_tag,
                }
            except ReplenishmentRequest.DoesNotExist:
                return None
        return None


class FundTransferSerializer(serializers.ModelSerializer):
    source_fund_name = serializers.CharField(source='source_fund.__str__', read_only=True)
    destination_fund_name = serializers.CharField(source='destination_fund.__str__', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.get_full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = FundTransfer
        fields = ['id', 'source_fund', 'source_fund_name',
                  'destination_fund', 'destination_fund_name',
                  'amount', 'reason', 'status', 'status_display',
                  'requested_by_name', 'approved_by_name',
                  'created_at', 'completed_at']


class NotificationSerializer(serializers.ModelSerializer):
    notif_type_display = serializers.CharField(source='get_notif_type_display', read_only=True)
    time_ago = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ['id', 'notif_type', 'notif_type_display', 'title',
                  'message', 'link', 'is_read', 'time_ago', 'created_at']

    def get_time_ago(self, obj):
        from django.utils import timezone
        delta = timezone.now() - obj.created_at
        if delta.days > 0:
            return f"{delta.days}d ago"
        if delta.seconds >= 3600:
            return f"{delta.seconds // 3600}h ago"
        if delta.seconds >= 60:
            return f"{delta.seconds // 60}m ago"
        return "just now"


class SystemSettingSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.CharField(source='updated_by.get_full_name', read_only=True)

    class Meta:
        model = SystemSetting
        fields = ['id', 'key', 'value', 'value_type', 'description',
                  'is_active', 'updated_by_name', 'updated_at', 'created_at']


class ReportTemplateSerializer(serializers.ModelSerializer):
    audience_display = serializers.CharField(source='get_audience_display', read_only=True)

    class Meta:
        model = ReportTemplate
        fields = ['id', 'name', 'audience', 'audience_display',
                  'config', 'is_active', 'created_at']


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = AuditLog
        fields = ['id', 'user_name', 'action', 'action_display', 'model_name',
                  'object_id', 'description', 'ip_address', 'timestamp']


class DashboardSerializer(serializers.Serializer):
    current_balance = serializers.DecimalField(max_digits=12, decimal_places=2)
    is_low_balance = serializers.BooleanField()
    low_balance_threshold = serializers.DecimalField(max_digits=10, decimal_places=2)
    this_month_spent = serializers.DecimalField(max_digits=12, decimal_places=2)
    this_month_budget = serializers.DecimalField(max_digits=12, decimal_places=2)
    budget_remaining = serializers.DecimalField(max_digits=12, decimal_places=2)
    budget_percent_used = serializers.FloatField()
    total_transactions_this_month = serializers.IntegerField()
    recent_transactions = TransactionListSerializer(many=True)
    monthly_trend = serializers.ListField()
    category_breakdown = serializers.ListField()
    branch_wise_spent = serializers.ListField(required=False)
    pending_approvals = serializers.IntegerField(required=False)
    cross_branch_balances = serializers.ListField(required=False)
