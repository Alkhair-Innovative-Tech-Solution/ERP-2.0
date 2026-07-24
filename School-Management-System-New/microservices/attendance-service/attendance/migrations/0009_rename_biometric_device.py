from django.conf import settings
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Generalize the biometric layer:
      ZKTecoDevice          -> BiometricDevice  (+ device_type)
      ZKTecoEmployeeMapping -> BiometricEmployeeMapping
    RenameModel preserves all rows and FK references (incl. StaffAttendance.device).
    """

    dependencies = [
        ('attendance', '0008_auditlog_is_recovered_alter_auditlog_action_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RenameModel(old_name='ZKTecoDevice', new_name='BiometricDevice'),
        migrations.RenameModel(old_name='ZKTecoEmployeeMapping', new_name='BiometricEmployeeMapping'),

        migrations.AddField(
            model_name='biometricdevice',
            name='device_type',
            field=models.CharField(
                choices=[('zkteco', 'ZKTeco (fingerprint / RFID)'), ('foxface', 'Foxit FoxFace (face)')],
                default='zkteco',
                max_length=20,
            ),
        ),

        # FoxFace devices are cloud-pull -> ip_address optional
        migrations.AlterField(
            model_name='biometricdevice',
            name='ip_address',
            field=models.GenericIPAddressField(blank=True, null=True),
        ),

        # related_name refresh: zkteco_* -> biometric_* (no column change)
        migrations.AlterField(
            model_name='biometricdevice',
            name='campus',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='biometric_devices', to='campus.campus'),
        ),
        migrations.AlterField(
            model_name='biometricdevice',
            name='organization',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='biometric_devices', to='users.organization'),
        ),
        migrations.AlterField(
            model_name='biometricemployeemapping',
            name='organization',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='biometric_mappings', to='users.organization'),
        ),
        migrations.AlterField(
            model_name='biometricemployeemapping',
            name='user',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='biometric_mappings', to=settings.AUTH_USER_MODEL),
        ),
    ]
