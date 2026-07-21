import os
import django
import sys
from datetime import date

# Setup Django Environment
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
django.setup()

from courses.models import ScheduledClass

def sync_statuses():
    print(f"🕒 Synchronizing Scheduled Class statuses for date: {date.today()}...")
    
    classes = ScheduledClass.objects.all()
    count = classes.count()
    updated = 0
    
    for sc in classes:
        old_status = sc.status
        sc.save() # This triggers update_class_status() internally
        if old_status != sc.status:
            updated += 1
            print(f"  ✅ Updated: {sc.course.name} (Sec {sc.section}) -> {sc.status}")

    print(f"\n🎉 Finished Syncing!")
    print(f"   Total Classes Processed: {count}")
    print(f"   Statuses Changed:        {updated}")

if __name__ == "__main__":
    sync_statuses()
