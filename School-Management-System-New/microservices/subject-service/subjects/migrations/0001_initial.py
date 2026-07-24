from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Subject',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('subject_code', models.CharField(blank=True, max_length=30, null=True)),
                ('description', models.TextField(blank=True, null=True)),
                ('grade_id', models.IntegerField(blank=True, null=True)),
                ('grade_name', models.CharField(blank=True, max_length=100, null=True)),
                ('campus_id', models.IntegerField(blank=True, null=True)),
                ('campus_name', models.CharField(blank=True, max_length=255, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('is_deleted', models.BooleanField(default=False)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='SubjectTeacherAssignment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('teacher_id', models.IntegerField()),
                ('teacher_name', models.CharField(blank=True, max_length=255, null=True)),
                ('classroom_id', models.IntegerField(blank=True, null=True)),
                ('classroom_code', models.CharField(blank=True, max_length=50, null=True)),
                ('classroom_label', models.CharField(blank=True, max_length=100, null=True)),
                ('academic_year', models.CharField(default='2025-26', max_length=10)),
                ('is_active', models.BooleanField(default=True)),
                ('assigned_by_id', models.IntegerField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
    ]
