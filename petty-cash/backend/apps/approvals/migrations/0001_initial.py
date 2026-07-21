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
                    name='ApprovalRequest',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('content_type', models.CharField(choices=[('expense', 'Expense'), ('void', 'Void'), ('replenishment', 'Replenishment')], max_length=30)),
                        ('object_id', models.IntegerField()),
                        ('status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='pending', max_length=20)),
                        ('reason', models.TextField(blank=True)),
                        ('response_note', models.TextField(blank=True)),
                        ('requested_at', models.DateTimeField(auto_now_add=True)),
                        ('responded_at', models.DateTimeField(blank=True, null=True)),
                        ('requested_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='approvals_requested', to='accounts.user')),
                        ('approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='approvals_given', to='accounts.user')),
                    ],
                    options={'db_table': 'approval_requests', 'ordering': ['-requested_at']},
                ),
            ],
            database_operations=[],
        ),
    ]
