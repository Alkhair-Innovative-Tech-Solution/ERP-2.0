from rest_framework import serializers
from decimal import Decimal
from .models import FundType, CashFund, FundTransfer


class FundTypeSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    fund_count = serializers.SerializerMethodField()

    class Meta:
        model = FundType
        fields = ['id', 'name', 'code', 'description', 'category',
                  'category_display', 'is_active', 'fund_count', 'created_at']

    def get_fund_count(self, obj):
        return obj.cash_funds.count()


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
        from django.db.models import Sum
        from django.utils import timezone
        thirty_days_ago = timezone.now().date() - timezone.timedelta(days=30)
        total = obj.branch.transactions.filter(
            date__gte=thirty_days_ago, is_void=False
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        return float(total) / 30 if total else 0


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
