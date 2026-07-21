import os
import django
import sys

sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
django.setup()

from courses.models import ScheduledClass
print("--- DATABASE SECTIONS ---")
for sc in ScheduledClass.objects.all()[:20]: # Pehle 20 dekh lete hain
    print(f"Course: {sc.course.name} | Section: {sc.section} | Code: {sc.course.course_code}")
