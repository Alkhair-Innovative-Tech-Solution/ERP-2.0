from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q

from .models import ApprovalRequest
from apps.expenses.models import Transaction
from apps.replenishment.models import ReplenishmentRequest
from .serializers import ApprovalRequestSerializer


class ApprovalRequestViewSet(viewsets.ModelViewSet):
    serializer_class = ApprovalRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = ApprovalRequest.objects.select_related(
            'requested_by', 'approved_by'
        ).all()
        if user.role == 'branch_manager' and user.branch:
            expense_ids = Transaction.objects.filter(branch=user.branch).values('pk')
            replenishment_ids = ReplenishmentRequest.objects.filter(branch=user.branch).values('pk')
            qs = qs.filter(
                Q(content_type='expense', object_id__in=expense_ids) |
                Q(content_type='void', object_id__in=expense_ids) |
                Q(content_type='replenishment', object_id__in=replenishment_ids)
            )
        params = self.request.query_params
        if params.get('status'):
            qs = qs.filter(status=params['status'])
        if params.get('content_type'):
            qs = qs.filter(content_type=params['content_type'])
        if params.get('date_from'):
            qs = qs.filter(requested_at__date__gte=params['date_from'])
        if params.get('date_to'):
            qs = qs.filter(requested_at__date__lte=params['date_to'])
        return qs
