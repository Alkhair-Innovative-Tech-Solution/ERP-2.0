from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='ReportTemplate',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('name', models.CharField(max_length=200)),
                        ('audience', models.CharField(choices=[('donor', 'Donor Report'), ('management', 'Management Summary'), ('audit', 'Audit Trail Report'), ('branch', 'Branch Report'), ('program', 'Program Report')], max_length=20)),
                        ('config', models.JSONField(default=dict)),
                        ('is_active', models.BooleanField(default=True)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('updated_at', models.DateTimeField(auto_now=True)),
                        ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='report_templates', to='accounts.user')),
                    ],
                    options={'db_table': 'report_templates', 'ordering': ['name']},
                ),
            ],
            database_operations=[],
        ),
    ]
