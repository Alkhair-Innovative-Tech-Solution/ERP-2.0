from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('visitors', '0005_add_card_expired'),
    ]
    operations = [
        migrations.AddField(
            model_name='visit',
            name='internal_department',
            field=models.CharField(max_length=200, null=True, blank=True, help_text='Department/campus for internal visits'),
        ),
    ]
