from django.db import migrations, models


class Migration(migrations.Migration):
    """Live connectivity fields mirrored from the FoxFace platform."""

    dependencies = [
        ('attendance', '0009_rename_biometric_device'),
    ]

    operations = [
        migrations.AddField(
            model_name='biometricdevice',
            name='is_online',
            field=models.BooleanField(blank=True, default=None, null=True),
        ),
        migrations.AddField(
            model_name='biometricdevice',
            name='last_status_check',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
