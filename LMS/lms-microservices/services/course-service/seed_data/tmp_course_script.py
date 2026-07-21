
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
django.setup()

import uuid, json, sys
from courses.models import Course, ScheduledClass, CourseRegistrationHistory
from django.db import transaction

with open('users_payload.json', 'r', encoding='utf-8') as f:
    leads = json.load(f)
total_matched = 0

for lead in leads:
    code_req = (lead.get('course_code') or "").upper()
    
    # Fallback guessing if code is missing
    if not code_req or code_req == "NULL":
        cname = (lead.get('course') or "").lower()
        if "cit" in cname or "level 0" in cname: code_req = "CF01"
        elif "language" in cname: code_req = "LE11"
        elif "marketing" in cname: code_req = "DM11"
        elif "web dev" in cname: code_req = "WD11"
        elif "graphic" in cname: code_req = "GC11"
        elif "cyber" in cname: code_req = "CS11"
        elif "data" in cname: code_req = "DS11"
        else: code_req = "CF01" # Default to CIT if unsure and passed

    student_uuid = uuid.UUID(lead['student_uuid'])
    
    # Extract Course Prefix and Batch Number
    # e.g. CF01 -> prefix=CF0, batch_num=1
    # e.g. DM11 -> prefix=DM1, batch_num=1
    prefix = code_req[:-1] if len(code_req) >= 3 else code_req
    batch_num = code_req[-1] if len(code_req) >= 3 else "1"

    
    # Precise Match by code first
    matched_course = Course.objects.filter(course_code=prefix).first()
    if not matched_course:
        # Fallback to course_code == code_req
        matched_course = Course.objects.filter(course_code=code_req).first()

    if not matched_course:
        continue
    
    # Matching Batch by name "Batch {batch_num}"
    batch_name = f"Batch {batch_num}"
    sc = ScheduledClass.objects.filter(course=matched_course, batch__name=batch_name).first()
    
    # Fallback to ANY schedule if batch doesn't exist/match
    if not sc:
        sc = ScheduledClass.objects.filter(course=matched_course).first()

    if sc:
        with transaction.atomic():
            CourseRegistrationHistory.objects.get_or_create(
                student_id=student_uuid,
                course=matched_course,
                scheduled_class=sc,
                defaults={'status': 'enrolled'}
            )
            total_matched += 1


print(f"Enrolled {total_matched} students into CourseRegistrationHistory!")
