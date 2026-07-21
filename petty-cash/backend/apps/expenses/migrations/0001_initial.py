from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('accounts', '0001_initial'),
        ('settings', '0001_initial'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='ExpenseCategory',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('name', models.CharField(max_length=100)),
                        ('description', models.TextField(blank=True)),
                        ('category_type', models.CharField(choices=[('general', 'General'), ('operational', 'Operational'), ('program', 'Program Specific')], default='general', max_length=20)),
                        ('parent', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='subcategories', to='expenses.expensecategory')),
                        ('is_allowed', models.BooleanField(default=True)),
                        ('monthly_limit', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('is_active', models.BooleanField(default=True)),
                    ],
                    options={'db_table': 'expense_categories', 'ordering': ['name'], 'verbose_name_plural': 'Expense Categories'},
                ),
                migrations.CreateModel(
                    name='Transaction',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('date', models.DateField()),
                        ('amount', models.DecimalField(decimal_places=2, max_digits=10)),
                        ('description', models.TextField()),
                        ('narration', models.TextField(blank=True)),
                        ('payee', models.CharField(blank=True, max_length=200)),
                        ('program_tag', models.CharField(blank=True, max_length=100)),
                        ('donor_fund_tag', models.CharField(blank=True, max_length=100)),
                        ('payment_method', models.CharField(choices=[('cash', 'Cash'), ('bank_transfer', 'Bank Transfer'), ('cheque', 'Cheque')], default='cash', max_length=20)),
                        ('receipt', models.FileField(blank=True, null=True, upload_to='receipts/%Y/%m/')),
                        ('vendor_name', models.CharField(blank=True, max_length=200)),
                        ('approval_status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='approved', max_length=20)),
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
                    ],
                    options={'db_table': 'transactions', 'ordering': ['-date', '-created_at']},
                ),
            ],
            database_operations=[],
        ),
    ]
