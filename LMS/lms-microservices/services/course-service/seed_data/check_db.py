import os
import django
import uuid

# Set up Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from courses.models import ScheduledClass

# Fetch all scheduled classes and print their admission dates
classes = ScheduledClass.objects.all()
print(f"Total Scheduled Classes: {classes.count()}")
for sc in classes:
    print(f"ID: {sc.id}")
    print(f"  Course: {sc.course.name}")
    print(f"  Admission Open: {sc.admission_open_date}")
    print(f"  Course Start:   {sc.course_start_date}")
    print(f"  Active:         {sc.active}")
    print("-" * 20)
