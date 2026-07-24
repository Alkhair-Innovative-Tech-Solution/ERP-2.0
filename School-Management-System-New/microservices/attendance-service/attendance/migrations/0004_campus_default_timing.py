from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0003_initial'),
        ('campus', '0001_initial'),
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='CampusDefaultTiming',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('check_in_time', models.TimeField(help_text="Default campus arrival time")),
                ('check_out_time', models.TimeField(help_text="Default campus departure time")),
                ('grace_minutes', models.PositiveIntegerField(default=10)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='campus_default_timings',
                    to='users.organization',
                )),
                ('campus', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='default_timing',
                    to='campus.campus',
                )),
            ],
            options={
                'unique_together': {('organization', 'campus')},
            },
        ),
    ]
