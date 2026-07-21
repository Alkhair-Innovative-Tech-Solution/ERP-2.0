from rest_framework import viewsets, generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import models as django_models
from django.utils import timezone
from django.db.models import Sum, Count, Q
from datetime import date, timedelta
from decimal import Decimal
import calendar

from .models import User, Branch
from .serializers import (
    CustomTokenObtainPairSerializer, UserSerializer, BranchSerializer
)
from apps.expenses.models import Transaction
from apps.funds.models import CashFund
from apps.settings.models import MonthlyBudget
from apps.replenishment.models import ReplenishmentRequest
from apps.approvals.models import ApprovalRequest
from apps.reports.serializers import DashboardSerializer
from petty_cash.permissions import (
    IsFinanceHeadOrAccountsHead, IsFinanceHeadOrAccountsHead
)
from petty_cash.utils import log_action, get_user_branch, get_setting


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            user = User.objects.get(username=request.data['username'])
            log_action(user, 'login', 'User', user.id, "User logged in", request)
        return response


class BranchViewSet(viewsets.ModelViewSet):
    queryset = Branch.objects.all()
    serializer_class = BranchSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsFinanceHeadOrAccountsHead()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return Branch.objects.all().order_by('name')


class UserListView(generics.ListAPIView):
    queryset = User.objects.filter(is_active=True)
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        return [IsAuthenticated(), IsFinanceHeadOrAccountsHead()]


class UserDetailView(generics.RetrieveUpdateAPIView):
    queryset = User.objects.filter(is_active=True)
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsFinanceHeadOrAccountsHead]

    def perform_update(self, serializer):
        user = serializer.save()
        log_action(
            self.request.user, 'update', 'User', user.id,
            f"Updated user {user.username}: role={user.role}, branch={user.branch_id}",
            self.request
        )


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        year, month = today.year, today.month
        user_branch = get_user_branch(request.user)

        if user_branch:
            fund, _ = CashFund.objects.get_or_create(branch=user_branch)
            all_funds_balance = sum(
                CashFund.objects.values_list('current_balance', flat=True)
            )
        else:
            fund = None
            all_funds_balance = sum(
                CashFund.objects.values_list('current_balance', flat=True)
            )

        budget_qs = MonthlyBudget.objects.filter(year=year, month=month)
        if user_branch:
            budget_qs = budget_qs.filter(branch=user_branch)

        agg = budget_qs.aggregate(
            total_bgt=Sum('total_budget'),
            total_spnt=Sum('transactions__amount', filter=Q(transactions__is_void=False)),
            txn_count=Count('transactions', filter=Q(transactions__is_void=False)),
        )
        this_month_budget = agg['total_bgt'] or Decimal('0')
        this_month_spent = agg['total_spnt'] or Decimal('0')
        budget_remaining = this_month_budget - this_month_spent
        percent_used = float(this_month_budget and (this_month_spent / this_month_budget * 100) or 0)

        txn_filter = {'date__year': year, 'date__month': month, 'is_void': False}
        if user_branch:
            txn_filter['branch'] = user_branch

        total_txns = Transaction.objects.filter(**txn_filter).count()

        recent_filter = {'is_void': False}
        if user_branch:
            recent_filter['branch'] = user_branch

        recent = Transaction.objects.filter(**recent_filter).select_related(
            'category', 'entered_by', 'branch'
        )[:5]

        # Monthly trend - last 6 months
        trend = []
        for i in range(5, -1, -1):
            if month - i <= 0:
                m = month - i + 12
                y = year - 1
            else:
                m = month - i
                y = year
            trend_filter = {'date__year': y, 'date__month': m, 'is_void': False}
            if user_branch:
                trend_filter['branch'] = user_branch
            spent = Transaction.objects.filter(
                **trend_filter
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            trend.append({
                'month': f"{calendar.month_abbr[m]} {y}",
                'spent': float(spent)
            })

        # Category breakdown this month
        cat_filter = {'date__year': year, 'date__month': month, 'is_void': False}
        if user_branch:
            cat_filter['branch'] = user_branch
        breakdown = Transaction.objects.filter(
            **cat_filter
        ).values('category__name').annotate(
            total=Sum('amount'), count=Count('id')
        ).order_by('-total')[:6]

        # Branch-wise spent
        branch_wise_spent = []
        if request.user.role in ['accounts_head', 'finance_head']:
            branch_data = Transaction.objects.filter(
                date__year=year, date__month=month, is_void=False
            ).values('branch__name', 'branch__code').annotate(
                total=Sum('amount'), count=Count('id')
            ).order_by('-total')
            branch_wise_spent = [
                {
                    'branch_name': b['branch__name'] or 'Unassigned',
                    'branch_code': b['branch__code'] or '',
                    'total': float(b['total']),
                    'count': b['count']
                }
                for b in branch_data
            ]

        # Cross-branch balance view
        cross_branch_balances = []
        if request.user.role in ['accounts_head', 'finance_head']:
            for cf in CashFund.objects.select_related('branch').all():
                cross_branch_balances.append({
                    'branch_name': cf.branch.name if cf.branch else 'Unassigned',
                    'branch_code': cf.branch.code if cf.branch else '',
                    'balance': float(cf.current_balance),
                    'is_low': bool(cf.current_balance <= cf.low_balance_threshold),
                })

        # Pending approvals count (branch-scoped for managers)
        if request.user.role == 'branch_manager' and request.user.branch:
            expense_ids = Transaction.objects.filter(branch=request.user.branch).values('pk')
            replenishment_ids = ReplenishmentRequest.objects.filter(branch=request.user.branch).values('pk')
            pending_approvals = ApprovalRequest.objects.filter(
                status='pending'
            ).filter(
                Q(content_type='expense', object_id__in=expense_ids) |
                Q(content_type='void', object_id__in=expense_ids) |
                Q(content_type='replenishment', object_id__in=replenishment_ids)
            ).count()
        else:
            pending_approvals = ApprovalRequest.objects.filter(status='pending').count()

        data = {
            'current_balance': fund.current_balance if fund else all_funds_balance,
            'is_low_balance': fund and fund.current_balance <= fund.low_balance_threshold or False,
            'low_balance_threshold': fund.low_balance_threshold if fund else 0,
            'this_month_spent': this_month_spent,
            'this_month_budget': this_month_budget,
            'budget_remaining': budget_remaining,
            'budget_percent_used': round(percent_used, 1),
            'total_transactions_this_month': total_txns,
            'recent_transactions': recent,
            'monthly_trend': list(trend),
            'category_breakdown': [
                {
                    'category': b['category__name'],
                    'total': float(b['total']),
                    'count': b['count']
                }
                for b in breakdown
            ],
            'branch_wise_spent': branch_wise_spent,
            'cross_branch_balances': cross_branch_balances,
            'pending_approvals': pending_approvals,
        }

        serializer = DashboardSerializer(data)
        return Response(serializer.data)
