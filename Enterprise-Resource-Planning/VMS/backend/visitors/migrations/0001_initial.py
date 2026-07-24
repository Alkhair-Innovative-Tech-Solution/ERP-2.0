import uuid
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Visitor',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('full_name', models.CharField(max_length=200)),
                ('cnic', models.CharField(blank=True, max_length=15, null=True, unique=True)),
                ('phone', models.CharField(blank=True, max_length=20, null=True)),
                ('email', models.EmailField(blank=True, null=True)),
                ('company', models.CharField(blank=True, max_length=200, null=True)),
                ('photo', models.ImageField(blank=True, null=True, upload_to='visitors/')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name='Host',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=200)),
                ('department', models.CharField(blank=True, max_length=200, null=True)),
                ('employee_id', models.CharField(blank=True, max_length=50, null=True)),
                ('phone', models.CharField(blank=True, max_length=20, null=True)),
                ('email', models.EmailField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
            ],
        ),
        migrations.CreateModel(
            name='QRSession',
            fields=[
                ('token', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField()),
                ('is_used', models.BooleanField(default=False)),
            ],
        ),
        migrations.CreateModel(
            name='Visit',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('host_name_manual', models.CharField(blank=True, max_length=200, null=True)),
                ('purpose', models.TextField(blank=True, null=True)),
                ('status', models.CharField(
                    choices=[
                        ('scheduled', 'Scheduled'),
                        ('pending_approval', 'Pending Approval'),
                        ('checked_in', 'Checked In'),
                        ('checked_out', 'Checked Out'),
                        ('cancelled', 'Cancelled'),
                        ('rejected', 'Rejected'),
                    ],
                    default='pending_approval',
                    max_length=20,
                )),
                ('entry_type', models.CharField(
                    choices=[
                        ('receptionist', 'Via Receptionist'),
                        ('qr_self', 'QR Self Check-in'),
                        ('scheduled', 'Pre-Scheduled'),
                    ],
                    default='receptionist',
                    max_length=20,
                )),
                ('scheduled_at', models.DateTimeField(blank=True, null=True)),
                ('visiting_id', models.CharField(blank=True, max_length=20, null=True, unique=True)),
                ('checked_in_at', models.DateTimeField(blank=True, null=True)),
                ('checked_out_at', models.DateTimeField(blank=True, null=True)),
                ('notes', models.TextField(blank=True, null=True)),
                ('is_returning', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('visitor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='visits', to='visitors.visitor')),
                ('host', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='visits', to='visitors.host')),
                ('approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('qr_session', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='visitors.qrsession')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='visitor',
            index=models.Index(fields=['cnic'], name='visitors_vi_cnic_idx'),
        ),
        migrations.AddIndex(
            model_name='visitor',
            index=models.Index(fields=['phone'], name='visitors_vi_phone_idx'),
        ),
        migrations.AddIndex(
            model_name='visitor',
            index=models.Index(fields=['email'], name='visitors_vi_email_idx'),
        ),
        migrations.AddIndex(
            model_name='visit',
            index=models.Index(fields=['status'], name='visitors_vi_status_idx'),
        ),
        migrations.AddIndex(
            model_name='visit',
            index=models.Index(fields=['checked_in_at'], name='visitors_vi_checked_idx'),
        ),
        migrations.AddIndex(
            model_name='visit',
            index=models.Index(fields=['visiting_id'], name='visitors_vi_vid_idx'),
        ),
        migrations.AddIndex(
            model_name='visit',
            index=models.Index(fields=['created_at'], name='visitors_vi_created_idx'),
        ),
    ]
