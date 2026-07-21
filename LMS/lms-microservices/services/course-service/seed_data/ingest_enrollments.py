"""
ingest_enrollments.py
─────────────────────────────────────────────────────────────────────
Reads master_enrollment_mapping.json (produced by seed_students_from_master.py)
and creates CourseRegistrationHistory + StudentDeposit records in course-service.

JSON format expected:
[
  {
    "email": "student@example.com",
    "student_user_id": "uuid",
    "enrollments": [
      {
        "course_code": "AI1",
        "course_name": "AI & Data Science with Python Beginner",
        "section": "3",
        "status": "enrolled"    ← or "completed"
      },
      ...
    ]
  },
  ...
]

Run order:
  1. seed_teachers_from_sheet.py   (auth-service)
  2. import_academic_structure.py  (course-service)
  3. seed_students_from_master.py  (auth-service)
  4. THIS script                   (course-service)

Run: docker exec course-service python ingest_enrollments.py
"""
import os
import django
import sys
import json

# Setup Django Environment
sys.path.append('/app')
sys.path.append('/app/seed_data')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
django.setup()

from courses.models import Course, ScheduledClass, CourseRegistrationHistory, StudentDeposit


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def find_scheduled_class(course, section):
    """
    Look up a ScheduledClass by course + section.
    Tries exact match first, then zero-padded/stripped variants.
    Falls back to any section for the course if nothing matches.
    """
    # Exact
    sc = ScheduledClass.objects.filter(course=course, section=section).first()
    if sc:
        return sc, False

    # Padded: "1" → "01"
    if len(section) == 1:
        sc = ScheduledClass.objects.filter(course=course, section=f"0{section}").first()
        if sc:
            return sc, False

    # Stripped: "01" → "1"
    sc = ScheduledClass.objects.filter(course=course, section=section.lstrip('0')).first()
    if sc:
        return sc, False

    # Fallback: any section for the course
    sc = ScheduledClass.objects.filter(course=course).first()
    return sc, True   # True = fallback was used


def ingest_enrollments():
    MAPPING_FILE = 'master_enrollment_mapping.json'

    if not os.path.exists(MAPPING_FILE):
        print(f"❌ {MAPPING_FILE} not found. Run seed_students_from_master.py first.")
        return

    with open(MAPPING_FILE, 'r') as f:
        student_records = json.load(f)

    total_enrollments  = sum(len(r.get('enrollments', [])) for r in student_records)
    print(f"Starting ingestion: {len(student_records)} students, "
          f"{total_enrollments} enrollment records...")

    success_count     = 0
    completed_count   = 0
    missing_course    = 0
    missing_class     = 0
    fallback_count    = 0
    error_count       = 0
    affected_classes  = set()  # scheduled_class PKs to recount at end

    # ── Build a quick course lookup cache keyed by course_code ────────────
    course_cache = {}   # course_code (str) → Course obj or None

    for record in student_records:
        student_id  = record.get('student_user_id')
        email       = record.get('email', '')
        slip_no     = record.get('slip_no', '')
        enrollments = record.get('enrollments', [])

        if not student_id:
            continue

        for enroll in enrollments:
            course_code = enroll.get('course_code', '')
            course_name = enroll.get('course_name', '')
            section     = enroll.get('section', '1')
            status      = enroll.get('status', 'enrolled')   # 'enrolled' or 'completed'

            try:
                # ── 1. Find Course ─────────────────────────────────────────
                if course_code not in course_cache:
                    course_cache[course_code] = (
                        Course.objects.filter(course_code__iexact=course_code).first()
                        or Course.objects.filter(name__iexact=course_name).first()
                    )
                course = course_cache[course_code]

                if not course:
                    print(f"  ⚠  [{email}] Course '{course_code}' not found. Skipping.")
                    missing_course += 1
                    continue

                # ── 2. Find ScheduledClass ─────────────────────────────────
                scheduled_class, used_fallback = find_scheduled_class(course, section)

                if not scheduled_class:
                    print(f"  ⚠  [{email}] No ScheduledClass for {course_code}-{section}.")
                    missing_class += 1
                    continue

                if used_fallback:
                    fallback_count += 1

                # ── 3. Map status to CourseRegistrationHistory choices ─────
                reg_status = status if status in ('enrolled', 'completed') else 'enrolled'

                # ── 4. Deposit-first: create deposit record from sheet data ─
                if reg_status == 'enrolled':
                    bag_status = enroll.get('bag_status', 'no')
                    id_card_status = enroll.get('id_card_status', 'no')
                    deposit_returned = enroll.get('deposit_returned', 'no')
                    is_paid = enroll.get('is_paid', False)
                    is_waiver = enroll.get('is_waiver', False)

                    bag_taken = bag_status in ['yes', 'y', 'paid', 'waiver', 'waived']
                    bag_fee = 0 if bag_status in ['waiver', 'waived'] else 800
                    id_card_taken = id_card_status in ['yes', 'y', 'paid', 'waiver', 'waived']
                    id_card_fee = 0 if id_card_status in ['waiver', 'waived'] else 200
                    is_returned = deposit_returned in ['yes', 'y', 'returned']
                    deposit_remarks = 'Waiver' if is_waiver else ('' if is_paid else 'Deposit unpaid')

                    StudentDeposit.objects.update_or_create(
                        student_id=student_id,
                        course=course,
                        defaults={
                            'deposit_amount': 0 if is_waiver else 3000,
                            'receipt_number': slip_no or None,
                            'is_waived':      is_waiver,
                            'deposit_paid':   is_paid,
                            'bag_taken':      bag_taken,
                            'bag_fee':        bag_fee,
                            'id_card_taken':  id_card_taken,
                            'id_card_fee':    id_card_fee,
                            'is_returned':    is_returned,
                            'remarks':        deposit_remarks,
                        }
                    )

                # ── 5. Now create enrollment ───────────────────────────────
                CourseRegistrationHistory.objects.update_or_create(
                    student_id=student_id,
                    course=course,
                    scheduled_class=scheduled_class,
                    defaults={'status': reg_status}
                )
                
                if scheduled_class:
                    affected_classes.add(scheduled_class.pk)

                if reg_status == 'enrolled':
                    success_count += 1
                else:
                    completed_count += 1

            except Exception as e:
                print(f"  ❌ Error [{email}] {course_code}-{section}: {e}")
                error_count += 1

    # ── Batch recount total_students for affected classes ────────────────
    print(f"\n📊 Recounting total_students for {len(affected_classes)} classes...")
    for pk in affected_classes:
        sc = ScheduledClass.objects.filter(pk=pk).first()
        if sc:
            sc.total_students = ScheduledClass.objects.filter(
                enrolled_students__course=sc.course,
                enrolled_students__scheduled_class=sc,
                enrolled_students__status='enrolled'
            ).count()
            sc.save(update_fields=['total_students'])
    print(f"   Done.")

    print(f"\nEnrollment Ingestion Finished!")
    print(f"  ✅ Enrolled (active)     : {success_count}")
    print(f"  📚 Completed (history)   : {completed_count}")
    print(f"  ⚠  Missing course        : {missing_course}")
    print(f"  ⚠  Missing class/section : {missing_class}")
    print(f"  ℹ  Fallback section used : {fallback_count}")
    print(f"  ❌ Errors                : {error_count}")


if __name__ == "__main__":
    ingest_enrollments()
