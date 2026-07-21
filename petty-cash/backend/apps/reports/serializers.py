from rest_framework import serializers
from .models import ReportTemplate
from apps.expenses.serializers import TransactionListSerializer


class ReportTemplateSerializer(serializers.ModelSerializer):
    audience_display = serializers.CharField(source='get_audience_display', read_only=True)

    class Meta:
        model = ReportTemplate
        fields = ['id', 'name', 'audience', 'audience_display',
                  'config', 'is_active', 'created_at']


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
