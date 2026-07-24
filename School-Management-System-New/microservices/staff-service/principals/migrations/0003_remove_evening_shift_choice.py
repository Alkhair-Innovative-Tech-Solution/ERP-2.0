from django.db import migrations, models


def evening_to_afternoon(apps, schema_editor):
    """The school only runs Morning and Afternoon shifts — fold any stray
    'evening' rows into 'afternoon'."""
    Principal = apps.get_model('principals', 'Principal')
    Principal.objects.filter(shift='evening').update(shift='afternoon')


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('principals', '0002_initial'),
    ]

    operations = [
        migrations.RunPython(evening_to_afternoon, noop_reverse),
        migrations.AlterField(
            model_name='principal',
            name='shift',
            field=models.CharField(
                choices=[
                    ('morning', 'Morning'),
                    ('afternoon', 'Afternoon'),
                    ('both', 'Both'),
                    ('all', 'All Shifts'),
                ],
                default='morning',
                help_text="Principal's working shift",
                max_length=20,
            ),
        ),
    ]
