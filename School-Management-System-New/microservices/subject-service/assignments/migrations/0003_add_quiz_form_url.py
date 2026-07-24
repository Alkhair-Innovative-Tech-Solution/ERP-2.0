from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('assignments', '0002_add_fks'),
    ]

    operations = [
        migrations.AddField(
            model_name='assignment',
            name='quiz_form_url',
            field=models.URLField(blank=True, null=True),
        ),
    ]
