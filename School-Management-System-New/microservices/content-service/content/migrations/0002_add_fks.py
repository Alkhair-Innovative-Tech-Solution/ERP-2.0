import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0001_initial'),
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='module',
            name='organization',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='modules',
                to='users.organization',
            ),
        ),
        migrations.AddField(
            model_name='lesson',
            name='organization',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='lessons',
                to='users.organization',
            ),
        ),
        migrations.AddField(
            model_name='lesson',
            name='module',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='lessons',
                to='content.module',
            ),
        ),
        migrations.AddField(
            model_name='contentitem',
            name='organization',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='content_items',
                to='users.organization',
            ),
        ),
        migrations.AddField(
            model_name='contentitem',
            name='lesson',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='contents',
                to='content.lesson',
            ),
        ),
        migrations.AddField(
            model_name='studentcontentprogress',
            name='organization',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='content_progress',
                to='users.organization',
            ),
        ),
        migrations.AddField(
            model_name='studentcontentprogress',
            name='lesson',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='progress_records',
                to='content.lesson',
            ),
        ),
        migrations.AlterUniqueTogether(
            name='studentcontentprogress',
            unique_together={('student_id', 'lesson')},
        ),
    ]
