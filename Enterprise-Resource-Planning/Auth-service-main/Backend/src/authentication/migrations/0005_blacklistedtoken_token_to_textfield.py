from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0004_rs256_token_field_to_text'),
    ]

    operations = [
        migrations.AlterField(
            model_name='blacklistedtoken',
            name='token',
            field=models.TextField(
                unique=True,
                help_text='JWT access token (RS256 tokens are ~700+ chars, TextField avoids length limit)',
            ),
        ),
    ]
