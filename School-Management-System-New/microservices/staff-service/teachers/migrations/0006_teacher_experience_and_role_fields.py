# Adds Teacher fields that existed on the model but were never migrated
# (experience_subjects_classes_taught, previous_responsibilities, role_end_date).
# Their absence made any query selecting all Teacher columns fail — e.g. the
# ClassRoom admin changelist (select_related('class_teacher')) 500'd.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('teachers', '0005_teachersubjectassignment'),
    ]

    operations = [
        migrations.AddField(
            model_name='teacher',
            name='experience_subjects_classes_taught',
            field=models.CharField(blank=True, max_length=200, null=True),
        ),
        migrations.AddField(
            model_name='teacher',
            name='previous_responsibilities',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='teacher',
            name='role_end_date',
            field=models.DateField(blank=True, null=True),
        ),
    ]
