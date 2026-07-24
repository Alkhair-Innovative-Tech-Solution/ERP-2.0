# Migration to add Employee model and employee_host field

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('visitors', '0003_remove_qr_session'),
    ]

    operations = [
        # Create Employee model
        migrations.CreateModel(
            name='Employee',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=200)),
                ('department', models.CharField(max_length=200)),
                ('designation', models.CharField(max_length=200)),
                ('employee_id', models.CharField(max_length=50, unique=True)),
                ('phone', models.CharField(blank=True, max_length=20, null=True)),
                ('email', models.EmailField(max_length=254)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'indexes': [
                    models.Index(fields=['employee_id'], name='visitors_em_employee_123456_idx'),
                    models.Index(fields=['email'], name='visitors_em_email_123456_idx'),
                    models.Index(fields=['department'], name='visitors_em_departme_123456_idx'),
                ],
            },
        ),
        # Add employee_host field to Visit
        migrations.AddField(
            model_name='visit',
            name='employee_host',
            field=models.ForeignKey(
                blank=True,
                help_text="Employee selected as host via 'Other' option",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='visits',
                to='visitors.employee',
            ),
        ),
    ]
