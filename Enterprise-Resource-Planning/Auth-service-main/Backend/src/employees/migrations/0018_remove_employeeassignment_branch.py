from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('employees', '0017_employee_code_nullable_revert'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='employeeassignment',
            name='branch',
        ),
    ]
