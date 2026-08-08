# Phase D-blockers-clear: copied from staff-service's teachers_staff_migrations/0008
# (identical Teacher model fields, identical migration chain up to 0007 in
# every service's independent per-service migration history for the
# vendored teachers/ app — see MIGRATION_MODULES in each settings.py). This
# service's own copy was missing entirely (stuck at 0007), same drift
# found+fixed for attendance-service. See
# docs/PHASE_D_BLOCKERS_CLEAR_RESULT.md.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('teachers', '0007_teacher_role_end_date'),
    ]

    operations = [
        migrations.AddField(
            model_name='teacher',
            name='central_classroom_assigned_by_id',
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name='teacher',
            name='central_user_id',
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name='teacher',
            name='tenant_id',
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
    ]
