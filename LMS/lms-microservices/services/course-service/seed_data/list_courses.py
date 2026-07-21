import os
import django
import sys

sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
django.setup()

from courses.models import Course
print("--- DATABASE COURSES ---")
for c in Course.objects.all():
    print(f"ID: {c.id} | Code: {c.course_code} | Name: {c.name}")
