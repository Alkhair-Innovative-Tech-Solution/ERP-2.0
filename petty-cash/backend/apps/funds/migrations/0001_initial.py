from django.db import migrations, models
import django.db.models.deletion
from decimal import Decimal


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('accounts', '0001_initial'),
        ('expenses', '0001_initial'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='FundType',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('name', models.CharField(max_length=100)),
                        ('code', models.CharField(max_length=20, unique=True)),
                        ('description', models.TextField(blank=True)),
                        ('category', models.CharField(choices=[('operational', 'Operational'), ('program', 'Program Fund'), ('donor_restricted', 'Donor-Restricted Fund'), ('emergency', 'Emergency Fund'), ('project', 'Project Fund')], max_length=20)),
                        ('is_active', models.BooleanField(default=True)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                    ],
                    options={'db_table': 'fund_types', 'ordering': ['name']},
                ),
                migrations.CreateModel(
                    name='CashFund',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('current_balance', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=12)),
                        ('low_balance_threshold', models.DecimalField(decimal_places=2, default=Decimal('5000.00'), max_digits=10)),
                        ('program_tag', models.CharField(blank=True, max_length=100)),
                        ('donor_source', models.CharField(blank=True, max_length=200)),
                        ('annual_budget', models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                        ('max_balance_limit', models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                        ('start_date', models.DateField(blank=True, null=True)),
                        ('end_date', models.DateField(blank=True, null=True)),
                        ('status', models.CharField(choices=[('active', 'Active'), ('suspended', 'Suspended'), ('archived', 'Archived')], default='active', max_length=20)),
                        ('updated_at', models.DateTimeField(auto_now=True)),
                        ('fund_type', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='cash_funds', to='funds.fundtype')),
                        ('branch', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='cash_funds', to='accounts.branch')),
                    ],
                    options={'db_table': 'cash_fund'},
                ),
                migrations.CreateModel(
                    name='FundTransfer',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                        ('reason', models.TextField()),
                        ('status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected'), ('completed', 'Completed')], default='pending', max_length=20)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('completed_at', models.DateTimeField(blank=True, null=True)),
                        ('source_fund', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='transfers_out', to='funds.cashfund')),
                        ('destination_fund', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='transfers_in', to='funds.cashfund')),
                        ('requested_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='transfers_requested', to='accounts.user')),
                        ('approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='transfers_approved', to='accounts.user')),
                    ],
                    options={'db_table': 'fund_transfers', 'ordering': ['-created_at']},
                ),
            ],
            database_operations=[],
        ),
    ]
