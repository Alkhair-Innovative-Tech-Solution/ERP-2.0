from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('permissions', '0003_alter_serviceaccess_unique_together_and_more'),
        ('employees', '0001_initial'),
    ]

    operations = [
        # 1. Create Service registry table
        migrations.CreateModel(
            name='Service',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=20, unique=True, help_text="Short code used in code (e.g. 'hdms', 'vms')")),
                ('name', models.CharField(max_length=100, help_text='Human-readable name')),
                ('is_active', models.BooleanField(default=True)),
            ],
            options={
                'db_table': 'permissions_service',
                'ordering': ['code'],
            },
        ),

        # 2. Seed initial services
        migrations.RunSQL(
            sql="""
                INSERT INTO permissions_service (code, name, is_active)
                VALUES
                    ('sis',  'School Information System',   TRUE),
                    ('hdms', 'Help Desk Management System', TRUE),
                    ('vms',  'Visitor Management System',   TRUE)
                ON CONFLICT (code) DO NOTHING;
            """,
            reverse_sql="DELETE FROM permissions_service WHERE code IN ('sis', 'hdms', 'vms');",
        ),

        # 3. Remove choices from ServiceAccess.service (alters column comment only — data unchanged)
        migrations.AlterField(
            model_name='serviceaccess',
            name='service',
            field=models.CharField(
                max_length=20,
                help_text="Service code — must match an active Service.code (e.g. 'hdms', 'vms')",
            ),
        ),

        # 4. Create VmsRole table
        migrations.CreateModel(
            name='VmsRole',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('is_deleted', models.BooleanField(default=False)),
                ('role_type', models.CharField(
                    max_length=20,
                    choices=[
                        ('admin', 'Administrator'),
                        ('receptionist', 'Receptionist'),
                        ('security_staff', 'Security Staff'),
                    ],
                )),
                ('assigned_at', models.DateTimeField(auto_now_add=True)),
                ('assigned_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='assigned_vms_roles',
                    to='employees.employee',
                )),
                ('service_access', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='vms_role',
                    to='permissions.serviceaccess',
                    help_text='VMS service access this role is for',
                )),
            ],
            options={
                'verbose_name': 'VMS Role',
                'verbose_name_plural': 'VMS Roles',
                'db_table': 'permissions_vms_role',
            },
        ),
    ]
