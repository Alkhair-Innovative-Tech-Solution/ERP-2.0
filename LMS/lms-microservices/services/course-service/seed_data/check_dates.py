import os
import django
from datetime import date

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
django.setup()

from courses.models import Course

today = date.today()
print(f"--- DATABASE AUDIT ---")
print(f"Today's Date: {today}\n")

courses = Course.objects.all()
for c in courses:
    print(f"Course: {c.name}")
    print(f"  - Admission Open: {c.admission_open_date}")
    print(f"  - Course Start  : {c.course_start_date}")
    print(f"  - Stored Status : {c.admission_status}")
    
    # Calculate what it SHOULD be
    should_be = 'coming_soon'
    if c.course_start_date and today >= c.course_start_date:
        should_be = 'closed'
    elif c.admission_open_date and today >= c.admission_open_date:
        should_be = 'open'
    
    print(f"  - Calculated    : {should_be}")
    if c.admission_status != should_be:
        print(f"  [!] MISMATCH! Needs update.")
    print("-" * 30)
