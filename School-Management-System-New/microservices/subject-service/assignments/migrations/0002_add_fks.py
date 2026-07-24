import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('assignments', '0001_initial'),
        ('subjects', '0002_add_organization'),
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='assignment',
            name='organization',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='assignments',
                to='users.organization',
            ),
        ),
        migrations.AddField(
            model_name='assignment',
            name='subject',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='assignments',
                to='subjects.subject',
            ),
        ),
        migrations.AddField(
            model_name='submission',
            name='organization',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='submissions',
                to='users.organization',
            ),
        ),
        migrations.AddField(
            model_name='submission',
            name='assignment',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='submissions',
                to='assignments.assignment',
            ),
        ),
        migrations.AlterUniqueTogether(
            name='submission',
            unique_together={('assignment', 'student_id')},
        ),
    ]
