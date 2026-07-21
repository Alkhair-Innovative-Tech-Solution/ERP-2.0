import os
import django
import requests
import uuid
import sys
import json

# Setup Django Environment
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
django.setup()

from courses.models import ScheduledClass

def repair_instructor_ids():
    print("🔍 Starting Instructor ID Repair...")
    
    # 1. Read users from dump
    try:
        print(f"📖 Reading users from users_dump.json...")
        # PowerShell redirection often creates UTF-16 files on Windows
        try:
            with open('users_dump.json', 'r', encoding='utf-16') as f:
                users = json.load(f)
        except:
            with open('users_dump.json', 'r', encoding='utf-8') as f:
                users = json.load(f)
        
        # Map lowercased name to UUID
        user_map = {u['full_name'].strip().lower(): u['id'] for u in users if u['role'] == 'teacher'}
        print(f"✅ Found {len(user_map)} teachers in dump.")
        
    except Exception as e:
        print(f"❌ Error connecting to Auth Service: {e}")
        return

    # 2. Update ScheduledClasses
    classes = ScheduledClass.objects.all()
    updated_count = 0
    not_found_names = set()

    for sc in classes:
        if not sc.teacher_name:
            continue
            
        name_key = sc.teacher_name.strip().lower()
        if name_key in user_map:
            new_id = user_map[name_key]
            if str(sc.instructor_id) != str(new_id):
                sc.instructor_id = new_id
                sc.save()
                updated_count += 1
                print(f"  ✨ Updated: {sc.teacher_name} -> {new_id}")
        else:
            not_found_names.add(sc.teacher_name)

    print(f"🚀 Repair Finished!")
    print(f"✅ Total Classes Updated: {updated_count}")
    if not_found_names:
        print(f"⚠️ Teachers not found in Auth Service: {', '.join(not_found_names)}")

if __name__ == "__main__":
    repair_instructor_ids()
