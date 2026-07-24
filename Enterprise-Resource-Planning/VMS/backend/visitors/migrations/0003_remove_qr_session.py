# Migration to remove QRSession model and qr_session field

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('visitors', '0002_add_new_fields'),
    ]

    operations = [
        # Remove qr_session field from Visit
        migrations.RemoveField(
            model_name='visit',
            name='qr_session',
        ),
        # Delete QRSession model entirely
        migrations.DeleteModel(
            name='QRSession',
        ),
    ]
