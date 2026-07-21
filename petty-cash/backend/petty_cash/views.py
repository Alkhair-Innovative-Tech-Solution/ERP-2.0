from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from django.db import models as django_models
from django.utils import timezone
from django.db.models import Sum, Count, Q
from datetime import date, datetime
from decimal import Decimal
import calendar

from .models import (
    User, Branch, ExpenseCategory, MonthlyBudget, Transaction,
    CashFund, FundType, Replenishment, ReplenishmentRequest,
    ApprovalRequest, FundTransfer, Notification, SystemSetting,
    ReportTemplate, AuditLog
)
from .serializers import (
    CustomTokenObtainPairSerializer, UserSerializer, BranchSerializer,
    ExpenseCategorySerializer, MonthlyBudgetSerializer, FundTypeSerializer,
    TransactionListSerializer, TransactionDetailSerializer,
    TransactionCreateSerializer, CashFundSerializer,
    ReplenishmentSerializer, ReplenishmentRequestSerializer,
    ApprovalRequestSerializer, FundTransferSerializer,
    NotificationSerializer, SystemSettingSerializer,
    ReportTemplateSerializer, AuditLogSerializer, DashboardSerializer
)
from .permissions import (
    IsAccountsHead, IsBranchManagerOrAbove, IsAuditorOrAbove,
    IsFinanceHead, IsFinanceOrAccountsHead, IsFinanceHeadOrAccountsHead,
    IsDataEntryOrAbove, CanApproveExpense
)
from .exports import export_cashbook, export_transactions, export_replenishments


def log_action(user, action, model_name, object_id=None, description='', request=None):
    ip = None
    if request:
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        ip = x_forwarded.split(',')[0] if x_forwarded else request.META.get('REMOTE_ADDR')
    AuditLog.objects.create(
        user=user, action=action, model_name=model_name,
        object_id=object_id, description=description, ip_address=ip
    )


def get_user_branch(user):
    if user.role in ['accounts_head', 'finance_head', 'program_officer']:
        return None
    return user.branch


def get_setting(key, default=None):
    try:
        setting = SystemSetting.objects.get(key=key, is_active=True)
        return setting.value
    except SystemSetting.DoesNotExist:
        return default


def create_notification(recipient, notif_type, title, message, link=''):
    Notification.objects.create(
        recipient=recipient, notif_type=notif_type,
        title=title, message=message, link=link
    )


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            user = User.objects.get(username=request.data['username'])
            log_action(user, 'login', 'User', user.id, f"User logged in", request)
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


class TransactionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user_branch = get_user_branch(self.request.user)
        qs = Transaction.objects.select_related(
            'category', 'entered_by', 'voided_by', 'approved_by', 'budget', 'branch'
        ).order_by('-date', '-created_at')

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
        if params.get('category'):
            qs = qs.filter(category_id=params['category'])
        if params.get('branch'):
            qs = qs.filter(branch_id=params['branch'])
        if params.get('program_tag'):
            qs = qs.filter(program_tag__icontains=params['program_tag'])
        if params.get('approval_status'):
            qs = qs.filter(approval_status=params['approval_status'])
        if params.get('is_void') is not None:
            qs = qs.filter(is_void=params['is_void'] == 'true')
        if params.get('search'):
            qs = qs.filter(
                Q(description__icontains=params['search']) |
                Q(vendor_name__icontains=params['search']) |
                Q(narration__icontains=params['search']) |
                Q(payee__icontains=params['search'])
            )
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return TransactionCreateSerializer
        if self.action in ['retrieve']:
            return TransactionDetailSerializer
        return TransactionListSerializer

    def perform_create(self, serializer):
        user = self.request.user
        user_branch = get_user_branch(user)
        branch = user_branch
        if not branch:
            branch_id = self.request.data.get('branch')
            if branch_id:
                from .models import Branch
                branch = Branch.objects.get(id=branch_id)
        transaction = serializer.save(
            entered_by=user,
            branch=branch
        )

        # Check approval threshold
        threshold = get_setting('expense_approval_threshold', 5000)
        user_limit = user.spending_limit

        if transaction.amount > Decimal(str(threshold)) or transaction.amount > user_limit:
            transaction.approval_status = 'pending'
            transaction.save()

            # Create approval request
            ApprovalRequest.objects.create(
                content_type='expense',
                object_id=transaction.id,
                requested_by=user,
                reason=f"Expense PKR {transaction.amount} exceeds threshold"
            )

            # Notify managers
            managers = User.objects.filter(
                role__in=['branch_manager', 'accounts_head', 'finance_head'],
                is_active=True
            )
            for mgr in managers:
                create_notification(
                    mgr, 'approval_pending',
                    'Expense Approval Required',
                    f"PKR {transaction.amount} - {transaction.description} needs approval",
                    f'/expenses'
                )
        else:
            # Auto-approve
            transaction.approval_status = 'approved'
            transaction.approved_by = user
            transaction.approved_at = timezone.now()
            transaction.save()

            branch = transaction.branch
            fund_filter = branch and {'branch': branch} or {}
            fund, _ = CashFund.objects.get_or_create(**fund_filter)
            fund.current_balance -= transaction.amount
            fund.save()

        log_action(
            user, 'create', 'Transaction', transaction.id,
            f"New transaction: PKR {transaction.amount} - {transaction.category.name}",
            self.request
        )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        if request.user.role not in ['branch_manager', 'accounts_head', 'finance_head']:
            return Response({'error': 'Permission denied'}, status=403)

        transaction = self.get_object()
        if transaction.approval_status != 'pending':
            return Response({'error': 'Transaction is not pending approval'}, status=400)

        # Branch managers can only approve their own branch's expenses
        if request.user.role == 'branch_manager' and transaction.branch != request.user.branch:
            return Response({'error': 'You can only approve expenses from your own branch'}, status=403)

        transaction.approval_status = 'approved'
        transaction.approved_by = request.user
        transaction.approved_at = timezone.now()
        transaction.save()

        # Deduct from fund
        branch = transaction.branch
        fund_filter = branch and {'branch': branch} or {}
        fund, _ = CashFund.objects.get_or_create(**fund_filter)
        fund.current_balance -= transaction.amount
        fund.save()

        # Update approval request
        ApprovalRequest.objects.filter(
            content_type='expense', object_id=transaction.id, status='pending'
        ).update(status='approved', approved_by=request.user, responded_at=timezone.now())

        log_action(request.user, 'approve', 'Transaction', transaction.id,
                    f"Approved expense PKR {transaction.amount}", request)

        create_notification(
            transaction.entered_by, 'approval_completed',
            'Expense Approved',
            f"Your expense PKR {transaction.amount} has been approved",
            f'/expenses'
        )

        return Response({'message': 'Transaction approved'})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        if request.user.role not in ['branch_manager', 'accounts_head', 'finance_head']:
            return Response({'error': 'Permission denied'}, status=403)

        transaction = self.get_object()
        if transaction.approval_status != 'pending':
            return Response({'error': 'Transaction is not pending approval'}, status=400)

        # Branch managers can only reject their own branch's expenses
        if request.user.role == 'branch_manager' and transaction.branch != request.user.branch:
            return Response({'error': 'You can only reject expenses from your own branch'}, status=403)

        reason = request.data.get('reason', '')
        transaction.approval_status = 'rejected'
        transaction.rejection_reason = reason
        transaction.save()

        ApprovalRequest.objects.filter(
            content_type='expense', object_id=transaction.id, status='pending'
        ).update(status='rejected', approved_by=request.user,
                 response_note=reason, responded_at=timezone.now())

        log_action(request.user, 'reject', 'Transaction', transaction.id,
                    f"Rejected expense PKR {transaction.amount}: {reason}", request)

        create_notification(
            transaction.entered_by, 'approval_completed',
            'Expense Rejected',
            f"Your expense PKR {transaction.amount} was rejected: {reason}",
            f'/expenses'
        )

        return Response({'message': 'Transaction rejected'})

    @action(detail=True, methods=['post'])
    def void(self, request, pk=None):
        if request.user.role not in ['accounts_head', 'branch_manager', 'finance_head']:
            return Response({'error': 'Permission denied'}, status=403)

        transaction = self.get_object()
        if transaction.is_void:
            return Response({'error': 'Transaction already voided'}, status=400)

        # Self-void prevention
        void_self_blocked = get_setting('self_void_blocked', True)
        if void_self_blocked and transaction.entered_by == request.user:
            return Response({'error': 'You cannot void your own transaction. Request another manager.'}, status=403)

        # Time window check
        void_window = get_setting('void_time_window_days', 30)
        if transaction.date:
            delta = (date.today() - transaction.date).days
            if delta > int(void_window):
                return Response({
                    'error': f'Cannot void transactions older than {void_window} days. Escalate to Finance Head.'
                }, status=400)

        reason = request.data.get('reason', '')
        if not reason:
            return Response({'error': 'Void reason is required'}, status=400)

        # Check if void needs approval
        void_requires_approval = get_setting('void_requires_approval', True)
        if void_requires_approval:
            ApprovalRequest.objects.create(
                content_type='void',
                object_id=transaction.id,
                requested_by=request.user,
                reason=reason
            )
            managers = User.objects.filter(
                role__in=['branch_manager', 'accounts_head', 'finance_head'],
                is_active=True
            ).exclude(id=request.user.id)
            for mgr in managers:
                create_notification(
                    mgr, 'approval_pending',
                    'Void Approval Required',
                    f"PKR {transaction.amount} void needs approval: {reason}",
                    f'/expenses'
                )
            return Response({'message': 'Void request submitted for approval'})

        # Direct void
        transaction.is_void = True
        transaction.void_reason = reason
        transaction.voided_by = request.user
        transaction.voided_at = timezone.now()
        transaction.save()

        branch = transaction.branch
        fund_filter = branch and {'branch': branch} or {}
        fund, _ = CashFund.objects.get_or_create(**fund_filter)
        fund.current_balance += transaction.amount
        fund.save()

        log_action(
            request.user, 'void', 'Transaction', transaction.id,
            f"Voided transaction PKR {transaction.amount}: {reason}",
            request
        )

        return Response({'message': 'Transaction voided successfully'})

    @action(detail=True, methods=['post'])
    def amend(self, request, pk=None):
        transaction = self.get_object()
        if transaction.is_void:
            return Response({'error': 'Cannot amend a voided transaction'}, status=400)

        original_amount = transaction.amount
        allowed_fields = ['amount', 'category', 'description', 'narration',
                         'program_tag', 'donor_fund_tag', 'payee', 'vendor_name']
        changes = {}

        for field in allowed_fields:
            if field in request.data:
                changes[field] = request.data[field]
                setattr(transaction, field, request.data[field])

        if not changes:
            return Response({'error': 'No changes provided'}, status=400)

        # If amount changes, route through approval
        if 'amount' in changes and Decimal(str(changes['amount'])) != original_amount:
            transaction.approval_status = 'pending'
            transaction.save()

            ApprovalRequest.objects.create(
                content_type='expense',
                object_id=transaction.id,
                requested_by=request.user,
                reason=f"Amendment: amount changed from PKR {original_amount} to PKR {changes['amount']}"
            )
        else:
            transaction.save()

        log_action(request.user, 'update', 'Transaction', transaction.id,
                    f"Amended transaction #{transaction.id}: {changes}", request)

        return Response({'message': 'Transaction amended'})


