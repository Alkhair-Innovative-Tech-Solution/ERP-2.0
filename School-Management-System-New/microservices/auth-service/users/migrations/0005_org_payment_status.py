from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_add_student_id_pattern'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='payment_status',
            field=models.CharField(default='paid', max_length=10),
        ),
    ]
