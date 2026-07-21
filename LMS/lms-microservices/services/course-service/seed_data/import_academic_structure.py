"""
import_academic_structure.py
────────────────────────────────────────────────────────────────────
Reads 'Specializations and TimeTable' sheet and creates/updates the
full academic hierarchy:

    Specialization → Course (keyed by full code e.g. AI1, AI2)
                           → ScheduledClass (one per Section/batch)

Key fixes vs. previous version:
  • Course is keyed by FULL code (AI1 / AI2 separate records, not "AI")
  • Section comes from the dedicated 'Section' column, NOT extracted from code
  • Ass. Teacher is read from its own column, not split from Teacher column
  • Course Status → ScheduledClass.status + active flag
  • Strength Status → ScheduledClass.strength_status
  • All extra date/exam/certificate fields are populated
  • Exports course_mapping.json and section_mapping.json for student seeding

Run order:
  1. seed_teachers_from_sheet.py   (auth-service)
  2. THIS script                   (course-service)
  3. seed_students_from_master.py  (auth-service)
  4. ingest_enrollments.py         (course-service)

Run: docker exec course-service python import_academic_structure.py
"""
import os
import django
import sys
import json
import re
from datetime import datetime

# Setup Django Environment (Robust Pathing)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)
if '/app' not in sys.path:
    sys.path.append('/app')
if '/app/seed_data' not in sys.path:
    sys.path.append('/app/seed_data')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
django.setup()

from django.db import transaction
from courses.models import Specialization, Course, ScheduledClass, Room, Branch
try:
    from google_sheets_util import read_csv_data
except ImportError:
    from .google_sheets_util import read_csv_data

CSV_FILE = os.environ.get('TIMETABLE_CSV', '/app/seed_data/timetable.csv')

# Full course name for each course code.
# Must stay in sync with COURSE_NAME_MAP in seed_students_from_master.py
COURSE_NAME_MAP = {
    'AI1': 'AI & Data Science with Python Beginner',
    'AI2': 'AI & Data Science with Python Advance',
    'CS1': 'Cybersecurity Beginner',
    'CS2': 'Cybersecurity Advance',
    'DM1': 'Digital Marketing Beginner',
    'DM2': 'Digital Marketing Advance',
    'CF0': 'Fundamentals(CIT) Level 0',
    'GC1': 'Graphic Designing & Video Editing Beginner',
    'GC2': 'Graphic Designing & Video Editing Advance',
    'GD1': 'Game Development Beginner',
    'GD2': 'Game Development Advance',
    'LE1': 'Language: English Beginner',
    'LE2': 'Language: English Advance',
    'PM1': 'Project Management Beginner',
    'WD1': 'Web Development (MERN) Beginner',
    'WD2': 'Web Development (MERN) Advance',
}


# ─────────────────────────────────────────────────────────────────────────────
# Load teacher mapping produced by seed_teachers_from_sheet.py
# Check local dir first, then shared volume
# ─────────────────────────────────────────────────────────────────────────────
TEACHER_MAP = {}
mapping_paths = ["/app/shared/teacher_mapping.json", "teacher_mapping.json"]
for path in mapping_paths:
    if os.path.exists(path):
        with open(path) as f:
            TEACHER_MAP = json.load(f)
        print(f"✅ Loaded teacher mapping from {path}")
        break
else:
    print("⚠  teacher_mapping.json not found — teachers will not be linked.")

# Case-insensitive lookup map
CLEAN_MAP = {k.strip().lower(): v for k, v in TEACHER_MAP.items()}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def truncate(val, length=255):
    if not val:
        return val
    return str(val).strip()[:length]


def parse_date(date_str):
    """Parse various date formats found in the sheet. Returns date or None."""
    if not date_str:
        return None
    try:
        date_str = str(date_str).strip()
        for fmt in (
            '%A, %B %d, %Y',   # Wednesday, April 1, 2026
            '%d-%b-%Y',         # 7-Oct-2026
            '%d/%m/%Y',
            '%Y-%m-%d',
            '%m/%d/%Y',
            '%b %d, %Y',
        ):
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        return None
    except Exception:
        return None


def parse_time(t):
    """Parse time range string like '3 pm - 4:45 pm' into ('15:00', '16:45')."""
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
    except Exception:
        return '12:00', '14:00'


