"""
Standalone script to:
1. Clear old data
2. Create Specializations and Courses from 'Specializations and TimeTable' sheet  
3. Create Scheduled Classes with teacher assignment
4. Skip if no teacher assigned

Run with: docker exec course-service python setup_all_data.py
"""
import os
import sys
import uuid
import re
import json
from datetime import datetime

sys.path.insert(0, '/app')
sys.path.append('/app/seed_data')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')

import django
django.setup()

from django.db import transaction
from courses.models import Batch, Specialization, Course, ScheduledClass, Room, CourseRegistrationHistory
from google_sheets_util import get_sheet_data

SPREADSHEET_ID = "17wAlHTw5jyvsEmNXlcnOCJvRZo978zIfH4magwSwkBU"

# Load teacher mapping
TEACHER_MAP = {}
if os.path.exists("teacher_mapping.json"):
    with open("teacher_mapping.json") as f:
        try:
            TEACHER_MAP = json.load(f)
            print(f"Loaded {len(TEACHER_MAP)} teachers from mapping.")
        except Exception as e:
            print(f"Warning: Could not parse teacher mapping: {e}")

def parse_time(t):
    if not t or '-' not in str(t):
        return '12:00', '14:00'
    try:
        parts = str(t).split('-')
        def clean(x):
            x = x.strip().lower()
            if ':' in x:
                return datetime.strptime(x, '%I:%M %p').strftime('%H:%M')
            return datetime.strptime(x, '%I %p').strftime('%H:%M')
        return clean(parts[0]), clean(parts[1])
    except:
        return '12:00', '14:00'

def get_days(days_raw):
    day_map = {'M': 'MON', 'T': 'TUE', 'W': 'WED', 'TH': 'THU', 'R': 'THU', 'F': 'FRI', 'S': 'SAT'}
    return [day_map.get(d.strip().upper(), d.strip().upper()) for d in days_raw.split() if d.strip()]

def clean_spec_name(raw):
    """Normalize specialization names to avoid duplicates."""
    name = raw.strip()
    # Remove parenthesized suffixes like (MERN), (CIT)
    name = re.sub(r'\s*\([^)]*\)\s*$', '', name).strip()
    # Remove trailing 'Specialization' word
    if name.lower().endswith(' specialization'):
        name = name[:-len(' specialization')].strip()
    # Remove trailing colons
    name = name.rstrip(':').strip()
    return name

def get_instructor_id(teacher_name):
    """Map teacher name to UUID using fuzzy matching."""
    if not teacher_name:
        return None
    name_clean = teacher_name.strip().lower()
    # Remove honorifics
    for prefix in ['sir ', 'ms ', 'miss ', 'mr ']:
        if name_clean.startswith(prefix):
            name_clean = name_clean[len(prefix):].strip()
    
    # Direct match
    for k, v in TEACHER_MAP.items():
        if k.lower() == name_clean:
            return v
    # Fuzzy match
    for k, v in TEACHER_MAP.items():
        k_clean = k.lower()
        if k_clean in name_clean or name_clean in k_clean:
            return v
    return None

# =================== STEP 1: Clear old data ===================
print("\n[1/3] Clearing old data...")
CourseRegistrationHistory.objects.all().delete()
ScheduledClass.objects.all().delete()
Course.objects.all().delete()
Specialization.objects.all().delete()
Batch.objects.all().delete()
print("Cleared.")

# =================== STEP 2: Create Batches ===================
print("\n[2/3] Creating Batches...")
BATCHES = {}
for b in range(1, 16):
    batch, _ = Batch.objects.get_or_create(name=f"Batch {b}")
    BATCHES[str(b)] = batch
print(f"  Created {len(BATCHES)} batches")

# =================== STEP 3: Sync from TimeTable sheet ===================
print("\n[3/3] Syncing from 'Specializations and TimeTable'...")

tt_rows = get_sheet_data(SPREADSHEET_ID, "'Specializations and TimeTable'!A1:Z500")
print(f"  Found {len(tt_rows)} rows")

spec_count = 0
course_count = 0
schedule_count = 0
skipped_no_teacher = 0

for row in tt_rows:
    spec_raw = row.get('Specialization', '').strip()
    course_raw = row.get('Course', '').strip()
    code = row.get('Code', '').strip()
    section = str(row.get('Section', '')).strip()
    teacher = row.get('Teacher', '').strip()
    time_raw = row.get('Time', '').strip()
    days_raw = row.get('Days', '').strip()
    students_raw = str(row.get('Students', '0')).strip() or '0'
    room_name = row.get('Lab | Class', 'Lab 1').strip()

    if not spec_raw or not code:
        continue

    # NEW: Normalize code (e.g. CF01 -> code='CF0', section='1')
    match = re.match(r'^([A-Za-z]+\d*)([1-9]\d*)$', code)
    base_code = code
    parsed_section = section
    
    if match:
        base_code = match.group(1)
        parsed_section = match.group(2)
        # Use the parsed section if the explicit section was empty
        if not section:
            section = parsed_section

    # Clean specialization name (no duplicates!)
    spec_name = clean_spec_name(spec_raw)
    
    # Clean course name
    course_name_clean = course_raw.replace(':', '').strip()
    full_course_name = f"{spec_name}" # Use Specialization Name as Course Name if Course is empty or just generic

    # Map section to batch
    batch_key = section if section in BATCHES else '4'
    current_batch = BATCHES[batch_key]

    with transaction.atomic():
        # Global specialization
        spec, spec_created = Specialization.objects.get_or_create(name=spec_name)
        if spec_created:
            spec_count += 1

        course, course_created = Course.objects.get_or_create(
            course_code=base_code, # Use the BASE code (e.g. CF0)
            defaults={
                'name': full_course_name, # Course name is the Specialization name
                'specialization': spec,
                'description': f'Base Code: {base_code}',
                'active': True
            }
        )
        if course_created:
            course_count += 1

        room, _ = Room.objects.get_or_create(name=room_name, defaults={'capacity': 50})

        # Skip if no teacher
        if not teacher:
            skipped_no_teacher += 1
            print(f"  ⚠ Skipping schedule for {code} section {section} | No teacher")
            continue

        instructor_id = get_instructor_id(teacher)
        if not instructor_id:
            skipped_no_teacher += 1
            print(f"  ⚠ Skipping schedule for {code} section {section} | Teacher '{teacher}' not in mapping")
            continue

        start_t, end_t = parse_time(time_raw)
        days = get_days(days_raw)

        sc, _ = ScheduledClass.objects.update_or_create(
            course=course,
            batch=current_batch,
            section=str(section),
            defaults={
                'room': room,
                'instructor_id': instructor_id,
                'start_time': start_t,
                'end_time': end_t,
                'days': days,
                'ramdan_time': row.get('Ramdan Time', ''),
                'total_students': int(students_raw) if students_raw.isdigit() else 0,
            }
        )
        schedule_count += 1
        print(f"  ✓ {code} sec {section} | {full_course_name} | Teacher: {teacher}")

print(f"\n✅ DONE!")
print(f"   Specializations: {spec_count}")
print(f"   Courses: {course_count}")
print(f"   Scheduled Classes: {schedule_count}")
print(f"   Skipped (no teacher): {skipped_no_teacher}")
