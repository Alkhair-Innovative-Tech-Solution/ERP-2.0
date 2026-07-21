from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('expenses', '0001_initial'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    "ALTER TABLE transactions ADD COLUMN cpv_number varchar(50) NOT NULL DEFAULT ''",
                    "ALTER TABLE transactions DROP COLUMN cpv_number",
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='transaction',
                    name='cpv_number',
                    field=models.CharField(blank=True, max_length=50, verbose_name='CPV #'),
                ),
            ],
        ),
    ]