def get_days(days_raw):
    """Convert abbreviated day string 'M W F' → ['MON', 'WED', 'FRI']."""
    day_map = {
        'M':  'MON', 'T': 'TUE', 'W': 'WED',
        'R': 'THU', 'F': 'FRI', 'S': 'SAT',
    }
    return [
        day_map.get(d.strip().upper(), d.strip().upper())
        for d in days_raw.split()
        if d.strip()
    ]


def map_strength_status(raw):
    """Map sheet Strength Status text to model choice value."""
    mapping = {
        'full':           'full',
        'seats available': 'seats_available',
        'filling fast':   'filling_fast',
    }
    return mapping.get((raw or '').strip().lower(), 'seats_available')


def map_course_status(raw):
    """
    Map sheet 'Course Status' → (status, active).
    Active   → ('active',    True)
    Complete → ('completed', False)
    Pending  → ('upcoming',  True)   admissions open, classes not started
    """
    r = (raw or '').strip().lower()
    if r == 'complete':
        return 'completed', False
    if r == 'pending':
        return 'upcoming', True
    return 'active', True          # default: Active


def map_admission_status(raw):
    """
    Map sheet 'Course Status' → admission_status on Course model.
    Active   → 'open'
    Complete → 'closed'
    Pending  → 'coming_soon'
    """
    r = (raw or '').strip().lower()
    if r == 'complete':
        return 'closed'
    if r == 'active':
        return 'open'
    return 'coming_soon'


def parse_duration(raw):
    """Parse 'Durration' column into integer months. Returns 6 if unparseable."""
    if not raw:
        return 6
    try:
        return int(str(raw).strip())
    except (ValueError, TypeError):
        return 6


def get_teacher_id(name):
    """Look up teacher UUID from name (case-insensitive)."""
    if not name:
        return None
    name = name.strip()
    # Exact match first
    if name in TEACHER_MAP:
        return TEACHER_MAP[name]
    # Case-insensitive fallback
    return CLEAN_MAP.get(name.lower())


# ─────────────────────────────────────────────────────────────────────────────
# Main import function
# ─────────────────────────────────────────────────────────────────────────────

