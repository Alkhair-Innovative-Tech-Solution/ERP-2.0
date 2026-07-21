from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.utils import timezone
from django.db.models import Max
from datetime import date

from .models import ReplenishmentRequest, Replenishment
from apps.funds.models import CashFund
from apps.accounts.models import User
from .serializers import (
    ReplenishmentRequestSerializer, ReplenishmentSerializer
)
from petty_cash.permissions import (
    IsDataEntryOrAbove, IsBranchManagerOrAbove
)
from petty_cash.utils import log_action, get_user_branch, create_notification, _excel_response
from petty_cash.exports import export_replenishments


class ReplenishmentRequestViewSet(viewsets.ModelViewSet):
    serializer_class = ReplenishmentRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user_branch = get_user_branch(self.request.user)
        qs = ReplenishmentRequest.objects.select_related(
            'branch', 'fund', 'requested_by', 'approved_by'
        ).all()
        if user_branch:
            qs = qs.filter(branch=user_branch)
        params = self.request.query_params
        if params.get('status'):
            qs = qs.filter(status=params['status'])
        if params.get('date_from'):
            qs = qs.filter(created_at__date__gte=params['date_from'])
        if params.get('date_to'):
            qs = qs.filter(created_at__date__lte=params['date_to'])
        return qs

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated(), IsDataEntryOrAbove()]
        return [IsAuthenticated()]

    @staticmethod
    def _generate_req(branch):
        if not branch:
            return ''
        now = timezone.now()
        prefix = f"REQ-{branch.code}-{now:%Y%m}-"
        last = ReplenishmentRequest.objects.filter(req_number__startswith=prefix) \
            .aggregate(m=Max('req_number'))['m']
        seq = (int(last[-3:]) + 1) if last and last[-3:].isdigit() else 1
        return f"{prefix}{seq:03d}"

    def perform_create(self, serializer):
        user_branch = get_user_branch(self.request.user)
        req_number = self._generate_req(user_branch)
        req = serializer.save(requested_by=self.request.user, req_number=req_number)
        log_action(self.request.user, 'create', 'ReplenishmentRequest', req.id,
                    f"Replenishment request PKR {req.amount_requested} [{req.req_number}]", self.request)

        finance_heads = User.objects.filter(
            role__in=['accounts_head', 'finance_head'], is_active=True
        )
        for fh in finance_heads:
            create_notification(
                fh, 'approval_pending',
                'Replenishment Request',
                f"PKR {req.amount_requested} requested by {req.requested_by.get_full_name()}",
                f'/replenishments'
            )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        if request.user.role not in ['accounts_head', 'finance_head']:
            return Response({'error': 'Permission denied'}, status=403)

        replenishment_req = self.get_object()
        if replenishment_req.status != 'pending':
            return Response({'error': 'Request is not pending'}, status=400)

        replenishment_req.status = 'approved'
        replenishment_req.approved_by = request.user
        replenishment_req.approved_at = timezone.now()
        replenishment_req.save()

        log_action(request.user, 'approve', 'ReplenishmentRequest',
                    replenishment_req.id, f"Approved replenishment request", request)

        create_notification(
            replenishment_req.requested_by, 'approval_completed',
            'Replenishment Approved',
            f"Your replenishment request PKR {replenishment_req.amount_requested} was approved",
            f'/replenishments'
        )

        return Response({'message': 'Request approved. Create replenishment to complete.'})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        if request.user.role not in ['accounts_head', 'finance_head']:
            return Response({'error': 'Permission denied'}, status=403)

        replenishment_req = self.get_object()
        reason = request.data.get('reason', '')
        replenishment_req.status = 'rejected'
        replenishment_req.rejection_reason = reason
        replenishment_req.save()

        log_action(request.user, 'reject', 'ReplenishmentRequest',
                    replenishment_req.id, f"Rejected: {reason}", request)

        create_notification(
            replenishment_req.requested_by, 'approval_completed',
            'Replenishment Rejected',
            f"Your request was rejected: {reason}",
            f'/replenishments'
        )

        return Response({'message': 'Request rejected'})


class ReplenishmentViewSet(viewsets.ModelViewSet):
    serializer_class = ReplenishmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user_branch = get_user_branch(self.request.user)
        qs = Replenishment.objects.select_related(
            'added_by', 'approved_by', 'branch', 'request'
        ).all()
        if user_branch:
            qs = qs.filter(branch=user_branch)
        params = self.request.query_params
        if params.get('date_from'):
            qs = qs.filter(date__gte=params['date_from'])
        if params.get('date_to'):
            qs = qs.filter(date__lte=params['date_to'])
        if params.get('year'):
            qs = qs.filter(date__year=params['year'])
        if params.get('month'):
            qs = qs.filter(date__month=params['month'])
        return qs

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated(), IsBranchManagerOrAbove()]
        return [IsAuthenticated()]

    @staticmethod
    def _generate_ref(branch):
        if not branch:
            return ''
        now = timezone.now()
        prefix = f"REF-{branch.code}-{now:%Y%m}-"
        last = Replenishment.objects.filter(reference_number__startswith=prefix) \
            .aggregate(m=Max('reference_number'))['m']
        seq = (int(last[-3:]) + 1) if last and last[-3:].isdigit() else 1
        return f"{prefix}{seq:03d}"

    def perform_create(self, serializer):
        user_branch = get_user_branch(self.request.user)
        ref = self._generate_ref(user_branch)
        replenishment = serializer.save(
            added_by=self.request.user,
            branch=user_branch,
            reference_number=ref
        )

        branch = replenishment.branch
        fund_filter = branch and {'branch': branch} or {}
        fund, _ = CashFund.objects.get_or_create(**fund_filter)
        fund.current_balance += replenishment.amount
        fund.save()

        if replenishment.request:
            replenishment.request.status = 'completed'
            replenishment.request.save()

        log_action(
            self.request.user, 'replenish', 'Replenishment', replenishment.id,
            f"Fund replenished: PKR {replenishment.amount}. Ref: {replenishment.reference_number}",
            self.request
        )


class ExportReplenishmentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        year = int(request.query_params.get('year', today.year))
        month = int(request.query_params.get('month', today.month))
        user_branch = get_user_branch(request.user)

        rep_filter = {'date__year': year, 'date__month': month}
        if user_branch:
            rep_filter['branch'] = user_branch

        replenishments = Replenishment.objects.filter(**rep_filter).select_related(
            'branch', 'added_by'
        )

        wb = export_replenishments(replenishments)
        return _excel_response(wb, f'replenishments_{year}_{month:02d}.xlsx')
