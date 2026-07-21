from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.db.models import Sum, Count, Q
from django.utils import timezone
from decimal import Decimal

from .models import ReportTemplate
from apps.expenses.models import Transaction
from .serializers import ReportTemplateSerializer, TransactionListSerializer
from petty_cash.permissions import IsFinanceHeadOrAccountsHead
from petty_cash.utils import get_user_branch


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

        agg = qs.aggregate(
            total_amount=Sum('amount'),
            non_void=Sum('amount', filter=Q(is_void=False)),
            txn_count=Count('id'),
            void_count=Count('id', filter=Q(is_void=True)),
        )

        transactions = qs.order_by('-date')[:1000]

        report_data = {
            'report_name': template.name,
            'audience': template.get_audience_display(),
            'generated_at': timezone.now().isoformat(),
            'filters_applied': filters,
            'summary': {
                'total_transactions': agg['txn_count'] or 0,
                'total_amount': float(agg['total_amount'] or 0),
                'non_void_amount': float(agg['non_void'] or 0),
                'void_count': agg['void_count'] or 0,
            },
            'transactions': TransactionListSerializer(
                transactions, many=True, context={'request': request}
            ).data,
        }

        return Response(report_data)
