from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('employees', '0015_alter_employee_employee_code'),
    ]

    operations = [
        migrations.AlterField(
            model_name='employee',
            name='employee_code',
            field=models.CharField(
                blank=True, db_index=True, editable=False,
                help_text='Generated from Primary Assignment',
                max_length=50, unique=True,
            ),
        ),
    ]
