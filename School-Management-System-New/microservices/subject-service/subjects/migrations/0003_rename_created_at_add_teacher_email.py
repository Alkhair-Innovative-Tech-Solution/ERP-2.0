from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('subjects', '0002_add_organization'),
    ]

    operations = [
        migrations.RenameField(
            model_name='subjectteacherassignment',
            old_name='created_at',
            new_name='assigned_at',
        ),
        migrations.AddField(
            model_name='subjectteacherassignment',
            name='teacher_email',
            field=models.EmailField(blank=True, max_length=254, null=True),
        ),
    ]
