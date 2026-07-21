"""Generate state-only migration files for all new apps."""
import os
import django
from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
os.environ['DB_NAME'] = 'petty_cash_db'
os.environ['DB_USER'] = 'postgres'
os.environ['DB_PASSWORD'] = 'postgres'
os.environ['DB_HOST'] = 'localhost'
os.environ['DB_PORT'] = '5432'
os.environ['CORS_ALLOWED_ORIGINS'] = 'http://localhost:3000'
os.environ['SECRET_KEY'] = 'dev-key-for-migration-gen'

import django
django.setup()

from django.db.migrations.writer import MigrationWriter
from django.db.migrations.migration import Migration
from django.db.migrations.state import ModelState
from django.db.migrations import operations
from django.db import models
from decimal import Decimal

APP_MODELS = {
    'accounts': [
        ModelState('accounts', 'Branch', [
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('type', models.CharField(max_length=20, choices=[('head_office', 'Head Office'), ('school', 'School Campus'), ('college', 'College'), ('hospital', 'Hospital'), ('medical_center', 'Medical Center'), ('it_institute', 'IT Institute')])),
            ('name', models.CharField(max_length=200)),
            ('code', models.CharField(max_length=20, unique=True)),
            ('location', models.CharField(blank=True, max_length=255)),
            ('contact', models.CharField(blank=True, max_length=20)),
            ('address', models.TextField(blank=True)),
            ('contact_person', models.CharField(blank=True, max_length=200)),
            ('contact_email', models.EmailField(blank=True)),
            ('is_head_office', models.BooleanField(default=False)),
            ('is_active', models.BooleanField(default=True)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
        ], options={'db_table': 'branches', 'ordering': ['name']}, bases=(models.Model,)),
        ModelState('accounts', 'User', [
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('password', models.CharField(max_length=128, verbose_name='password')),
            ('last_login', models.DateTimeField(blank=True, null=True, verbose_name='last login')),
            ('is_superuser', models.BooleanField(default=False)),
            ('username', models.CharField(max_length=150, unique=True)),
            ('first_name', models.CharField(blank=True, max_length=150)),
            ('last_name', models.CharField(blank=True, max_length=150)),
            ('email', models.EmailField(blank=True, max_length=254)),
            ('is_staff', models.BooleanField(default=False)),
            ('is_active', models.BooleanField(default=True)),
            ('date_joined', models.DateTimeField(default=django.utils.timezone.now)),
            ('role', models.CharField(max_length=20, choices=[('finance_head', 'Finance Head'), ('accounts_head', 'Accounts Head'), ('branch_manager', 'Branch Manager'), ('data_entry_operator', 'Data Entry Operator'), ('program_officer', 'Program Officer'), ('auditor', 'Auditor / Reviewer')], default='branch_manager')),
            ('department', models.CharField(blank=True, max_length=100)),
            ('employee_id', models.CharField(blank=True, max_length=50, null=True, unique=True)),
            ('phone', models.CharField(blank=True, max_length=20)),
            ('spending_limit', models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('5000.00'))),
            ('branch', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='users', to='accounts.branch')),
            ('groups', models.ManyToManyField(blank=True, to='auth.group')),
            ('user_permissions', models.ManyToManyField(blank=True, to='auth.permission')),
        ], options={'db_table': 'users'}, bases=(django.contrib.auth.models.AbstractUser,)),
    ],
    'expenses': [
        ModelState('expenses', 'ExpenseCategory', [
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('name', models.CharField(max_length=100)),
            ('description', models.TextField(blank=True)),
            ('category_type', models.CharField(max_length=20, choices=[('general', 'General'), ('operational', 'Operational'), ('program', 'Program Specific')], default='general')),
            ('parent', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='subcategories', to='expenses.expensecategory')),
            ('is_allowed', models.BooleanField(default=True)),
            ('monthly_limit', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('is_active', models.BooleanField(default=True)),
        ], options={'db_table': 'expense_categories', 'verbose_name_plural': 'Expense Categories', 'ordering': ['name']}, bases=(models.Model,)),
        ModelState('expenses', 'Transaction', [
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('date', models.DateField()),
            ('amount', models.DecimalField(decimal_places=2, max_digits=10)),
            ('description', models.TextField()),
            ('narration', models.TextField(blank=True)),
            ('payee', models.CharField(blank=True, max_length=200)),
            ('program_tag', models.CharField(blank=True, max_length=100)),
            ('donor_fund_tag', models.CharField(blank=True, max_length=100)),
            ('payment_method', models.CharField(max_length=20, choices=[('cash', 'Cash'), ('bank_transfer', 'Bank Transfer'), ('cheque', 'Cheque')], default='cash')),
            ('receipt', models.FileField(blank=True, null=True, upload_to='receipts/%Y/%m/')),
            ('vendor_name', models.CharField(blank=True, max_length=200)),
            ('approval_status', models.CharField(max_length=20, choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='approved')),
            ('approved_at', models.DateTimeField(blank=True, null=True)),
            ('rejection_reason', models.TextField(blank=True)),
            ('is_void', models.BooleanField(default=False)),
            ('void_reason', models.TextField(blank=True)),
            ('voided_at', models.DateTimeField(blank=True, null=True)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('updated_at', models.DateTimeField(auto_now=True)),
            ('category', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='transactions', to='expenses.expensecategory')),
            ('budget', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='transactions', to='settings.monthlybudget')),
            ('entered_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='transactions_entered', to='accounts.user')),
            ('branch', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='transactions', to='accounts.branch')),
            ('approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='transactions_approved', to='accounts.user')),
            ('voided_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='transactions_voided', to='accounts.user')),
        ], options={'db_table': 'transactions', 'ordering': ['-date', '-created_at']}, bases=(models.Model,)),
    ],
    'funds': [
        ModelState('funds', 'FundType', [
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('name', models.CharField(max_length=100)),
            ('code', models.CharField(max_length=20, unique=True)),
            ('description', models.TextField(blank=True)),
            ('category', models.CharField(max_length=20, choices=[('operational', 'Operational'), ('program', 'Program Fund'), ('donor_restricted', 'Donor-Restricted Fund'), ('emergency', 'Emergency Fund'), ('project', 'Project Fund')])),
            ('is_active', models.BooleanField(default=True)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
        ], options={'db_table': 'fund_types', 'ordering': ['name']}, bases=(models.Model,)),
        ModelState('funds', 'CashFund', [
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('current_balance', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=12)),
            ('low_balance_threshold', models.DecimalField(decimal_places=2, default=Decimal('5000.00'), max_digits=10)),
            ('program_tag', models.CharField(blank=True, max_length=100)),
            ('donor_source', models.CharField(blank=True, max_length=200)),
            ('annual_budget', models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
            ('max_balance_limit', models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
            ('start_date', models.DateField(blank=True, null=True)),
            ('end_date', models.DateField(blank=True, null=True)),
            ('status', models.CharField(max_length=20, choices=[('active', 'Active'), ('suspended', 'Suspended'), ('archived', 'Archived')], default='active')),
            ('updated_at', models.DateTimeField(auto_now=True)),
            ('fund_type', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='cash_funds', to='funds.fundtype')),
            ('branch', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='cash_funds', to='accounts.branch')),
        ], options={'db_table': 'cash_fund'}, bases=(models.Model,)),
        ModelState('funds', 'FundTransfer', [
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
            ('reason', models.TextField()),
            ('status', models.CharField(max_length=20, choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected'), ('completed', 'Completed')], default='pending')),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('completed_at', models.DateTimeField(blank=True, null=True)),
            ('source_fund', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='transfers_out', to='funds.cashfund')),
            ('destination_fund', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='transfers_in', to='funds.cashfund')),
            ('requested_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='transfers_requested', to='accounts.user')),
            ('approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='transfers_approved', to='accounts.user')),
        ], options={'db_table': 'fund_transfers', 'ordering': ['-created_at']}, bases=(models.Model,)),
    ],
    'settings': [
        ModelState('settings', 'MonthlyBudget', [
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('year', models.IntegerField()),
            ('month', models.IntegerField()),
            ('total_budget', models.DecimalField(decimal_places=2, max_digits=12)),
            ('department', models.CharField(blank=True, default='General', max_length=100)),
            ('notes', models.TextField(blank=True)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('updated_at', models.DateTimeField(auto_now=True)),
            ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='budgets_created', to='accounts.user')),
            ('branch', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='budgets', to='accounts.branch')),
        ], options={'db_table': 'monthly_budgets', 'unique_together': {('year', 'month', 'department', 'branch')}, 'ordering': ['-year', '-month']}, bases=(models.Model,)),
        ModelState('settings', 'SystemSetting', [
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('key', models.CharField(max_length=100, unique=True)),
            ('value', models.JSONField()),
            ('value_type', models.CharField(max_length=20, choices=[('string', 'String'), ('number', 'Number'), ('boolean', 'Boolean'), ('json', 'JSON')], default='string')),
            ('description', models.TextField(blank=True)),
            ('is_active', models.BooleanField(default=True)),
            ('updated_at', models.DateTimeField(auto_now=True)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='settings_updated', to='accounts.user')),
        ], options={'db_table': 'system_settings', 'ordering': ['key']}, bases=(models.Model,)),
        ModelState('settings', 'AuditLog', [
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('action', models.CharField(max_length=20, choices=[('create', 'Created'), ('update', 'Updated'), ('void', 'Voided'), ('login', 'Login'), ('replenish', 'Replenished'), ('budget_set', 'Budget Set'), ('settings_change', 'Settings Change'), ('approve', 'Approved'), ('reject', 'Rejected'), ('transfer', 'Fund Transfer')])),
            ('model_name', models.CharField(max_length=50)),
            ('object_id', models.IntegerField(blank=True, null=True)),
            ('description', models.TextField()),
            ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
            ('timestamp', models.DateTimeField(auto_now_add=True)),
            ('user', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='accounts.user')),
        ], options={'db_table': 'audit_logs', 'ordering': ['-timestamp']}, bases=(models.Model,)),
    ],
    'replenishment': [
        ModelState('replenishment', 'ReplenishmentRequest', [
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('amount_requested', models.DecimalField(decimal_places=2, max_digits=12)),
            ('reason', models.TextField()),
            ('program_tag', models.CharField(blank=True, max_length=100)),
            ('status', models.CharField(max_length=20, choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected'), ('cancelled', 'Cancelled')], default='pending')),
            ('approved_at', models.DateTimeField(blank=True, null=True)),
            ('rejection_reason', models.TextField(blank=True)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('updated_at', models.DateTimeField(auto_now=True)),
            ('branch', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='replenishment_requests', to='accounts.branch')),
            ('fund', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='replenishment_requests', to='funds.cashfund')),
            ('requested_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='replenishment_requests', to='accounts.user')),
            ('approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='replenishment_approvals', to='accounts.user')),
        ], options={'db_table': 'replenishment_requests', 'ordering': ['-created_at']}, bases=(models.Model,)),
        ModelState('replenishment', 'Replenishment', [
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('amount', models.DecimalField(decimal_places=2, max_digits=10)),
            ('date', models.DateField()),
            ('reference_number', models.CharField(blank=True, max_length=100)),
            ('source_bank_account', models.CharField(blank=True, max_length=100)),
            ('donor_fund_tag', models.CharField(blank=True, max_length=100)),
            ('transfer_proof', models.FileField(blank=True, null=True, upload_to='transfers/%Y/%m/')),
            ('notes', models.TextField(blank=True)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('request', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='replenishments', to='replenishment.replenishmentrequest')),
            ('added_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='replenishments', to='accounts.user')),
            ('approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='replenishments_approved', to='accounts.user')),
            ('branch', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='replenishments', to='accounts.branch')),
        ], options={'db_table': 'replenishments', 'ordering': ['-date']}, bases=(models.Model,)),
    ],
    'approvals': [
        ModelState('approvals', 'ApprovalRequest', [
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('content_type', models.CharField(max_length=30, choices=[('expense', 'Expense'), ('void', 'Void'), ('replenishment', 'Replenishment')])),
            ('object_id', models.IntegerField()),
            ('status', models.CharField(max_length=20, choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='pending')),
            ('reason', models.TextField(blank=True)),
            ('response_note', models.TextField(blank=True)),
            ('requested_at', models.DateTimeField(auto_now_add=True)),
            ('responded_at', models.DateTimeField(blank=True, null=True)),
            ('requested_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='approvals_requested', to='accounts.user')),
            ('approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='approvals_given', to='accounts.user')),
        ], options={'db_table': 'approval_requests', 'ordering': ['-requested_at']}, bases=(models.Model,)),
    ],
    'notifications': [
        ModelState('notifications', 'Notification', [
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('notif_type', models.CharField(max_length=30, choices=[('low_balance', 'Low Balance'), ('approval_pending', 'Approval Pending'), ('approval_completed', 'Approval Completed'), ('void_completed', 'Void Completed'), ('replenishment_completed', 'Replenishment Completed'), ('replenishment_request', 'Replenishment Request'), ('expense_submitted', 'Expense Submitted'), ('settings_change', 'Settings Change'), ('transfer_completed', 'Transfer Completed'), ('transfer_initiated', 'Transfer Initiated')])),
            ('title', models.CharField(max_length=200)),
            ('message', models.TextField()),
            ('link', models.CharField(blank=True, max_length=500)),
            ('is_read', models.BooleanField(default=False)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('recipient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notifications', to='accounts.user')),
        ], options={'db_table': 'notifications', 'ordering': ['-created_at']}, bases=(models.Model,)),
    ],
    'reports': [
        ModelState('reports', 'ReportTemplate', [
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('name', models.CharField(max_length=200)),
            ('audience', models.CharField(max_length=20, choices=[('donor', 'Donor Report'), ('management', 'Management Summary'), ('audit', 'Audit Trail Report'), ('branch', 'Branch Report'), ('program', 'Program Report')])),
            ('config', models.JSONField(default=dict)),
            ('is_active', models.BooleanField(default=True)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('updated_at', models.DateTimeField(auto_now=True)),
            ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='report_templates', to='accounts.user')),
        ], options={'db_table': 'report_templates', 'ordering': ['name']}, bases=(models.Model,)),
    ],
}

import django.utils.timezone
import django.contrib.auth.models

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

for app_label, models_list in APP_MODELS.items():
    state_ops = []
    for model_state in models_list:
        state_ops.append(operations.CreateModel(
            name=model_state.name,
            fields=[(n, f.clone()) for n, f in model_state.fields],
            options=model_state.options,
            bases=model_state.bases,
        ))

    migration = Migration(app_label, '0001_initial')
    migration.operations = [
        operations.SeparateDatabaseAndState(
            state_operations=state_ops,
            database_operations=[],
        )
    ]
    migration.initial = True

    writer = MigrationWriter(migration)
    content = writer.as_string()

    app_dir = os.path.join(BASE_DIR, 'apps', app_label, 'migrations')
    os.makedirs(app_dir, exist_ok=True)
    filepath = os.path.join(app_dir, '0001_initial.py')
    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Written: {filepath}")

print("Done!")
