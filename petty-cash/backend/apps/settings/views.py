from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from datetime import date

from .models import MonthlyBudget, SystemSetting, AuditLog
from .serializers import (
    MonthlyBudgetSerializer, SystemSettingSerializer, AuditLogSerializer
)
from petty_cash.permissions import (
    IsFinanceHeadOrAccountsHead, IsAuditorOrAbove,
    IsFinanceHeadOrAccountsHead
)
from petty_cash.utils import log_action, get_user_branch


class MonthlyBudgetViewSet(viewsets.ModelViewSet):
    serializer_class = MonthlyBudgetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user_branch = get_user_branch(self.request.user)
        qs = MonthlyBudget.objects.select_related('created_by', 'branch').all()
        if user_branch:
            qs = qs.filter(branch=user_branch)
        return qs

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsFinanceHeadOrAccountsHead()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        budget = serializer.save(created_by=self.request.user)
        log_action(
            self.request.user, 'budget_set', 'MonthlyBudget', budget.id,
            f"Budget set: PKR {budget.total_budget} for {budget.month}/{budget.year}",
            self.request
        )

    @action(detail=False, methods=['get'])
    def current(self, request):
        today = date.today()
        user_branch = get_user_branch(request.user)
        filter_kwargs = {'year': today.year, 'month': today.month}
        if user_branch:
            filter_kwargs['branch'] = user_branch
        try:
            budget = MonthlyBudget.objects.get(**filter_kwargs)
            return Response(MonthlyBudgetSerializer(budget).data)
        except MonthlyBudget.DoesNotExist:
            return Response({'message': 'No budget set for current month'}, status=404)


class SystemSettingViewSet(viewsets.ModelViewSet):
    queryset = SystemSetting.objects.filter(is_active=True)
    serializer_class = SystemSettingSerializer
    permission_classes = [IsAuthenticated, IsFinanceHeadOrAccountsHead]

    def perform_update(self, serializer):
        old = self.get_object()
        setting = serializer.save(updated_by=self.request.user)
        log_action(
            self.request.user, 'settings_change', 'SystemSetting', setting.id,
            f"Setting '{setting.key}' changed: {old.value} → {setting.value}",
            self.request
        )


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related('user').all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsAuditorOrAbove]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get('action'):
            qs = qs.filter(action=params['action'])
        if params.get('model'):
            qs = qs.filter(model_name=params['model'])
        if params.get('user_id'):
            qs = qs.filter(user_id=params['user_id'])
        if params.get('date_from'):
            qs = qs.filter(timestamp__date__gte=params['date_from'])
        if params.get('date_to'):
            qs = qs.filter(timestamp__date__lte=params['date_to'])
        return qs
