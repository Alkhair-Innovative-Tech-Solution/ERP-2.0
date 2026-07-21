from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('replenishment', '0001_initial'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    "ALTER TABLE replenishment_requests ADD COLUMN req_number varchar(50) NOT NULL DEFAULT ''",
                    "ALTER TABLE replenishment_requests DROP COLUMN req_number",
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='replenishmentrequest',
                    name='req_number',
                    field=models.CharField(blank=True, max_length=50, verbose_name='REQ #'),
                ),
            ],
        ),
    ]
