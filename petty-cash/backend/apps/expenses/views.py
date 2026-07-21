from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.db.models import Q, Max
from django.utils import timezone
from datetime import date, datetime
from decimal import Decimal

from apps.accounts.models import Branch
from .models import ExpenseCategory, Transaction
from apps.accounts.models import User
from apps.funds.models import CashFund
from apps.approvals.models import ApprovalRequest
from .serializers import (
    ExpenseCategorySerializer, TransactionListSerializer,
    TransactionDetailSerializer, TransactionCreateSerializer
)
from petty_cash.permissions import (
    IsFinanceHeadOrAccountsHead, IsDataEntryOrAbove, IsBranchManagerOrAbove
)
from petty_cash.utils import log_action, get_user_branch, get_setting, create_notification, _excel_response
from petty_cash.exports import export_cashbook, export_transactions


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

    @staticmethod
    def _generate_cpv(branch):
        if not branch:
            return ''
        now = timezone.now()
        prefix = f"CPV-{branch.code}-{now:%Y%m}-"
        last = Transaction.objects.filter(cpv_number__startswith=prefix) \
            .aggregate(m=Max('cpv_number'))['m']
        seq = (int(last[-3:]) + 1) if last and len(last) >= 3 and last[-3:].isdigit() else 1
        return f"{prefix}{seq:03d}"

    def perform_create(self, serializer):
        user = self.request.user
        user_branch = get_user_branch(user)
        branch = user_branch
        if not branch:
            branch_id = self.request.data.get('branch')
            if branch_id:
                branch = Branch.objects.get(id=branch_id)
        cpv = self._generate_cpv(branch)
        transaction = serializer.save(
            entered_by=user,
            branch=branch,
            cpv_number=cpv
        )

        # Check approval threshold
        threshold = get_setting('expense_approval_threshold', 5000)
        user_limit = user.spending_limit

        if transaction.amount > Decimal(str(threshold)) or transaction.amount > user_limit:
            transaction.approval_status = 'pending'
            transaction.save()

            ApprovalRequest.objects.create(
                content_type='expense',
                object_id=transaction.id,
                requested_by=user,
                reason=f"Expense PKR {transaction.amount} exceeds threshold"
            )

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

        if request.user.role == 'branch_manager' and transaction.branch != request.user.branch:
            return Response({'error': 'You can only approve expenses from your own branch'}, status=403)

        transaction.approval_status = 'approved'
        transaction.approved_by = request.user
        transaction.approved_at = timezone.now()
        transaction.save()

        branch = transaction.branch
        fund_filter = branch and {'branch': branch} or {}
        fund, _ = CashFund.objects.get_or_create(**fund_filter)
        fund.current_balance -= transaction.amount
        fund.save()

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

        void_self_blocked = get_setting('self_void_blocked', True)
        if void_self_blocked and transaction.entered_by == request.user:
            return Response({'error': 'You cannot void your own transaction. Request another manager.'}, status=403)

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
        from apps.replenishment.models import Replenishment
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
