# Migration to add card_expired field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('visitors', '0004_add_employee'),
    ]

    operations = [
        migrations.AddField(
            model_name='visit',
            name='card_expired',
            field=models.BooleanField(default=False, help_text='True after checkout - card no longer valid'),
        ),
    ]
