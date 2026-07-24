from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('timetable', '0003_alter_subject_unique_together'),
    ]

    operations = [
        migrations.AlterField(
            model_name='classtimetable',
            name='subject',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='class_periods',
                help_text='Subject being taught',
                to='timetable.subject',
            ),
        ),
        migrations.AlterField(
            model_name='classtimetable',
            name='teacher',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='class_teaching_periods',
                help_text='Teacher assigned to this period',
                to='teachers.teacher',
            ),
        ),
    ]
