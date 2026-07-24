from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0004_campus_default_timing'),
    ]

    operations = [
        # 1. Drop the old unique_together on CampusDefaultTiming (campus+org only)
        migrations.AlterUniqueTogether(
            name='campusdefaulttiming',
            unique_together=set(),
        ),
        # 2. Add shift_type to CampusDefaultTiming
        migrations.AddField(
            model_name='campusdefaulttiming',
            name='shift_type',
            field=models.CharField(
                choices=[('morning', 'Morning'), ('afternoon', 'Afternoon'), ('full_day', 'Full Day')],
                default='full_day',
                max_length=20,
            ),
        ),
        # 3. Restore unique_together with shift_type included
        migrations.AlterUniqueTogether(
            name='campusdefaulttiming',
            unique_together={('organization', 'campus', 'shift_type')},
        ),
        # 4. Add shift_type to EmployeeShiftTiming
        migrations.AddField(
            model_name='employeeshifttiming',
            name='shift_type',
            field=models.CharField(
                blank=True, null=True,
                choices=[('morning', 'Morning'), ('afternoon', 'Afternoon'), ('full_day', 'Full Day'), ('custom', 'Custom')],
                default='custom',
                max_length=20,
            ),
        ),
        # 5. Make check_in_time / check_out_time nullable on EmployeeShiftTiming
        migrations.AlterField(
            model_name='employeeshifttiming',
            name='check_in_time',
            field=models.TimeField(blank=True, null=True, help_text="Used only when shift_type='custom'"),
        ),
        migrations.AlterField(
            model_name='employeeshifttiming',
            name='check_out_time',
            field=models.TimeField(blank=True, null=True, help_text="Used only when shift_type='custom'"),
        ),
    ]
