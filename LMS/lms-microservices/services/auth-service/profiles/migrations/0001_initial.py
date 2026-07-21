from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='User',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('password', models.CharField(max_length=128, verbose_name='password')),
                ('last_login', models.DateTimeField(blank=True, null=True, verbose_name='last login')),
                ('is_superuser', models.BooleanField(default=False, help_text='Designates that this user has all permissions without explicitly assigning them.', verbose_name='superuser status')),
                ('username', models.CharField(error_messages={'unique': 'A user with that username already exists.'}, help_text='Required. 150 characters or fewer. Letters, digits and @/./+/-/_ only.', max_length=150, unique=True, verbose_name='username')),
                ('first_name', models.CharField(blank=True, max_length=150, verbose_name='first name')),
                ('last_name', models.CharField(blank=True, max_length=150, verbose_name='last name')),
                ('email', models.EmailField(blank=True, max_length=254, verbose_name='email address')),
                ('is_staff', models.BooleanField(default=False, help_text='Designates whether the user can log into this admin site.', verbose_name='staff status')),
                ('is_active', models.BooleanField(default=True, help_text='Designates whether this user should be treated as active. Unselect this instead of deleting accounts.', verbose_name='active')),
                ('date_joined', models.DateTimeField(auto_now_add=True, verbose_name='date joined')),
                ('userId', models.UUIDField(db_column='userId', default=uuid.uuid4, unique=True)),
                ('profile_picture', models.ImageField(blank=True, null=True, upload_to='profiles/')),
                ('cover_photo', models.ImageField(blank=True, null=True, upload_to='covers/')),
                ('role', models.CharField(choices=[('STUDENT', 'Student'), ('TEACHER', 'Teacher'), ('ADMIN', 'Admin')], default='STUDENT', max_length=20)),
                ('groups', models.ManyToManyField(blank=True, help_text='The groups this user belongs to. A user will get all permissions granted to each of their groups.', related_name='user_set', related_query_name='user', to='auth.group', verbose_name='groups')),
                ('user_permissions', models.ManyToManyField(blank=True, help_text='Specific permissions for this user.', related_name='user_set', related_query_name='user', to='auth.permission', verbose_name='user permissions')),
            ],
            options={
                'verbose_name': 'User',
                'verbose_name_plural': 'Users',
                'db_table': 'profiles_user',
            },
        ),
        migrations.CreateModel(
            name='UserProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('bio', models.TextField(blank=True, default='')),
                ('headline', models.CharField(blank=True, default='', max_length=255)),
                ('location', models.CharField(blank=True, default='', max_length=100)),
                ('is_private', models.BooleanField(default=False)),
                ('joined_date', models.DateTimeField(auto_now_add=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='user_profile', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'User Profile',
                'verbose_name_plural': 'User Profiles',
                'db_table': 'profiles_userprofile',
            },
        ),
        migrations.CreateModel(
            name='TeacherProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('joined_date', models.DateTimeField(auto_now_add=True)),
                ('teacher_id', models.CharField(blank=True, max_length=50, null=True, unique=True)),
                ('department', models.CharField(blank=True, default='', max_length=100)),
                ('designation', models.CharField(blank=True, default='', max_length=100)),
                ('qualifications', models.TextField(blank=True, default='')),
                ('specialization', models.CharField(blank=True, default='', max_length=255)),
                ('experience_years', models.IntegerField(default=0)),
                ('bio', models.TextField(blank=True, default='')),
                ('website', models.URLField(blank=True, default='')),
                ('linkedin', models.URLField(blank=True, default='')),
                ('is_verified', models.BooleanField(default=False)),
                ('is_active', models.BooleanField(default=True)),
                ('can_create_courses', models.BooleanField(default=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='teacher_profile', to=settings.AUTH_USER_MODEL)),
                ('user_profile', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='teacher_profile', to='profiles.userprofile')),
            ],
            options={
                'verbose_name': 'Teacher Profile',
                'verbose_name_plural': 'Teacher Profiles',
                'db_table': 'profiles_teacherprofile',
            },
        ),
        migrations.CreateModel(
            name='StudentProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('enrollment_date', models.DateTimeField(auto_now_add=True)),
                ('student_id', models.CharField(blank=True, max_length=50, null=True, unique=True)),
                ('grade_level', models.CharField(blank=True, default='', max_length=50)),
                ('is_active', models.BooleanField(default=True)),
                ('last_activity', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='student_profile', to=settings.AUTH_USER_MODEL)),
                ('user_profile', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='student_profile', to='profiles.userprofile')),
            ],
            options={
                'verbose_name': 'Student Profile',
                'verbose_name_plural': 'Student Profiles',
                'db_table': 'profiles_studentprofile',
            },
        ),
    ]