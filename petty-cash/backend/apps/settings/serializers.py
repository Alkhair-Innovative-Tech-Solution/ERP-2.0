from rest_framework import serializers
from .models import MonthlyBudget, SystemSetting, AuditLog


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


class SystemSettingSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.CharField(source='updated_by.get_full_name', read_only=True)

    class Meta:
        model = SystemSetting
        fields = ['id', 'key', 'value', 'value_type', 'description',
                  'is_active', 'updated_by_name', 'updated_at', 'created_at']


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = AuditLog
        fields = ['id', 'user_name', 'action', 'action_display', 'model_name',
                  'object_id', 'description', 'ip_address', 'timestamp']
