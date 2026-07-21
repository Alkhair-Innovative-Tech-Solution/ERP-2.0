from django.test import TestCase
from django.contrib.auth import get_user_model
from petty_cash.models import Branch, ExpenseCategory, CashFund, FundType
import json

User = get_user_model()

class APISmokeTest(TestCase):
    def setUp(self):
        # Create test data
        ft = FundType.objects.create(name='Petty Cash')
        branch = Branch.objects.create(name='Test Branch', code='TST')
        ExpenseCategory.objects.create(name='Test Cat', is_allowed=True, is_active=True)
        CashFund.objects.create(branch=branch, current_balance=10000, fund_type=ft)
        self.bm = User.objects.create_user(
            username='test_bm', password='test123',
            role='branch_manager', branch=branch
        )
        self.ah = User.objects.create_user(
            username='test_ah', password='test123',
            role='accounts_head'
        )
        self.fh = User.objects.create_user(
            username='test_fh', password='test123',
            role='finance_head'
        )

    def _auth(self, username):
        """Get JWT token and return auth header."""
        resp = self.client.post('/api/auth/login/', {
            'username': username, 'password': 'test123'
        }, content_type='application/json')
        token = resp.json()['access']
        return {'HTTP_AUTHORIZATION': f'Bearer {token}'}

    def test_all_endpoints(self):
        test_cases = [
            ('transactions_fh', '/api/transactions/', 'test_fh'),
            ('approvals_ah', '/api/approval-requests/', 'test_ah'),
            ('replenishments', '/api/replenishments/', 'test_fh'),
            ('fund_transfers', '/api/fund-transfers/', 'test_fh'),
            ('audit_logs', '/api/audit-logs/', 'test_fh'),
            ('notifications', '/api/notifications/', 'test_bm'),
            ('cash_funds', '/api/cash-fund/', 'test_fh'),
            ('categories', '/api/categories/', 'test_fh'),
            ('budgets', '/api/budgets/', 'test_fh'),
        ]
        failures = []
        for name, path, username in test_cases:
            headers = self._auth(username)
            resp = self.client.get(path, **headers)
            if resp.status_code == 404:
                resp = self.client.get(path.rstrip('/'), **headers)
            if resp.status_code != 200:
                failures.append(f'FAIL: {name} ({path}) returned {resp.status_code}')
        headers = self._auth('test_fh')
        resp = self.client.get('/api/dashboard/', **headers)
        if resp.status_code != 200:
            failures.append(f'FAIL: dashboard returned {resp.status_code}')
        self.assertEqual(len(failures), 0, '\n'.join(failures))
