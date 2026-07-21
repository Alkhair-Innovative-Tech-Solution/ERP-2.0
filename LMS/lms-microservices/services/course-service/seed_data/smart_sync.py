import os
import django
import sys
import json
import uuid

# Setup Django Environment
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
django.setup()

from courses.models import Course, ScheduledClass, CourseRegistrationHistory, StudentDeposit

def smart_sync_enrollments():
    MAPPING_FILE = 'enrollment_mapping.json'
    REAL_IDS_FILE = 'real_user_ids.json'
    
    if not os.path.exists(MAPPING_FILE) or not os.path.exists(REAL_IDS_FILE):
        print(f"Error: Required files missing.")
        return

    with open(MAPPING_FILE, 'r') as f:
        enrollments_data = json.load(f)
        
    with open(REAL_IDS_FILE, 'r', encoding='utf-8-sig') as f:
        real_ids_mapping = json.load(f)

    print(f"Loaded {len(enrollments_data)} records from mapping.")
    print(f"Loaded {len(real_ids_mapping)} real user IDs from Auth Service.")

    # Total Purge Logic for Enrollments
    print("🧹 Purging existing registrations for a clean slate...")
    CourseRegistrationHistory.objects.all().delete()
    StudentDeposit.objects.all().delete()

    success_count = 0
    missing_user_count = 0
    missing_class_count = 0
    error_count = 0

    for item in enrollments_data:
        try:
            email = item.get('email', '').lower()
            course_name = item.get('course_name')
            section = str(item.get('section', ''))
            
            # 1. Get the REAL student_id
            real_student_id = real_ids_mapping.get(email)
            if not real_student_id:
                missing_user_count += 1
                continue

            # 2. Find the Course
            course = Course.objects.filter(name__iexact=course_name).first()
            if not course:
                # Try by code if name failed? Most mappings use names.
                continue

            # 3. Find the ScheduledClass
            scheduled_class = ScheduledClass.objects.filter(course=course, section=section).first()
            
            if not scheduled_class:
                # Handle prefixes like 11 -> 1, 114 -> 14 or 4
                # Try stripping the first '1' if length > 1
                if len(section) > 1 and section.startswith('1'):
                    stripped_section = section[1:]
                    scheduled_class = ScheduledClass.objects.filter(course=course, section=stripped_section).first()
            
            if not scheduled_class:
                # Padded check (1 -> 01)
                scheduled_class = ScheduledClass.objects.filter(course=course, section=section.zfill(2)).first()
            
            if not scheduled_class:
                # Last resort fallback: any section
                scheduled_class = ScheduledClass.objects.filter(course=course).first()

            if not scheduled_class:
                missing_class_count += 1
                continue

            # 4. Create Enrollment
            CourseRegistrationHistory.objects.create(
                student_id=uuid.UUID(real_student_id),
                course=course,
                scheduled_class=scheduled_class,
                status='enrolled'
            )

            # 5. Create Deposit record
            StudentDeposit.objects.create(
                student_id=uuid.UUID(real_student_id),
                course=course,
                deposit_amount=3000,
                bag_taken=False,
                id_card_taken=False
            )
            
            success_count += 1

        except Exception as e:
            print(f"  ❌ Error for {email}: {e}")
            error_count += 1

    print(f"\nEnrollment Sync Finished!")
    print(f"Successfully Enrolled: {success_count}")
    print(f"Missing Users: {missing_user_count}")
    print(f"Missing Classes: {missing_class_count}")
    print(f"Errors: {error_count}")

if __name__ == "__main__":
    smart_sync_enrollments()
