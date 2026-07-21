from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('permissions', '0004_service_vmsrole_dynamic_service_field'),
    ]

    operations = [
        migrations.AddField(
            model_name='vmsrole',
            name='deleted_at',
            field=models.DateTimeField(blank=True, null=True, help_text='Timestamp when record was deleted'),
        ),
        migrations.AddField(
            model_name='vmsrole',
            name='deleted_by',
            field=models.UUIDField(blank=True, null=True, help_text='UUID of employee who deleted this record'),
        ),
        migrations.AddField(
            model_name='vmsrole',
            name='deletion_reason',
            field=models.TextField(blank=True, null=True, help_text='Optional reason for deletion'),
        ),
        migrations.AddField(
            model_name='vmsrole',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, null=True, help_text='Timestamp when record was created'),
        ),
        migrations.AddField(
            model_name='vmsrole',
            name='updated_at',
            field=models.DateTimeField(auto_now=True, null=True, help_text='Timestamp when record was last updated'),
        ),
        migrations.AlterField(
            model_name='vmsrole',
            name='is_deleted',
            field=models.BooleanField(default=False, db_index=True, help_text='Indicates if this record is soft-deleted'),
        ),
    ]
