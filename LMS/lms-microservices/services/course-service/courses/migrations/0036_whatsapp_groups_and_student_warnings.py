# Generated manually

import django.db.models.deletion
import uuid
from django.db import migrations, models


def copy_whatsapp_link_to_new_fields(apps, schema_editor):
    ScheduledClass = apps.get_model('courses', 'ScheduledClass')
    for sc in ScheduledClass.objects.all():
        if sc.whatsapp_group_link:
            sc.whatsapp_group_link_boys = sc.whatsapp_group_link
            sc.whatsapp_group_link_girls = sc.whatsapp_group_link
            sc.save(update_fields=['whatsapp_group_link_boys', 'whatsapp_group_link_girls'])


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0035_add_attendance_contact_log'),
    ]

    operations = [
        migrations.AddField(
            model_name='scheduledclass',
            name='whatsapp_group_link_boys',
            field=models.URLField(blank=True, max_length=500, null=True),
        ),
        migrations.AddField(
            model_name='scheduledclass',
            name='whatsapp_group_link_girls',
            field=models.URLField(blank=True, max_length=500, null=True),
        ),
        migrations.RunPython(copy_whatsapp_link_to_new_fields, reverse_code=migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='scheduledclass',
            name='whatsapp_group_link',
        ),
        migrations.CreateModel(
            name='StudentWarning',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('student_id', models.UUIDField()),
                ('warning_type', models.CharField(choices=[('absent', 'Frequent Absence'), ('late', 'Frequent Lateness'), ('behavior', 'Behavioral'), ('academic', 'Academic Performance'), ('other', 'Other')], default='absent', max_length=20)),
                ('description', models.TextField(blank=True, null=True)),
                ('issued_by_id', models.UUIDField()),
                ('issued_by_name', models.CharField(blank=True, max_length=255, null=True)),
                ('issued_at', models.DateTimeField(auto_now_add=True)),
                ('resolved', models.BooleanField(default=False)),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('resolved_by_id', models.UUIDField(blank=True, null=True)),
                ('resolution_notes', models.TextField(blank=True, null=True)),
                ('scheduled_class', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='student_warnings', to='courses.scheduledclass')),
            ],
            options={
                'verbose_name_plural': 'Student Warnings',
                'ordering': ['-issued_at'],
            },
        ),
    ]