class ExpenseCategoryViewSet(viewsets.ModelViewSet):
    queryset = ExpenseCategory.objects.all()
    serializer_class = ExpenseCategorySerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsFinanceHeadOrAccountsHead()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return ExpenseCategory.objects.all().order_by('is_allowed', 'parent__name', 'name')


class FundTypeViewSet(viewsets.ModelViewSet):
    queryset = FundType.objects.all()
    serializer_class = FundTypeSerializer
    permission_classes = [IsAuthenticated, IsFinanceHeadOrAccountsHead]


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

    def perform_create(self, serializer):
        req = serializer.save(requested_by=self.request.user)
        log_action(self.request.user, 'create', 'ReplenishmentRequest', req.id,
                    f"Replenishment request: PKR {req.amount_requested}", self.request)

        # Notify finance head
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

    def perform_create(self, serializer):
        user_branch = get_user_branch(self.request.user)
        replenishment = serializer.save(
            added_by=self.request.user,
            branch=user_branch
        )

        branch = replenishment.branch
        fund_filter = branch and {'branch': branch} or {}
        fund, _ = CashFund.objects.get_or_create(**fund_filter)
        fund.current_balance += replenishment.amount
        fund.save()

        # If linked to a request, update it
        if replenishment.request:
            replenishment.request.status = 'completed'
            replenishment.request.save()

        log_action(
            self.request.user, 'replenish', 'Replenishment', replenishment.id,
            f"Fund replenished: PKR {replenishment.amount}. Ref: {replenishment.reference_number}",
            self.request
        )


class ApprovalRequestViewSet(viewsets.ModelViewSet):
    serializer_class = ApprovalRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = ApprovalRequest.objects.select_related(
            'requested_by', 'approved_by'
        ).all()
        # Branch managers only see their own branch's approval requests
        if user.role == 'branch_manager' and user.branch:
            expense_ids = Transaction.objects.filter(branch=user.branch).values('pk')
            replenishment_ids = ReplenishmentRequest.objects.filter(branch=user.branch).values('pk')
            from django.db.models import Q
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


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    def list(self, request):
        qs = self.get_queryset()
        unread_count = qs.filter(is_read=False).count()
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return Response({
                'unread_count': unread_count,
                'results': serializer.data
            })
        serializer = self.get_serializer(qs, many=True)
        return Response({'unread_count': unread_count, 'results': serializer.data})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({'message': 'All marked as read'})

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response({'message': 'Marked as read'})


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


