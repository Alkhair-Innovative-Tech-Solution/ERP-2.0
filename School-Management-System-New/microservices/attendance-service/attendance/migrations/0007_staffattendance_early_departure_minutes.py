from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0006_alter_campusdefaulttiming_campus_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='staffattendance',
            name='early_departure_minutes',
            field=models.IntegerField(default=0),
        ),
    ]
