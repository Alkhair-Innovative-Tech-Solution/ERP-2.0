import random
from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from apps.accounts.models import User, Branch
from apps.expenses.models import ExpenseCategory, Transaction
from apps.funds.models import CashFund, FundType, FundTransfer
from apps.settings.models import MonthlyBudget, SystemSetting, AuditLog
from apps.replenishment.models import Replenishment, ReplenishmentRequest
from apps.approvals.models import ApprovalRequest
from apps.notifications.models import Notification
from apps.reports.models import ReportTemplate


class Command(BaseCommand):
    help = 'Seed initial data for NGO expense system'

    def add_arguments(self, parser):
        parser.add_argument('--check-first', action='store_true', help='Skip if data already exists')

    def handle(self, *args, **kwargs):
        if kwargs.get('check_first') and User.objects.exists():
            self.stdout.write(self.style.SUCCESS('Data already exists, skipping seed.'))
            return
        self.stdout.write('Seeding data...')

        # Create branches
        branches_data = [
            ('head_office', 'Head Office', 'HQ', 'Main City', '021-1111111'),
            ('school', 'School Campus 1 - Alpha', 'SCH01', 'Area A', '021-1111112'),
            ('school', 'School Campus 2 - Beta', 'SCH02', 'Area B', '021-1111113'),
            ('school', 'School Campus 3 - Gamma', 'SCH03', 'Area C', '021-1111114'),
            ('school', 'School Campus 4 - Delta', 'SCH04', 'Area D', '021-1111115'),
            ('school', 'School Campus 5 - Epsilon', 'SCH05', 'Area E', '021-1111116'),
            ('school', 'School Campus 6 - Zeta', 'SCH06', 'Area F', '021-1111117'),
            ('school', 'School Campus 7 - Eta', 'SCH07', 'Area G', '021-1111118'),
            ('school', 'School Campus 8 - Theta', 'SCH08', 'Area H', '021-1111119'),
            ('college', 'National College', 'COL01', 'City Center', '021-1111120'),
            ('hospital', 'Al-Shifa Hospital', 'HOS01', 'Sector A', '021-1111121'),
            ('medical_center', 'Community Medical Center', 'MED01', 'Sector B', '021-1111122'),
            ('it_institute', 'Tech Institute of IT', 'IT01', 'Tech Park', '021-1111123'),
        ]

        created_branches = {}
        for btype, name, code, loc, contact in branches_data:
            branch, created = Branch.objects.get_or_create(
                code=code,
                defaults={
                    'type': btype, 'name': name,
                    'location': loc, 'contact': contact
                }
            )
            created_branches[code] = branch
            if created:
                self.stdout.write(f"  Created branch: {name} ({code})")

        # Create users
        users_data = [
            {
                'username': 'accounts_head', 'password': 'Admin@1234',
                'first_name': 'Ahmed', 'last_name': 'Khan',
                'email': 'accounts@ngo.com', 'role': 'accounts_head',
                'department': 'Finance', 'employee_id': 'EMP001',
                'branch': None,
            },
            {
                'username': 'manager_hq', 'password': 'Admin@1234',
                'first_name': 'Sara', 'last_name': 'Malik',
                'email': 'hq@ngo.com', 'role': 'branch_manager',
                'department': 'Admin', 'employee_id': 'EMP002',
                'branch': 'HQ',
            },
            {
                'username': 'manager_sch01', 'password': 'Admin@1234',
                'first_name': 'Usman', 'last_name': 'Ali',
                'email': 'sch01@ngo.com', 'role': 'branch_manager',
                'department': 'Admin', 'employee_id': 'EMP003',
                'branch': 'SCH01',
            },
            {
                'username': 'manager_hos01', 'password': 'Admin@1234',
                'first_name': 'Fatima', 'last_name': 'Zahra',
                'email': 'hos01@ngo.com', 'role': 'branch_manager',
                'department': 'Admin', 'employee_id': 'EMP004',
                'branch': 'HOS01',
            },
            {
                'username': 'auditor1', 'password': 'Admin@1234',
                'first_name': 'Ali', 'last_name': 'Hassan',
                'email': 'auditor@ngo.com', 'role': 'auditor',
                'department': 'Finance', 'employee_id': 'EMP005',
                'branch': None,
            },
        ]

        for u in users_data:
            if not User.objects.filter(username=u['username']).exists():
                branch_code = u['branch']
                branch = created_branches.get(branch_code) if branch_code else None
                User.objects.create(
                    username=u['username'],
                    first_name=u['first_name'],
                    last_name=u['last_name'],
                    email=u['email'],
                    role=u['role'],
                    department=u['department'],
                    employee_id=u['employee_id'],
                    spending_limit=u.get('spending_limit', 5000),
                    password=make_password('Admin@1234'),
                    branch=branch,
                )
                self.stdout.write(f"  Created user: {u['username']}")

        # New role users
        new_users = [
            {
                'username': 'finance_head', 'password': 'Admin@1234',
                'first_name': 'Omar', 'last_name': 'Hashmi',
                'email': 'finance@ngo.com', 'role': 'finance_head',
                'department': 'Finance', 'employee_id': 'EMP006',
                'spending_limit': 100000,
                'branch': None,
            },
            {
                'username': 'data_entry', 'password': 'Admin@1234',
                'first_name': 'Zain', 'last_name': 'Ahmed',
                'email': 'dataentry@ngo.com', 'role': 'data_entry_operator',
                'department': 'Admin', 'employee_id': 'EMP007',
                'spending_limit': 3000,
                'branch': 'HQ',
            },
            {
                'username': 'program_officer', 'password': 'Admin@1234',
                'first_name': 'Hina', 'last_name': 'Rizvi',
                'email': 'programs@ngo.com', 'role': 'program_officer',
                'department': 'Programs', 'employee_id': 'EMP008',
                'spending_limit': 0,
                'branch': None,
            },
        ]

        for u in new_users:
            if not User.objects.filter(username=u['username']).exists():
                branch_code = u.get('branch')
                branch = created_branches.get(branch_code) if branch_code else None
                User.objects.create(
                    username=u['username'],
                    first_name=u['first_name'],
                    last_name=u['last_name'],
                    email=u['email'],
                    role=u['role'],
                    department=u['department'],
                    employee_id=u['employee_id'],
                    spending_limit=u.get('spending_limit', 5000),
                    password=make_password('Admin@1234'),
                    branch=branch,
                )
                self.stdout.write(f"  Created user: {u['username']}")

        # Categories
        allowed = [
            ('Stationery', 'Pens, papers, files, registers'),
            ('Refreshments', 'Tea, coffee, water'),
            ('Local Transport', 'Rickshaw, bus fare, fuel'),
            ('Photocopy & Printing', 'Photocopy and printing'),
            ('Postage & Courier', 'Courier and postage'),
            ('Minor Repairs', 'Small repairs and hardware'),
            ('Cleaning Supplies', 'Cleaning material'),
            ('Staff Meal Allowance', 'Emergency meal allowance'),
            ('Medicine / First Aid', 'First aid items'),
        ]
        not_allowed = [
            ('Salary / Wages', 'Employee salary payments'),
            ('Vendor Payments', 'Supplier bills'),
            ('Equipment Purchase', 'Major equipment'),
            ('Rent / Utilities', 'Rent, electricity, gas'),
            ('Advance Salary', 'Advance to employees'),
            ('Personal Expenses', 'Personal use'),
        ]

        for name, desc in allowed:
            ExpenseCategory.objects.get_or_create(
                name=name, defaults={'description': desc, 'is_allowed': True}
            )
        for name, desc in not_allowed:
            ExpenseCategory.objects.get_or_create(
                name=name, defaults={'description': desc, 'is_allowed': False, 'is_active': False}
            )

        # Fund types
        fund_types = [
            ('Operational Fund', 'OPR', 'Day-to-day branch running costs', 'operational'),
            ('Program Fund', 'PRG', 'Tied to specific programs', 'program'),
            ('Donor-Restricted Fund', 'DON', 'Donor-specific spending', 'donor_restricted'),
            ('Emergency Fund', 'EMG', 'Reserve for emergencies', 'emergency'),
            ('Project Fund', 'PRJ', 'Time-bound project budget', 'project'),
        ]
        for name, code, desc, cat in fund_types:
            FundType.objects.get_or_create(
                code=code, defaults={'name': name, 'description': desc, 'category': cat}
            )

        # System settings (configurable controls)
        default_settings = [
            ('expense_approval_threshold', 5000, 'number', 'Amount above which expense requires approval (PKR)'),
            ('void_requires_approval', True, 'boolean', 'Whether voids require manager approval'),
            ('void_time_window_days', 30, 'number', 'Maximum days from transaction date to void'),
            ('self_void_blocked', True, 'boolean', 'Block users from voiding their own transactions'),
            ('max_single_expense', 50000, 'number', 'Hard limit on single expense amount (PKR)'),
            ('low_balance_alert_threshold', 2000, 'number', 'Alert when any fund falls below this (PKR)'),
            ('max_replenishment_per_transaction', 50000, 'number', 'Max single replenishment amount (PKR)'),
            ('max_replenishment_per_month', 150000, 'number', 'Max total replenishment per month per fund (PKR)'),
            ('alert_low_balance_roles', 'branch_manager,finance_head', 'string', 'Roles notified on low balance (comma-separated)'),
            ('alert_low_balance_frequency', 'instant', 'string', 'Low balance alert frequency: instant or daily'),
            ('self_approve_allowed', False, 'boolean', 'Allow users to approve their own expenses'),
            ('session_timeout_minutes', 60, 'number', 'Inactive session timeout in minutes'),
        ]
        for key, value, vtype, desc in default_settings:
            SystemSetting.objects.get_or_create(
                key=key, defaults={'value': value, 'value_type': vtype, 'description': desc}
            )

        # Cash fund per branch
        for code, branch in created_branches.items():
            fund_type = FundType.objects.filter(code='OPR').first()
            CashFund.objects.get_or_create(
                branch=branch,
                defaults={
                    'current_balance': 50000,
                    'low_balance_threshold': 5000,
                    'fund_type': fund_type,
                }
            )

        # ---- Transactions, Budgets, Replenishments ----
        today = date.today()
        year, month = today.year, today.month
        users = {u.username: u for u in User.objects.all()}
        categories = list(ExpenseCategory.objects.filter(is_allowed=True))
        accounts_head = users.get('accounts_head')
        hq_manager = users.get('manager_hq')
        sch01_manager = users.get('manager_sch01')
        hos01_manager = users.get('manager_hos01')

        # Budgets for current month per branch
        budget_amounts = {
            'HQ': 150000, 'SCH01': 80000, 'SCH02': 75000, 'SCH03': 70000,
            'SCH04': 65000, 'SCH05': 60000, 'SCH06': 55000, 'SCH07': 50000,
            'SCH08': 45000, 'COL01': 120000, 'HOS01': 200000, 'MED01': 100000,
            'IT01': 90000,
        }
        budget_objects = {}
        for code, branch in created_branches.items():
            amt = budget_amounts.get(code, 50000)
            budget, created = MonthlyBudget.objects.get_or_create(
                year=year, month=month, branch=branch, department='General',
                defaults={
                    'total_budget': amt,
                    'notes': f'Monthly budget for {branch.name} - {month}/{year}',
                    'created_by': accounts_head,
                }
            )
            budget_objects[code] = budget
            if created:
                self.stdout.write(f"  Created budget for {branch.name}: PKR {amt:,}")

        # Realistic expense entries per branch
        expense_sets = {
            'HQ': [
                ('Stationery', 2500, 'Office stationery supplies'),
                ('Refreshments', 3500, 'Staff meeting refreshments'),
                ('Photocopy & Printing', 1800, 'Report printing and binding'),
                ('Local Transport', 1200, 'Courier delivery rounds'),
                ('Postage & Courier', 850, 'Registered post documents'),
                ('Cleaning Supplies', 2200, 'Monthly cleaning supplies'),
                ('Minor Repairs', 4500, 'AC maintenance'),
            ],
            'SCH01': [
                ('Stationery', 5200, 'Exam papers and registers'),
                ('Refreshments', 2800, 'Staff tea and biscuits'),
                ('Local Transport', 1500, 'School van fuel top-up'),
                ('Photocopy & Printing', 3200, 'Worksheet photocopying'),
                ('Cleaning Supplies', 1800, 'Classroom cleaning material'),
                ('Minor Repairs', 3500, 'Desk and chair repairs'),
            ],
            'SCH02': [
                ('Stationery', 4800, 'Notebooks and pens'),
                ('Refreshments', 2500, 'Staff refreshments'),
                ('Local Transport', 1200, 'Student transport fuel'),
                ('Photocopy & Printing', 2800, 'Exam paper printing'),
                ('Cleaning Supplies', 1500, 'Cleaning supplies'),
                ('Staff Meal Allowance', 3000, 'Staff lunch allowance'),
            ],
            'SCH03': [
                ('Stationery', 4100, 'Teaching materials'),
                ('Refreshments', 2200, 'Staff tea supplies'),
                ('Local Transport', 1800, 'Field trip transport'),
                ('Photocopy & Printing', 2500, 'Student worksheets'),
                ('Minor Repairs', 2800, 'Fan repairs'),
            ],
            'SCH04': [
                ('Stationery', 3800, 'Office supplies'),
                ('Refreshments', 2000, 'Staff beverages'),
                ('Local Transport', 1600, 'Bus fuel'),
                ('Photocopy & Printing', 2200, 'Test papers'),
                ('Cleaning Supplies', 1200, 'Sanitization supplies'),
            ],
            'SCH05': [
                ('Stationery', 3500, 'General stationery'),
                ('Refreshments', 2400, 'Staff tea'),
                ('Local Transport', 1400, 'Transport expenses'),
                ('Photocopy & Printing', 2000, 'Copying charges'),
                ('Minor Repairs', 3200, 'Plumbing repairs'),
            ],
            'SCH06': [
                ('Stationery', 3000, 'Registers and forms'),
                ('Refreshments', 1800, 'Staff refreshments'),
                ('Local Transport', 1000, 'Local travel'),
                ('Photocopy & Printing', 2600, 'Printing charges'),
                ('Cleaning Supplies', 900, 'Cleaning items'),
            ],
            'SCH07': [
                ('Stationery', 2800, 'School stationery'),
                ('Refreshments', 1600, 'Staff tea'),
                ('Local Transport', 900, 'Transport'),
                ('Photocopy & Printing', 1800, 'Photocopy'),
                ('Minor Repairs', 2500, 'Gate repairs'),
            ],
            'SCH08': [
                ('Stationery', 2500, 'Basic stationery'),
                ('Refreshments', 1500, 'Staff tea/snacks'),
                ('Local Transport', 800, 'Local transport'),
                ('Photocopy & Printing', 1500, 'Copying'),
                ('Cleaning Supplies', 700, 'Cleaning'),
            ],
            'COL01': [
                ('Stationery', 6000, 'Lab registers and stationery'),
                ('Refreshments', 4000, 'Faculty meeting refreshments'),
                ('Local Transport', 2500, 'College bus fuel'),
                ('Photocopy & Printing', 4500, 'Exam paper bundles'),
                ('Postage & Courier', 1200, 'Admission letter courier'),
                ('Minor Repairs', 5500, 'Lab equipment repair'),
                ('Medicine / First Aid', 1500, 'First aid kit refill'),
            ],
            'HOS01': [
                ('Medicine / First Aid', 15000, 'Emergency medicine restock'),
                ('Cleaning Supplies', 8000, 'Hospital-grade disinfectants'),
                ('Stationery', 3500, 'Patient record registers'),
                ('Staff Meal Allowance', 6000, 'On-duty staff meals'),
                ('Local Transport', 3000, 'Ambulance fuel'),
            ],
            'MED01': [
                ('Medicine / First Aid', 8000, 'Clinic medicine supply'),
                ('Cleaning Supplies', 3500, 'Clinic sanitization'),
                ('Stationery', 2500, 'Patient records'),
                ('Staff Meal Allowance', 4000, 'Staff meals'),
                ('Refreshments', 2000, 'Patient waiting area water'),
            ],
            'IT01': [
                ('Stationery', 3000, 'Lab stationery'),
                ('Refreshments', 2500, 'Staff refreshments'),
                ('Local Transport', 1500, 'Transport'),
                ('Minor Repairs', 4500, 'Computer repairs'),
                ('Photocopy & Printing', 2200, 'Certificates printing'),
            ],
        }

        # Distribute expenses across last 20 days
        day_offset = 0
        tx_count = 0
        for code, branch in created_branches.items():
            branch_manager_map = {'HQ': hq_manager, 'SCH01': sch01_manager, 'HOS01': hos01_manager}
            manager = branch_manager_map.get(code, sch01_manager)
            expenses = expense_sets.get(code, [])
            for cat_name, amount, desc in expenses:
                cat = next((c for c in categories if c.name == cat_name), None)
                if not cat:
                    continue
                tx_date = today - timedelta(days=day_offset % 20 + 1)
                budget = budget_objects[code]
                Transaction.objects.get_or_create(
                    date=tx_date,
                    amount=amount,
                    category=cat,
                    budget=budget,
                    branch=branch,
                    description=desc,
                    entered_by=manager,
                    defaults={
                        'vendor_name': random.choice(['Local Vendor', 'Stationery Mart', 'Al-Rehman Store', 'City Traders']),
                    }
                )
                tx_count += 1
                day_offset += 1

            # subtract expenses from cash fund
            total_spent = sum(a for _, a, _ in expenses)
            try:
                cf = CashFund.objects.get(branch=branch)
                cf.current_balance = Decimal(str(max(50000 - total_spent, 0)))
                cf.save()
            except CashFund.DoesNotExist:
                pass

        self.stdout.write(f"  Created {tx_count} transactions across branches")

        # ---- New transaction fields (narration, payee, program/donor tags) ----
        programs = ['STEAM', 'Roti Bank', 'Empower Her', 'Clean Water', 'Adult Literacy']
        donors = ['UNICEF-2024', 'USAID-PAK-2025', 'WHO-HEALTH-24', 'WFP-NUTRITION', 'ADB-EDUCATION']
        payment_methods = ['cash', 'bank_transfer', 'cheque']
        vendors = ['Local Vendor', 'Stationery Mart', 'Al-Rehman Store', 'City Traders', 'Al-Falah Suppliers']
        payees = ['Mr. Ahmed', 'Ms. Fatima', 'Al-Rehman Store', 'City Traders', 'Fuel Station']

        # Update some existing transactions with new fields
        all_txns = list(Transaction.objects.all())
        for i, txn in enumerate(all_txns):
            if not txn.narration:
                txn.narration = f"Additional notes: {txn.description}"
                txn.payee = random.choice(payees)
                txn.program_tag = random.choice(programs)
                txn.donor_fund_tag = random.choice(donors)
                txn.payment_method = random.choice(payment_methods)
                txn.vendor_name = txn.vendor_name or random.choice(vendors)
                txn.save()

        # Create some pending (above-threshold) expenses that need approval
        pending_tx_count = 0
        for code in ['HQ', 'SCH01', 'COL01', 'HOS01']:
            branch = created_branches[code]
            cat = random.choice(categories)
            tx_date = today - timedelta(days=random.randint(1, 5))
            budget = budget_objects[code]
            txn, created = Transaction.objects.get_or_create(
                date=tx_date,
                amount=12000,
                category=cat,
                budget=budget,
                branch=branch,
                description=f'High-value expense requiring approval at {branch.name}',
                entered_by=users.get('accounts_head'),
                defaults={
                    'vendor_name': 'Premium Suppliers',
                    'payee': 'Premium Suppliers',
                    'narration': 'This expense exceeds the approval threshold',
                    'program_tag': random.choice(programs),
                    'donor_fund_tag': random.choice(donors),
                    'payment_method': 'bank_transfer',
                    'approval_status': 'pending',
                }
            )
            if created:
                pending_tx_count += 1
                # Create approval request for this transaction
                ApprovalRequest.objects.get_or_create(
                    content_type='expense',
                    object_id=txn.id,
                    defaults={
                        'requested_by': users.get('accounts_head'),
                        'status': 'pending',
                        'reason': f'Expense PKR 12,000 exceeds approval threshold of PKR 5,000',
                        'requested_at': timezone.now() - timedelta(hours=random.randint(1, 48)),
                    }
                )
                # Create notification for managers
                for mgr_name in ['manager_hq', 'manager_sch01', 'manager_hos01']:
                    mgr = users.get(mgr_name)
                    if mgr:
                        Notification.objects.get_or_create(
                            recipient=mgr,
                            notif_type='approval_pending',
                            title='Expense Approval Required',
                            message=f'PKR 12,000 - {txn.description} needs your approval',
                            link='/approvals',
                            defaults={'is_read': False}
                        )
        self.stdout.write(f"  Created {pending_tx_count} pending expense approvals")

        # Replenishment requests (pending + approved)
        finance_head = users.get('finance_head')
        # Fix any records with null fund_id from previous broken runs
        ReplenishmentRequest.objects.filter(fund__isnull=True).delete()
        for code in ['HQ', 'SCH01', 'MED01']:
            branch = created_branches[code]
            fund = CashFund.objects.filter(branch=branch).first()
            ReplenishmentRequest.objects.get_or_create(
                branch=branch,
                amount_requested=75000,
                reason=f'Monthly operational top-up for {branch.name}',
                status='pending',
                defaults={
                    'program_tag': random.choice(programs),
                    'fund': fund,
                    'requested_by': users.get('accounts_head'),
                }
            )
        self.stdout.write("  Created 3 pending replenishment requests")

        # One approved replenishment request
        hos01_fund = CashFund.objects.filter(branch=created_branches['HOS01']).first()
        ReplenishmentRequest.objects.get_or_create(
            branch=created_branches['HOS01'],
            amount_requested=150000,
            reason='Emergency medicine stock replenishment',
            status='approved',
            defaults={
                'program_tag': 'Clean Water',
                'fund': hos01_fund,
                'requested_by': users.get('accounts_head'),
                'approved_by': finance_head,
                'approved_at': timezone.now() - timedelta(days=2),
            }
        )
        self.stdout.write("  Created 1 approved replenishment request")

        # Fund transfers
        FundTransfer.objects.get_or_create(
            source_fund=CashFund.objects.filter(branch=created_branches['SCH01']).first(),
            destination_fund=CashFund.objects.filter(branch=created_branches['SCH02']).first(),
            amount=20000,
            reason='Surplus to deficit transfer between campuses',
            defaults={
                'requested_by': users.get('accounts_head'),
                'status': 'completed',
                'approved_by': finance_head,
                'completed_at': timezone.now() - timedelta(days=3),
            }
        )
        # A pending transfer
        FundTransfer.objects.get_or_create(
            source_fund=CashFund.objects.filter(branch=created_branches['HQ']).first(),
            destination_fund=CashFund.objects.filter(branch=created_branches['IT01']).first(),
            amount=35000,
            reason='IT Institute equipment fund transfer',
            status='pending',
            defaults={
                'requested_by': users.get('accounts_head'),
            }
        )
        self.stdout.write("  Created 2 fund transfers (1 completed, 1 pending)")

        # Notifications
        notif_data = [
            (accounts_head, 'approval_completed', 'Expense Approved', 'Your expense PKR 4,500 has been approved', '/expenses', True),
            (accounts_head, 'low_balance', 'Low Balance Alert', 'SCH01 fund balance is below threshold', '/funds', False),
            (users.get('manager_hq'), 'approval_pending', 'Pending Approval', 'New expense PKR 12,000 requires review', '/approvals', False),
            (users.get('manager_sch01'), 'approval_pending', 'Pending Approval', 'New expense PKR 8,500 requires review', '/approvals', False),
            (finance_head, 'replenishment_request', 'Replenishment Request', 'HQ requests PKR 75,000 replenishment', '/replenishments', False),
            (finance_head, 'transfer_initiated', 'Fund Transfer Initiated', 'PKR 35,000 transfer from HQ to IT01 pending', '/funds', False),
            (users.get('data_entry'), 'expense_submitted', 'Expense Submitted', 'Your expense PKR 2,500 has been submitted for review', '/expenses', True),
        ]
        notif_count = 0
        for recipient, ntype, title, msg, link, is_read in notif_data:
            if recipient:
                Notification.objects.get_or_create(
                    recipient=recipient,
                    notif_type=ntype,
                    title=title,
                    message=msg,
                    link=link,
                    defaults={
                        'is_read': is_read,
                        'created_at': timezone.now() - timedelta(hours=random.randint(1, 72)),
                    }
                )
                notif_count += 1
        self.stdout.write(f"  Created {notif_count} notifications")

        # Audit logs for new action types
        audit_data = [
            (finance_head, 'settings_change', 'SystemSetting', None, "Setting 'expense_approval_threshold' changed from '3000' to '5000'"),
            (finance_head, 'approve', 'Transaction', all_txns[0].id if all_txns else None, f"Approved expense PKR {all_txns[0].amount if all_txns else 0}"),
            (finance_head, 'reject', 'Transaction', None, "Rejected expense PKR 15000: Duplicate entry"),
            (finance_head, 'transfer', 'FundTransfer', None, "Executed transfer PKR 20000 from SCH01 to SCH02"),
            (users.get('accounts_head'), 'login', 'User', None, "User logged in from 192.168.1.100"),
        ]
        for user, action, model, obj_id, desc in audit_data:
            if user:
                AuditLog.objects.create(
                    user=user,
                    action=action,
                    model_name=model,
                    object_id=obj_id,
                    description=desc,
                    ip_address='192.168.1.' + str(random.randint(10, 200)),
                )
        self.stdout.write("  Created 5 audit log entries (settings, approve, reject, transfer, login)")

        # ---- Replenishments ----
        replenish_branches = ['HQ', 'SCH01', 'COL01', 'HOS01']
        for code in replenish_branches:
            branch = created_branches[code]
            total_spent = sum(a for _, a, _ in expense_sets.get(code, []))
            replenish_amt = max(total_spent, 20000)
            Replenishment.objects.get_or_create(
                date=today - timedelta(days=1),
                branch=branch,
                amount=replenish_amt,
                defaults={
                    'reference_number': f'REF-{code}-{year}{month:02d}',
                    'notes': f'Monthly replenishment for {branch.name}',
                    'added_by': accounts_head,
                }
            )
            self.stdout.write(f"  Replenished {branch.name}: PKR {replenish_amt:,}")

            # restore cash fund after replenishment
            try:
                cf = CashFund.objects.get(branch=branch)
                cf.current_balance += Decimal(str(replenish_amt))
                cf.save()
            except CashFund.DoesNotExist:
                pass

        self.stdout.write(self.style.SUCCESS('Done! Seed data created successfully.'))
        # Report Templates
        report_templates = [
            ('Monthly Donor Report', 'donor', {
                'title_prefix': 'Donor Report',
                'default_months': 3,
                'columns': ['date', 'description', 'category', 'amount', 'branch', 'program_tag', 'donor_fund_tag', 'status'],
            }),
            ('Management Summary', 'management', {
                'title_prefix': 'Management Report',
                'default_months': 1,
                'columns': ['date', 'description', 'category', 'amount', 'branch', 'program_tag', 'donor_fund_tag', 'vendor', 'payee', 'payment_method', 'receipt', 'status'],
            }),
            ('Audit Trail Report', 'audit', {
                'title_prefix': 'Audit Report',
                'default_months': 6,
                'columns': ['date', 'description', 'category', 'amount', 'branch', 'program_tag', 'donor_fund_tag', 'vendor', 'payee', 'payment_method', 'receipt', 'status'],
            }),
            ('Branch Performance', 'branch', {
                'title_prefix': 'Branch Report',
                'default_months': 1,
                'columns': ['date', 'description', 'category', 'amount', 'status'],
            }),
            ('Program Impact Report', 'program', {
                'title_prefix': 'Program Report',
                'default_months': 3,
                'columns': ['date', 'description', 'category', 'amount', 'program_tag', 'donor_fund_tag', 'status'],
            }),
        ]
        for name, audience, config in report_templates:
            ReportTemplate.objects.get_or_create(
                name=name, audience=audience,
                defaults={'config': config}
            )
        self.stdout.write(f"  Created {len(report_templates)} report templates")

        self.stdout.write('Login credentials:')
        self.stdout.write('  Finance Head:         finance_head / Admin@1234')
        self.stdout.write('  Accounts Head:        accounts_head / Admin@1234')
        self.stdout.write('  Manager (HQ):         manager_hq / Admin@1234')
        self.stdout.write('  Manager (SCH01):      manager_sch01 / Admin@1234')
        self.stdout.write('  Manager (HOS01):      manager_hos01 / Admin@1234')
        self.stdout.write('  Data Entry Operator:  data_entry / Admin@1234')
        self.stdout.write('  Program Officer:      program_officer / Admin@1234')
        self.stdout.write('  Auditor:              auditor1 / Admin@1234')
