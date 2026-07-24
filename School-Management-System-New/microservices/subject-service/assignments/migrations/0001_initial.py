from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Assignment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('classroom_id', models.IntegerField(blank=True, null=True)),
                ('classroom_code', models.CharField(blank=True, max_length=50, null=True)),
                ('classroom_label', models.CharField(blank=True, max_length=100, null=True)),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True, null=True)),
                ('instructions', models.TextField(blank=True, null=True)),
                ('assignment_type', models.CharField(
                    choices=[
                        ('Individual', 'Individual'), ('Group', 'Group'),
                        ('Project', 'Project'), ('Quiz', 'Quiz'), ('Homework', 'Homework'),
                    ],
                    default='Individual', max_length=50,
                )),
                ('total_marks', models.IntegerField(default=100)),
                ('due_date', models.DateTimeField(blank=True, null=True)),
                ('is_published', models.BooleanField(default=True)),
                ('attachment', models.FileField(blank=True, null=True, upload_to='assignments/')),
                ('created_by_id', models.IntegerField(blank=True, null=True)),
                ('created_by_name', models.CharField(blank=True, max_length=255, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Submission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('student_id', models.IntegerField()),
                ('student_name', models.CharField(blank=True, max_length=255, null=True)),
                ('submitted_file', models.FileField(blank=True, null=True, upload_to='submissions/')),
                ('submission_text', models.TextField(blank=True, null=True)),
                ('grade', models.IntegerField(blank=True, null=True)),
                ('feedback', models.TextField(blank=True, null=True)),
                ('status', models.CharField(
                    choices=[
                        ('SUBMITTED', 'Submitted'), ('GRADED', 'Graded'),
                        ('LATE', 'Late'), ('RETURNED', 'Returned'),
                    ],
                    default='SUBMITTED', max_length=20,
                )),
                ('submitted_at', models.DateTimeField(auto_now_add=True)),
                ('graded_by_id', models.IntegerField(blank=True, null=True)),
                ('graded_by_name', models.CharField(blank=True, max_length=255, null=True)),
                ('graded_at', models.DateTimeField(blank=True, null=True)),
            ],
            options={
                'ordering': ['-submitted_at'],
            },
        ),
    ]
