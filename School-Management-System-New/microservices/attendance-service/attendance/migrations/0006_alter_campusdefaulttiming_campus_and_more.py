import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0005_shift_types'),
        ('campus', '0002_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='campusdefaulttiming',
            name='campus',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='default_timings', to='campus.campus'),
        ),
        migrations.AlterField(
            model_name='campusdefaulttiming',
            name='check_in_time',
            field=models.TimeField(),
        ),
        migrations.AlterField(
            model_name='campusdefaulttiming',
            name='check_out_time',
            field=models.TimeField(),
        ),
    ]
