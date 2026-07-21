from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='AuditLog',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('action', models.CharField(choices=[('create', 'Created'), ('update', 'Updated'), ('void', 'Voided'), ('login', 'Login'), ('replenish', 'Replenished'), ('budget_set', 'Budget Set'), ('settings_change', 'Settings Change'), ('approve', 'Approved'), ('reject', 'Rejected'), ('transfer', 'Fund Transfer')], max_length=20)),
                        ('model_name', models.CharField(max_length=50)),
                        ('object_id', models.IntegerField(blank=True, null=True)),
                        ('description', models.TextField()),
                        ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                        ('timestamp', models.DateTimeField(auto_now_add=True)),
                        ('user', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='accounts.user')),
                    ],
                    options={'db_table': 'audit_logs', 'ordering': ['-timestamp']},
                ),
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
                        ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='budgets_created', to='accounts.user')),
                        ('branch', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='budgets', to='accounts.branch')),
                    ],
                    options={'db_table': 'monthly_budgets', 'ordering': ['-year', '-month'], 'unique_together': {('year', 'month', 'department', 'branch')}},
                ),
                migrations.CreateModel(
                    name='SystemSetting',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('key', models.CharField(max_length=100, unique=True)),
                        ('value', models.JSONField()),
                        ('value_type', models.CharField(choices=[('string', 'String'), ('number', 'Number'), ('boolean', 'Boolean'), ('json', 'JSON')], default='string', max_length=20)),
                        ('description', models.TextField(blank=True)),
                        ('is_active', models.BooleanField(default=True)),
                        ('updated_at', models.DateTimeField(auto_now=True)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='settings_updated', to='accounts.user')),
                    ],
                    options={'db_table': 'system_settings', 'ordering': ['key']},
                ),
            ],
            database_operations=[],
        ),
    ]
