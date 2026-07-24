from django.db import migrations, models


def evening_to_afternoon(apps, schema_editor):
    """The school only runs Morning and Afternoon shifts. A frontend bug in the
    campus "Both Shifts" wizard tagged the second shift's grades/classrooms as
    'evening' instead of 'afternoon' — fold those rows into 'afternoon' so they
    match the shift they were actually meant to be."""
    Level = apps.get_model('classes', 'Level')
    Grade = apps.get_model('classes', 'Grade')
    ClassRoom = apps.get_model('classes', 'ClassRoom')
    Level.objects.filter(shift='evening').update(shift='afternoon')
    Grade.objects.filter(shift='evening').update(shift='afternoon')
    ClassRoom.objects.filter(shift='evening').update(shift='afternoon')


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('classes', '0005_level_add_coordinator_code'),
    ]

    operations = [
        migrations.RunPython(evening_to_afternoon, noop_reverse),
        migrations.AlterField(
            model_name='level',
            name='shift',
            field=models.CharField(
                choices=[('morning', 'Morning'), ('afternoon', 'Afternoon'), ('both', 'Both')],
                default='morning',
                help_text='Shift for this level',
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='grade',
            name='shift',
            field=models.CharField(
                choices=[('morning', 'Morning'), ('afternoon', 'Afternoon'), ('both', 'Both')],
                default='morning',
                help_text='Shift for this grade',
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='classroom',
            name='shift',
            field=models.CharField(
                choices=[('morning', 'Morning'), ('afternoon', 'Afternoon'), ('both', 'Both')],
                default='morning',
                help_text='Shift for this classroom',
                max_length=20,
            ),
        ),
    ]
