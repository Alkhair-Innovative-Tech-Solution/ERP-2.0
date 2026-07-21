import os
import django
import sys
import json
import uuid

# Setup Django Environment
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
django.setup()

from courses.models import ScheduledClass

def fix_instructor_ids():
    TEACHER_IDS_FILE = 'teacher_ids.json'
    
    if not os.path.exists(TEACHER_IDS_FILE):
        print(f"Error: {TEACHER_IDS_FILE} not found.")
        return

    with open(TEACHER_IDS_FILE, 'r', encoding='utf-8-sig') as f:
        teacher_mapping = json.load(f)

    print(f"Loaded {len(teacher_mapping)} teacher IDs from Auth Service.")

    classes = ScheduledClass.objects.all()
    updated_count = 0
    not_found_count = 0

    for sc in classes:
        t_name = sc.teacher_name
        if not t_name:
            continue
            
        # Try exact match
        new_id = teacher_mapping.get(t_name)
        
        # Spelling Fixes
        if not new_id:
            if t_name == "Mudassir": new_id = teacher_mapping.get("Muddasir")
            if t_name == "Mubashir": new_id = teacher_mapping.get("Mubashir Adam")
        
        # Try case-insensitive if exact match fails
        if not new_id:
            for name, tid in teacher_mapping.items():
                if name.lower() == t_name.lower():
                    new_id = tid
                    break
        
        if new_id:
            sc.instructor_id = uuid.UUID(new_id)
            sc.save(update_fields=['instructor_id'])
            updated_count += 1
        else:
            print(f"  ⚠ Teacher '{t_name}' not found in Auth Service mapping.")
            not_found_count += 1

    print(f"\nInstructor Fix Finished!")
    print(f"Successfully Updated: {updated_count}")
    print(f"Teachers Not Found: {not_found_count}")

if __name__ == "__main__":
    fix_instructor_ids()
