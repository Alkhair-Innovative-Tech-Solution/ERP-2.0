import os
import django
import sys
import json
import csv
import glob
import re

# Setup Django Environment
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
django.setup()

from courses.models import Course, ScheduledClass, CourseRegistrationHistory

def enroll_students():
    mapping_path = '/app/student_mapping.json'
    if not os.path.exists(mapping_path):
        print("Missing student_mapping.json")
        return

    with open(mapping_path, 'r', encoding='utf-8') as f:
        mapping = json.load(f)

    csv_files = glob.glob('/app/google_enroll_*.csv')
    if not csv_files:
        print("No CSV files found matching google_enroll_*.csv")
        return

    enrolled_count = 0
    skipped_count = 0
    error_count = 0

    print(f"Loaded {len(mapping)} students from mapping.")

    # Cache classes to avoid continuous DB hits
    # Key: (course_code, section)
    class_cache = {}
    
    for filepath in csv_files:
        filename = os.path.basename(filepath)
        print(f"Processing file: {filename}...")
        try:
            with open(filepath, mode='r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                rows = list(reader)
                
            for i, row in enumerate(rows):
                normalized_row = {k.strip(): str(v).strip() for k, v in row.items() if k is not None}
                
                student_id_val = normalized_row.get('Student ID', '')
                dp = normalized_row.get('DP', '').upper()
                email = normalized_row.get('Email', '').lower()
                section = normalized_row.get('Batch', '') or normalized_row.get('Section', '')
                
                # Check criteria (same as auth-service)
                if not student_id_val or dp not in ('Y', 'YES', 'TRUE'):
                    continue
                
                user_id = mapping.get(email)
                if not user_id:
                    # Either skipped or error during student creation
                    continue
                
                # Deduplicate: Check if already enrolled
                if CourseRegistrationHistory.objects.filter(student_id=user_id).exists():
                    skipped_count += 1
                    continue

                try:
                    # Extract Course Code from Student ID (e.g. AIT25-GC11-0334 -> GC1)
                    # Often format is prefix-code_section-id e.g. AIT25-GC11-xxxx
                    parts = student_id_val.split('-')
                    if len(parts) >= 2:
                        code_sec = parts[1]
                        match = re.match(r'^([A-Za-z]+\d*)([1-9]\d*)$', code_sec)
                        if match:
                            base_code = match.group(1)
                            parsed_sec = match.group(2)
                        else:
                            base_code = code_sec
                            parsed_sec = ''
                    else:
                        base_code = ''
                        parsed_sec = ''
                        
                    # Fallback if section wasn't deduced
                    if not section:
                        section = parsed_sec
                        
                    scheduled_class = class_cache.get(code_sec)
                    
                    if not scheduled_class:
                        # Find the scheduled class by looking at all classes in the section
                        # and checking if the code_sec prefix matches the DB course_code
                        possible_classes = ScheduledClass.objects.all()
                        
                        for pc in possible_classes:
                            db_code = pc.course.course_code.lower()
                            db_section = pc.section.lower() if pc.section else ''
                            
                            # code_sec from student ID (e.g. "WD14" or "CF010")
                            # We just need it to start with the db_code
                            if code_sec.lower().startswith(db_code):
                                # now check if the section matches
                                # Option A: section matches the CSV Batch column
                                if section and db_section == section.lower():
                                    scheduled_class = pc
                                    break
                                # Option B: if the suffix of code_sec matches the db_section
                                elif db_section and code_sec.lower().endswith(db_section):
                                    scheduled_class = pc
                                    break
                        
                        if scheduled_class:
                            class_cache[code_sec] = scheduled_class
                    
                    if not scheduled_class:
                        print(f"  Warning: No scheduled class found for user {email} with code={base_code}, section={section}")
                        error_count += 1
                        continue
                        
                    # Enroll student
                    CourseRegistrationHistory.objects.create(
                        student_id=user_id,
                        course=scheduled_class.course,
                        scheduled_class=scheduled_class,
                        status='enrolled'
                    )
                    
                    # Update students count for the class
                    scheduled_class.total_students += 1
                    scheduled_class.save(update_fields=['total_students'])

                    enrolled_count += 1
                    
                except Exception as e:
                    print(f"    Error enrolling student {email} (ID: {student_id_val}): {e}")
                    error_count += 1
                    
        except Exception as e:
            print(f"  Failed to process file {filename}: {e}")

    print(f"\nEnrollment finished!")
    print(f"Successfully Enrolled: {enrolled_count}")
    print(f"Skipped (Already Enrolled): {skipped_count}")
    print(f"Errors (Missing Class / Code issues): {error_count}")

if __name__ == "__main__":
    enroll_students()
