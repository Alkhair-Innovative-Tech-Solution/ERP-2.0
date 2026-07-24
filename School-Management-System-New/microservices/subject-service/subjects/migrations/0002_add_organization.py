import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('subjects', '0001_initial'),
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='subject',
            name='organization',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='subjects',
                to='users.organization',
            ),
        ),
        migrations.AddField(
            model_name='subjectteacherassignment',
            name='organization',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='subject_teacher_assignments',
                to='users.organization',
            ),
        ),
        migrations.AddField(
            model_name='subjectteacherassignment',
            name='subject',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='teacher_assignments',
                to='subjects.subject',
            ),
        ),
        migrations.AlterUniqueTogether(
            name='subjectteacherassignment',
            unique_together={('subject', 'teacher_id', 'classroom_id', 'academic_year')},
        ),
    ]
