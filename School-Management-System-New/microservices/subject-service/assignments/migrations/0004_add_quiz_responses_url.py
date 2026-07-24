from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('assignments', '0003_add_quiz_form_url'),
    ]

    operations = [
        migrations.AddField(
            model_name='assignment',
            name='quiz_responses_url',
            field=models.URLField(blank=True, null=True),
        ),
    ]
