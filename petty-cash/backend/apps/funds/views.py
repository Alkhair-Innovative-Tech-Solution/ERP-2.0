from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.utils import timezone
from decimal import Decimal

from .models import FundType, CashFund, FundTransfer
from .serializers import (
    FundTypeSerializer, CashFundSerializer, FundTransferSerializer
)
from petty_cash.permissions import IsFinanceHeadOrAccountsHead
from petty_cash.utils import log_action, get_user_branch


class FundTypeViewSet(viewsets.ModelViewSet):
    queryset = FundType.objects.all()
    serializer_class = FundTypeSerializer
    permission_classes = [IsAuthenticated, IsFinanceHeadOrAccountsHead]


class CashFundView(generics.RetrieveUpdateAPIView):
    serializer_class = CashFundSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        user_branch = get_user_branch(self.request.user)
        if user_branch:
            fund, _ = CashFund.objects.get_or_create(branch=user_branch)
            return fund
        fund_id = self.request.query_params.get('id')
        if fund_id:
            return CashFund.objects.get(id=fund_id)
        return CashFund.objects.first() or CashFund.objects.create()

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH']:
            return [IsAuthenticated(), IsFinanceHeadOrAccountsHead()]
        return [IsAuthenticated()]

    @action(detail=False, methods=['get'])
    def all(self, request):
        if request.user.role not in ['accounts_head', 'finance_head']:
            return Response({'error': 'Permission denied'}, status=403)
        funds = CashFund.objects.select_related('branch', 'fund_type').all()
        serializer = CashFundSerializer(funds, many=True, context={'request': request})
        return Response(serializer.data)


class CashFundAllView(generics.ListAPIView):
    serializer_class = CashFundSerializer
    permission_classes = [IsAuthenticated]
    queryset = CashFund.objects.select_related('branch', 'fund_type').all().order_by('id')


class FundTransferViewSet(viewsets.ModelViewSet):
    serializer_class = FundTransferSerializer
    permission_classes = [IsAuthenticated, IsFinanceHeadOrAccountsHead]

    def get_queryset(self):
        return FundTransfer.objects.select_related(
            'source_fund', 'destination_fund', 'requested_by', 'approved_by'
        ).all()

    def perform_create(self, serializer):
        transfer = serializer.save(requested_by=self.request.user)
        log_action(self.request.user, 'transfer', 'FundTransfer', transfer.id,
                    f"Transfer PKR {transfer.amount} requested", self.request)

    @action(detail=True, methods=['post'])
    def execute(self, request, pk=None):
        if request.user.role not in ['accounts_head', 'finance_head']:
            return Response({'error': 'Permission denied'}, status=403)

        transfer = self.get_object()
        if transfer.status != 'pending':
            return Response({'error': 'Transfer is not pending'}, status=400)

        source = transfer.source_fund
        dest = transfer.destination_fund

        if source.current_balance < transfer.amount:
            return Response({'error': 'Insufficient balance in source fund'}, status=400)

        source.current_balance -= transfer.amount
        dest.current_balance += transfer.amount
        source.save()
        dest.save()

        transfer.status = 'completed'
        transfer.approved_by = request.user
        transfer.completed_at = timezone.now()
        transfer.save()

        log_action(request.user, 'transfer', 'FundTransfer', transfer.id,
                    f"Executed transfer PKR {transfer.amount}", request)

        return Response({'message': 'Transfer completed'})
