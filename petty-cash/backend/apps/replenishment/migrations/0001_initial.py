from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('accounts', '0001_initial'),
        ('funds', '0001_initial'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='ReplenishmentRequest',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('amount_requested', models.DecimalField(decimal_places=2, max_digits=12)),
                        ('reason', models.TextField()),
                        ('program_tag', models.CharField(blank=True, max_length=100)),
                        ('status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected'), ('cancelled', 'Cancelled')], default='pending', max_length=20)),
                        ('approved_at', models.DateTimeField(blank=True, null=True)),
                        ('rejection_reason', models.TextField(blank=True)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('updated_at', models.DateTimeField(auto_now=True)),
                        ('branch', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='replenishment_requests', to='accounts.branch')),
                        ('fund', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='replenishment_requests', to='funds.cashfund')),
                        ('requested_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='replenishment_requests', to='accounts.user')),
                        ('approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='replenishment_approvals', to='accounts.user')),
                    ],
                    options={'db_table': 'replenishment_requests', 'ordering': ['-created_at']},
                ),
                migrations.CreateModel(
                    name='Replenishment',
                    fields=[
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
                    ],
                    options={'db_table': 'replenishments', 'ordering': ['-date']},
                ),
            ],
            database_operations=[],
        ),
    ]
