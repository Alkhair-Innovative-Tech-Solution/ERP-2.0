import os
import django
import sys

# Setup Django Environment
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
django.setup()

from courses.models import CourseRegistrationHistory, ScheduledClass

def reset_courses():
    qs = CourseRegistrationHistory.objects.all()
    print(f"Deleting {qs.count()} enrollment records...")
    qs.delete()
    print("Resetting total_students in ScheduledClass...")
    ScheduledClass.objects.all().update(total_students=0)
    print("Done!")

if __name__ == "__main__":
    reset_courses()
