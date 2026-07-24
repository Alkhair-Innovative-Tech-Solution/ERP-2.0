from django.db import migrations, models


def evening_to_afternoon(apps, schema_editor):
    """The school only runs Morning and Afternoon shifts — fold any stray
    'evening' rows into 'afternoon'."""
    Coordinator = apps.get_model('coordinator', 'Coordinator')
    Coordinator.objects.filter(shift='evening').update(shift='afternoon')


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('coordinator', '0002_initial'),
    ]

    operations = [
        migrations.RunPython(evening_to_afternoon, noop_reverse),
        migrations.AlterField(
            model_name='coordinator',
            name='shift',
            field=models.CharField(
                choices=[
                    ('morning', 'Morning'),
                    ('afternoon', 'Afternoon'),
                    ('both', 'Morning + Afternoon'),
                    ('all', 'All Shifts'),
                ],
                default='both',
                help_text='Shift(s) this coordinator manages',
                max_length=20,
            ),
        ),
    ]
