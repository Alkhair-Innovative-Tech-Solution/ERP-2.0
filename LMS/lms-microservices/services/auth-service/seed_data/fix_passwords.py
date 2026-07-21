import os
import django

# Set settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings')
django.setup()

from users.models import User

# Fix Students
students = User.objects.filter(role='student')
for u in students:
    u.set_password('ait_student_123')
    u.save()
print(f"Updated {students.count()} student passwords.")

# Fix Teachers
teachers = User.objects.filter(role='teacher')
for t in teachers:
    t.set_password('ait_teacher_123')
    t.save()
print(f"Updated {teachers.count()} teacher passwords.")
