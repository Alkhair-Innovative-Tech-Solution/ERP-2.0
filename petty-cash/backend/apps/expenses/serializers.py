from rest_framework import serializers
from decimal import Decimal
from .models import ExpenseCategory, Transaction


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


class TransactionListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    entered_by_name = serializers.CharField(source='entered_by.get_full_name', read_only=True)
    has_receipt = serializers.SerializerMethodField()
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    approval_status_display = serializers.CharField(source='get_approval_status_display', read_only=True)

    class Meta:
        model = Transaction
        fields = ['id', 'cpv_number', 'date', 'amount', 'category', 'category_name',
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
        fields = ['id', 'cpv_number', 'date', 'amount', 'category', 'category_name',
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
                  'payment_method', 'receipt', 'vendor_name', 'branch',
                  'cpv_number']

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