class ReportTemplateViewSet(viewsets.ModelViewSet):
    queryset = ReportTemplate.objects.filter(is_active=True)
    serializer_class = ReportTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsFinanceHeadOrAccountsHead()]
        return [IsAuthenticated()]


class ReportGenerateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        template_id = request.data.get('template_id')
        filters = request.data.get('filters', {})

        template = ReportTemplate.objects.get(id=template_id, is_active=True)

        qs = Transaction.objects.select_related(
            'category', 'entered_by', 'approved_by', 'branch'
        )

        if filters.get('branch'):
            qs = qs.filter(branch_id=filters['branch'])
        if filters.get('program_tag'):
            qs = qs.filter(program_tag__icontains=filters['program_tag'])
        if filters.get('donor_fund_tag'):
            qs = qs.filter(donor_fund_tag__icontains=filters['donor_fund_tag'])
        if filters.get('category'):
            qs = qs.filter(category_id=filters['category'])
        if filters.get('date_from'):
            qs = qs.filter(date__gte=filters['date_from'])
        if filters.get('date_to'):
            qs = qs.filter(date__lte=filters['date_to'])
        if filters.get('amount_min'):
            qs = qs.filter(amount__gte=filters['amount_min'])
        if filters.get('amount_max'):
            qs = qs.filter(amount__lte=filters['amount_max'])
        if filters.get('approval_status'):
            qs = qs.filter(approval_status=filters['approval_status'])
        if filters.get('entered_by'):
            qs = qs.filter(entered_by_id=filters['entered_by'])
        if filters.get('payee'):
            qs = qs.filter(payee__icontains=filters['payee'])
        if filters.get('search'):
            qs = qs.filter(
                Q(description__icontains=filters['search']) |
                Q(narration__icontains=filters['search'])
            )

        user_branch = get_user_branch(request.user)
        if user_branch:
            qs = qs.filter(branch=user_branch)

        transactions = qs.order_by('-date')[:1000]

        total_amount = transactions.aggregate(total=Sum('amount'))['total'] or 0
        non_void_total = transactions.filter(is_void=False).aggregate(total=Sum('amount'))['total'] or 0

        report_data = {
            'report_name': template.name,
            'audience': template.get_audience_display(),
            'generated_at': timezone.now().isoformat(),
            'filters_applied': filters,
            'summary': {
                'total_transactions': transactions.count(),
                'total_amount': float(total_amount),
                'non_void_amount': float(non_void_total),
                'void_count': transactions.filter(is_void=True).count(),
            },
            'transactions': TransactionListSerializer(
                transactions, many=True, context={'request': request}
            ).data,
        }

        return Response(report_data)


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


class ExportCashbookView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        year = int(request.query_params.get('year', today.year))
        month = int(request.query_params.get('month', today.month))
        user_branch = get_user_branch(request.user)

        txn_filter = {'date__year': year, 'date__month': month}
        rep_filter = {'date__year': year, 'date__month': month}
        if user_branch:
            txn_filter['branch'] = user_branch
            rep_filter['branch'] = user_branch

        transactions = Transaction.objects.filter(**txn_filter).select_related(
            'category', 'branch', 'entered_by'
        )
        replenishments = Replenishment.objects.filter(**rep_filter).select_related(
            'branch', 'added_by'
        )

        wb = export_cashbook(transactions, replenishments, year, month)
        return _excel_response(wb, f'cashbook_{year}_{month:02d}.xlsx')


class ExportTransactionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        year = int(request.query_params.get('year', today.year))
        month = int(request.query_params.get('month', today.month))
        user_branch = get_user_branch(request.user)

        txn_filter = {'date__year': year, 'date__month': month}
        if user_branch:
            txn_filter['branch'] = user_branch

        transactions = Transaction.objects.filter(**txn_filter).select_related(
            'category', 'branch', 'entered_by'
        )

        wb = export_transactions(transactions)
        return _excel_response(wb, f'transactions_{year}_{month:02d}.xlsx')


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


def _excel_response(wb, filename):
    from django.http import HttpResponse
    response = HttpResponse(
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    wb.save(response)
    return response
