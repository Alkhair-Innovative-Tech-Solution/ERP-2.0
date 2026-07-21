from rest_framework.permissions import BasePermission


class IsFinanceHead(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'finance_head'


class IsAccountsHead(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'accounts_head'


class IsFinanceOrAccountsHead(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['finance_head', 'accounts_head']


class IsBranchManagerOrAbove(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['branch_manager', 'accounts_head', 'finance_head']


class IsAuditorOrAbove(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['auditor', 'branch_manager', 'accounts_head', 'finance_head']


class IsDataEntryOperator(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'data_entry_operator'


class IsDataEntryOrAbove(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['data_entry_operator', 'branch_manager', 'accounts_head', 'finance_head']


class IsFinanceHeadOrAccountsHead(BasePermission):
    """For settings/configuration changes"""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['finance_head', 'accounts_head']


class CanApproveExpense(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['branch_manager', 'accounts_head', 'finance_head']
