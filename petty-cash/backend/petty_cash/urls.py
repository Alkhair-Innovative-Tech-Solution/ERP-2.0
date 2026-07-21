from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.accounts.views import (
    DashboardView, BranchViewSet, UserListView, UserDetailView, MeView,
)
from apps.expenses.views import (
    TransactionViewSet, ExpenseCategoryViewSet,
    ExportCashbookView, ExportTransactionsView,
)
from apps.settings.views import (
    MonthlyBudgetViewSet, SystemSettingViewSet, AuditLogViewSet,
)
from apps.funds.views import (
    FundTypeViewSet, CashFundView, CashFundAllView, FundTransferViewSet,
)
from apps.replenishment.views import (
    ReplenishmentViewSet, ReplenishmentRequestViewSet,
    ExportReplenishmentsView,
)
from apps.approvals.views import ApprovalRequestViewSet
from apps.notifications.views import NotificationViewSet
from apps.reports.views import ReportTemplateViewSet, ReportGenerateView

router = DefaultRouter()
router.register('transactions', TransactionViewSet, basename='transaction')
router.register('categories', ExpenseCategoryViewSet, basename='category')
router.register('budgets', MonthlyBudgetViewSet, basename='budget')
router.register('fund-types', FundTypeViewSet, basename='fundtype')
router.register('replenishments', ReplenishmentViewSet, basename='replenishment')
router.register('replenishment-requests', ReplenishmentRequestViewSet, basename='replenishmentrequest')
router.register('approval-requests', ApprovalRequestViewSet, basename='approvalrequest')
router.register('fund-transfers', FundTransferViewSet, basename='fundtransfer')
router.register('notifications', NotificationViewSet, basename='notification')
router.register('settings', SystemSettingViewSet, basename='setting')
router.register('report-templates', ReportTemplateViewSet, basename='reporttemplate')
router.register('audit-logs', AuditLogViewSet, basename='auditlog')
router.register('branches', BranchViewSet, basename='branch')

urlpatterns = [
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('cash-fund/', CashFundView.as_view(), name='cash-fund'),
    path('cash-fund/all/', CashFundAllView.as_view(), name='cash-fund-all'),
    path('users/', UserListView.as_view(), name='users'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user-detail'),
    path('me/', MeView.as_view(), name='me'),
    path('reports/generate/', ReportGenerateView.as_view(), name='report-generate'),
    path('export/cashbook/', ExportCashbookView.as_view(), name='export-cashbook'),
    path('export/transactions/', ExportTransactionsView.as_view(), name='export-transactions'),
    path('export/replenishments/', ExportReplenishmentsView.as_view(), name='export-replenishments'),
    path('', include(router.urls)),
]
