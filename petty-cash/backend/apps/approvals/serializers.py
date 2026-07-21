from rest_framework import serializers
from .models import ApprovalRequest
from apps.expenses.models import Transaction
from apps.replenishment.models import ReplenishmentRequest


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
        if obj.content_type in ('expense', 'void'):
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