def import_classes():
    print(f"Reading data from {CSV_FILE}...")
    rows = read_csv_data(CSV_FILE)

    if not rows:
        print("No data found.")
        return

    print(f"Loaded {len(rows)} rows. Importing...")

    spec_count = course_count = class_count = error_count = 0

    # Lookup maps written out at the end for use by seed_students_from_master.py
    section_mapping = {}   # "AI1-3" → {scheduled_class_id, course_id, …}
    course_mapping  = {}   # "AI1"   → {id, name, level, specialization}

    for i, row in enumerate(rows):

        # ── Read raw columns ──────────────────────────────────────────────
        spec_name        = row.get('Specialization', '').strip()
        code_raw         = row.get('Code', '').strip().upper()          # e.g. AI1
        section          = str(row.get('Section', '')).strip()          # e.g. 3
        teacher_name     = row.get('Teacher', '').strip()
        ass_teacher_name = row.get('Ass. Teacher', '').strip()
        time_raw         = row.get('Time', '').strip()
        days_raw         = row.get('Days', '').strip()
        lab_room_raw     = row.get('Lab | class', '').strip()
        strength_raw     = row.get('Strength Status', '').strip()
        course_status_raw= row.get('Course Status', '').strip()
        duration_raw     = row.get('Durration', '').strip()
        description_raw  = row.get('Description', '').strip()

        # ── Date columns ──────────────────────────────────────────────────
        admission_open     = parse_date(row.get('Admission Open Date'))
        start_date         = parse_date(row.get('Satrt Date'))          # sheet typo kept
        end_date           = parse_date(row.get('End Date'))
        exam_date          = parse_date(row.get('Exam Date'))
        certificate_date   = parse_date(row.get('Certificate Date'))
        exam_status        = truncate(row.get('Exam Status', ''), 50)
        certificate_status = truncate(row.get('Certificate Status', ''), 50)

        try:
            total_students     = int(str(row.get('Students',    '0') or '0').strip())
        except (ValueError, TypeError):
            total_students = 0
        try:
            total_applications = int(str(row.get('Applications', '0') or '0').strip())
        except (ValueError, TypeError):
            total_applications = 0

        # Skip rows that are missing the minimum required fields
        if not spec_name or not code_raw:
            continue

        # ── Derive level from code suffix (AI1→1, AI2→2; CF0→1) ─────────
        if code_raw.startswith('CF'):
            level_val = 1
        elif code_raw[-1:] == '2':
            level_val = 2
        else:
            level_val = 1

        # ── Course name from map, fallback to composed name ───────────────
        course_name = COURSE_NAME_MAP.get(
            code_raw,
            f"{spec_name} {'Advance' if level_val == 2 else 'Beginner'}"
        )

        # ── Status mapping ────────────────────────────────────────────────
        session_status, is_active = map_course_status(course_status_raw)
        strength_status           = map_strength_status(strength_raw)

        try:
            with transaction.atomic():

                # 1. Specialization ────────────────────────────────────────
                spec, created = Specialization.objects.get_or_create(
                    name=truncate(spec_name, 255),
                    defaults={'active': True}
                )
                if created:
                    spec_count += 1

                # 2. Course — keyed by FULL code (AI1 ≠ AI2) ──────────────
                course_duration  = parse_duration(duration_raw)
                course_admission = map_admission_status(course_status_raw)
                course, created = Course.objects.update_or_create(
                    course_code=truncate(code_raw, 50),
                    defaults={
                        'name':               truncate(course_name, 255),
                        'specialization':     spec,
                        'level':              level_val,
                        'duration':           course_duration,
                        'description':        truncate(description_raw, 500) or None,
                        'active':             True,
                        'admission_status':   course_admission,
                        'course_start_date':  start_date,
                        'course_end_date':    end_date,
                        'admission_open_date':admission_open,
                    }
                )
                if created:
                    course_count += 1

                # 3. Room — stored for display; 'Lab | Class' col may say
                #    "Complete" for finished batches, store as-is.
                room_name = lab_room_raw if lab_room_raw else 'Unassigned'
                
                # Determine default branch for room based on common naming patterns
                room_branch_lookup = {
                    '0 | C': 'Main Branch',
                    '1 | A': 'Main Branch',
                    '2 | A': 'Main Branch',
                    '2 | B': 'Main Branch',
                    '2 | C': 'Main Branch',
                    '1 | B': 'Main Branch',
                }
                default_branch_name = room_branch_lookup.get(room_name, 'Main Branch')
                
                room, _   = Room.objects.get_or_create(
                    name=truncate(room_name, 100)
                )
                
                # Assign branch to room if not already set (try name → contains → code)
                if not room.branch:
                    branch_obj = (
                        Branch.objects.filter(name=default_branch_name).first() or
                        Branch.objects.filter(name__icontains='Main').first() or
                        Branch.objects.filter(code='MAIN').first()
                    )
                    if branch_obj:
                        room.branch = branch_obj
                        room.save(update_fields=['branch'])

                # 4. Teacher IDs — assign all to ONE ScheduledClass ──────────
                all_teachers = [n.strip() for n in re.split(r'[|,]', teacher_name) if n.strip()] if teacher_name else []
                assistant_name = re.split(r'[|,]', ass_teacher_name)[0].strip() if ass_teacher_name else ''
                all_names = all_teachers + ([assistant_name] if assistant_name and assistant_name not in all_teachers else [])

                if not all_names:
                    print(f"  ⚠  Row {i+1}: No teacher found. Skipping.")
                    continue

                # Map every name to UUID upfront
                name_uuid = {}
                for n in all_names:
                    uid = get_teacher_id(n)
                    if uid:
                        name_uuid[n] = uid
                    else:
                        print(f"  ⚠  Row {i+1}: Teacher '{n}' not in mapping. Skipping teacher.")

                if not name_uuid:
                    print(f"  ⚠  Row {i+1}: No teacher UUIDs resolved. Skipping.")
                    continue

                # Assign roles
                main_instructor_name = all_teachers[0] if all_teachers else assistant_name
                main_instructor_id   = name_uuid.get(main_instructor_name)

                additional_ids = []
                for t in all_teachers[1:]:
                    uid = name_uuid.get(t)
                    if uid:
                        additional_ids.append(str(uid))

                assistant_id = None
                if assistant_name and assistant_name != main_instructor_name:
                    assistant_id = name_uuid.get(assistant_name)

                # teacher_name = comma-separated display of all teachers
                teacher_name_display = ', '.join(n for n in all_names if n in name_uuid)

                start_t, end_t = parse_time(time_raw)
                days           = get_days(days_raw) if days_raw else []

                # 5. ScheduledClass — find existing by (course, section) or create
                section_val = truncate(section, 50)
                existing_sc = ScheduledClass.objects.filter(
                    course=course, section=section_val
                ).first()
                if existing_sc:
                    existing_sc.instructor_id = main_instructor_id
                    existing_sc.additional_teacher_ids = additional_ids
                    existing_sc.assistant_teacher_id = assistant_id
                    existing_sc.teacher_name = teacher_name_display
                    existing_sc.room = room
                    existing_sc.lab_room = lab_room_raw
                    existing_sc.start_time = start_t
                    existing_sc.end_time = end_t
                    existing_sc.days = days
                    existing_sc.ramdan_time = truncate(row.get('Ramdan Time', ''), 100)
                    existing_sc.total_students = total_students
                    existing_sc.total_applications = total_applications
                    existing_sc.admission_open_date = admission_open
                    existing_sc.course_start_date = start_date
                    existing_sc.course_end_date = end_date
                    existing_sc.exam_date = exam_date
                    existing_sc.exam_status = exam_status
                    existing_sc.certificate_date = certificate_date
                    existing_sc.certificate_status = certificate_status
                    existing_sc.strength_status = strength_status
                    existing_sc.course_start_date = start_date
                    existing_sc.course_end_date = end_date
                    existing_sc.save()
                    # Override auto-computed status with sheet values
                    ScheduledClass.objects.filter(id=existing_sc.id).update(status=session_status, active=is_active)
                    existing_sc.refresh_from_db()
                    sc = existing_sc
                    print(f"  ✅ Updated existing class: {course.course_code} section {section}")
                else:
                    sc = ScheduledClass.objects.create(
                        course=course,
                        section=section_val,
                        instructor_id=main_instructor_id,
                        additional_teacher_ids=additional_ids,
                        assistant_teacher_id=assistant_id,
                        teacher_name=teacher_name_display,
                        room=room,
                        lab_room=lab_room_raw,
                        start_time=start_t,
                        end_time=end_t,
                        days=days,
                        ramdan_time=truncate(row.get('Ramdan Time', ''), 100),
                        total_students=total_students,
                        total_applications=total_applications,
                        admission_open_date=admission_open,
                        course_start_date=start_date,
                        course_end_date=end_date,
                        exam_date=exam_date,
                        exam_status=exam_status,
                        certificate_date=certificate_date,
                        certificate_status=certificate_status,
                        strength_status=strength_status,
                    )
                    # Override auto-computed status with sheet values
                    ScheduledClass.objects.filter(id=sc.id).update(status=session_status, active=is_active)
                    sc.refresh_from_db()
                    print(f"  ✅ Created new class: {course.course_code} section {section}")
                class_count += 1

                # ── Build section_mapping (single key per section) ──────
                map_key = f"{code_raw}-{section}"
                section_mapping[map_key] = {
                    'scheduled_class_id': str(sc.id),
                    'course_id':          str(course.id),
                    'course_name':        course_name,
                    'course_code':        code_raw,
                    'section':            section,
                    'teacher_name':       teacher_name_display,
                    'status':             session_status,
                }

                # course_mapping — one entry per course code (not per teacher)
                course_mapping[code_raw] = {
                    'id':             str(course.id),
                    'name':           course_name,
                    'level':          level_val,
                    'specialization': spec_name,
                }

        except Exception as e:
            print(f"  ❌ Error on row {i+1}: {e}")
            error_count += 1

    # ── Summary ───────────────────────────────────────────────────────────
    print(f"\nImport finished!")
    print(f"  Created Specializations          : {spec_count}")
    print(f"  Created/Updated Courses          : {course_count}")
    print(f"  Created/Updated Scheduled Classes: {class_count}")
    print(f"  Errors                           : {error_count}")

    # ── Export mapping files ───────────────────────────────────────────────
    # specialization_mapping.json  (existing — kept for compatibility)
    spec_map = {s.name: str(s.id) for s in Specialization.objects.all()}
    with open('specialization_mapping.json', 'w') as f:
        json.dump(spec_map, f, indent=4)
    print("✅ specialization_mapping.json saved.")

    # course_mapping.json  — code → {id, name, …}
    with open('course_mapping.json', 'w') as f:
        json.dump(course_mapping, f, indent=4)
    print("✅ course_mapping.json saved.")

    # section_mapping.json  — "AI1-3" → {scheduled_class_id, course_id, …}
    with open('section_mapping.json', 'w') as f:
        json.dump(section_mapping, f, indent=4)
    sample_key = next(iter(section_mapping), 'N/A')
    print(f"✅ section_mapping.json saved.  (example key: '{sample_key}')")


if __name__ == "__main__":
    import_classes()
