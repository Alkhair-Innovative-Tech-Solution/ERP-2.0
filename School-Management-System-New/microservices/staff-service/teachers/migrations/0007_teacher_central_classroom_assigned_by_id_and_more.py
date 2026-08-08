# Phase D-blockers-clear: this is the DEFAULT (un-overridden) teachers/
# migrations location — bundled inside teachers/ itself, vendored as-is by
# any service that COPYs teachers/ without also setting its own
# MIGRATION_MODULES override. Of all 9 services vendoring teachers/, only
# timetable-service has no such override (checked every settings.py
# directly), so this file is really "timetable-service's independent
# history" in disguise — its own model state was one migration short (this
# folder's own 0006 already consolidates what other services split into
# 0006+0007, so this is numbered 0007 here, not 0008). Same 3 fields as
# every other service's equivalent fix (see docs/PHASE_D_BLOCKERS_CLEAR_RESULT.md).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('teachers', '0006_teacher_experience_and_role_fields'),
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
