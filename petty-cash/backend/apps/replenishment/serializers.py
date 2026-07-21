from rest_framework import serializers
from .models import ReplenishmentRequest, Replenishment


class ReplenishmentRequestSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    fund_name = serializers.CharField(source='fund.__str__', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.get_full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ReplenishmentRequest
        fields = ['id', 'branch', 'branch_name', 'fund', 'fund_name',
                  'amount_requested', 'reason', 'program_tag', 'req_number',
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
