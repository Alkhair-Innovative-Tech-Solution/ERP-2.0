from django.db import migrations, models
import django.contrib.auth.models
import django.contrib.auth.validators
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('auth', '0001_initial'),
        ('contenttypes', '0001_initial'),
    ]

    operations = [
        # Branch table first (User depends on it)
        migrations.CreateModel(
            name='Branch',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('type', models.CharField(choices=[
                    ('head_office', 'Head Office'),
                    ('school', 'School Campus'),
                    ('college', 'College'),
                    ('hospital', 'Hospital'),
                    ('medical_center', 'Medical Center'),
                    ('it_institute', 'IT Institute'),
                ], max_length=20)),
                ('name', models.CharField(max_length=200)),
                ('code', models.CharField(max_length=20, unique=True)),
                ('location', models.CharField(blank=True, max_length=255)),
                ('contact', models.CharField(blank=True, max_length=20)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'branches', 'ordering': ['name']},
        ),

        # User table (custom AUTH_USER_MODEL)
        migrations.CreateModel(
            name='User',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('password', models.CharField(max_length=128, verbose_name='password')),
                ('last_login', models.DateTimeField(blank=True, null=True, verbose_name='last login')),
                ('is_superuser', models.BooleanField(default=False)),
                ('username', models.CharField(
                    error_messages={'unique': 'A user with that username already exists.'},
                    max_length=150,
                    unique=True,
                    validators=[django.contrib.auth.validators.UnicodeUsernameValidator()],
                    verbose_name='username',
                )),
                ('first_name', models.CharField(blank=True, max_length=150, verbose_name='first name')),
                ('last_name', models.CharField(blank=True, max_length=150, verbose_name='last name')),
                ('email', models.EmailField(blank=True, max_length=254, verbose_name='email address')),
                ('is_staff', models.BooleanField(default=False)),
                ('is_active', models.BooleanField(default=True)),
                ('date_joined', models.DateTimeField(default=django.utils.timezone.now, verbose_name='date joined')),
                ('role', models.CharField(
                    choices=[
                        ('accounts_head', 'Accounts Head'),
                        ('branch_manager', 'Branch Manager'),
                        ('auditor', 'Auditor / Reviewer'),
                    ],
                    default='branch_manager',
                    max_length=20,
                )),
                ('department', models.CharField(blank=True, max_length=100)),
                ('employee_id', models.CharField(blank=True, max_length=50, null=True, unique=True)),
                ('phone', models.CharField(blank=True, max_length=20)),
                ('branch', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='users',
                    to='petty_cash.branch',
                )),
                ('groups', models.ManyToManyField(
                    blank=True,
                    related_name='user_set',
                    related_query_name='user',
                    to='auth.group',
                    verbose_name='groups',
                )),
                ('user_permissions', models.ManyToManyField(
                    blank=True,
                    related_name='user_set',
                    related_query_name='user',
                    to='auth.permission',
                    verbose_name='user permissions',
                )),
            ],
            options={
                'db_table': 'users',
                'verbose_name': 'user',
                'verbose_name_plural': 'users',
            },
            managers=[
                ('objects', django.contrib.auth.models.UserManager()),
            ],
        ),

        # ExpenseCategory
        migrations.CreateModel(
            name='ExpenseCategory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('description', models.TextField(blank=True)),
                ('is_allowed', models.BooleanField(default=True)),
                ('monthly_limit', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('is_active', models.BooleanField(default=True)),
            ],
            options={'db_table': 'expense_categories', 'ordering': ['name'], 'verbose_name_plural': 'Expense Categories'},
        ),

        # MonthlyBudget
        migrations.CreateModel(
            name='MonthlyBudget',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('year', models.IntegerField()),
                ('month', models.IntegerField()),
                ('total_budget', models.DecimalField(decimal_places=2, max_digits=12)),
                ('department', models.CharField(blank=True, default='General', max_length=100)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('branch', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='budgets',
                    to='petty_cash.branch',
                )),
                ('created_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='budgets_created',
                    to='petty_cash.user',
                )),
            ],
            options={
                'db_table': 'monthly_budgets',
                'ordering': ['-year', '-month'],
                'unique_together': {('year', 'month', 'department', 'branch')},
            },
        ),

        # CashFund
        migrations.CreateModel(
            name='CashFund',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('current_balance', models.DecimalField(decimal_places=2, default='0.00', max_digits=12)),
                ('low_balance_threshold', models.DecimalField(decimal_places=2, default='5000.00', max_digits=10)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('branch', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='cash_funds',
                    to='petty_cash.branch',
                )),
            ],
            options={'db_table': 'cash_fund'},
        ),

        # Transaction
        migrations.CreateModel(
            name='Transaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField()),
                ('amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('description', models.TextField()),
                ('receipt', models.FileField(blank=True, null=True, upload_to='receipts/%Y/%m/')),
                ('vendor_name', models.CharField(blank=True, max_length=200)),
                ('is_void', models.BooleanField(default=False)),
                ('void_reason', models.TextField(blank=True)),
                ('voided_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('branch', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='transactions',
                    to='petty_cash.branch',
                )),
                ('budget', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='transactions',
                    to='petty_cash.monthlybudget',
                )),
                ('category', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='transactions',
                    to='petty_cash.expensecategory',
                )),
                ('entered_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='transactions_entered',
                    to='petty_cash.user',
                )),
                ('voided_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='transactions_voided',
                    to='petty_cash.user',
                )),
            ],
            options={'db_table': 'transactions', 'ordering': ['-date', '-created_at']},
        ),

        # Replenishment
        migrations.CreateModel(
            name='Replenishment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('date', models.DateField()),
                ('reference_number', models.CharField(blank=True, max_length=100)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('added_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='replenishments',
                    to='petty_cash.user',
                )),
                ('branch', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='replenishments',
                    to='petty_cash.branch',
                )),
            ],
            options={'db_table': 'replenishments', 'ordering': ['-date']},
        ),

        # AuditLog
        migrations.CreateModel(
            name='AuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(choices=[
                    ('create', 'Created'),
                    ('update', 'Updated'),
                    ('void', 'Voided'),
                    ('login', 'Login'),
                    ('replenish', 'Replenished'),
                    ('budget_set', 'Budget Set'),
                ], max_length=20)),
                ('model_name', models.CharField(max_length=50)),
                ('object_id', models.IntegerField(blank=True, null=True)),
                ('description', models.TextField()),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to='petty_cash.user',
                )),
            ],
            options={'db_table': 'audit_logs', 'ordering': ['-timestamp']},
        ),
    ]
