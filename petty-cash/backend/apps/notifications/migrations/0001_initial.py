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
                    name='Notification',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('notif_type', models.CharField(choices=[('low_balance', 'Low Balance'), ('approval_pending', 'Approval Pending'), ('approval_completed', 'Approval Completed'), ('void_completed', 'Void Completed'), ('replenishment_completed', 'Replenishment Completed'), ('replenishment_request', 'Replenishment Request'), ('expense_submitted', 'Expense Submitted'), ('settings_change', 'Settings Change'), ('transfer_completed', 'Transfer Completed'), ('transfer_initiated', 'Transfer Initiated')], max_length=30)),
                        ('title', models.CharField(max_length=200)),
                        ('message', models.TextField()),
                        ('link', models.CharField(blank=True, max_length=500)),
                        ('is_read', models.BooleanField(default=False)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('recipient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notifications', to='accounts.user')),
                    ],
                    options={'db_table': 'notifications', 'ordering': ['-created_at']},
                ),
            ],
            database_operations=[],
        ),
    ]
