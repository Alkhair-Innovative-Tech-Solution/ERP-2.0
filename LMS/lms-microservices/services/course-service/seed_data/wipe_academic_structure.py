import os
import django
import sys

# Setup Django Environment
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
django.setup()

from courses.models import CourseRegistrationHistory, ScheduledClass, Course, Specialization

def reset_courses():
    print("Deleting CourseRegistrationHistory...")
    CourseRegistrationHistory.objects.all().delete()
    print("Deleting ScheduledClass...")
    ScheduledClass.objects.all().delete()
    print("Deleting Course...")
    Course.objects.all().delete()
    print("Deleting Specialization...")
    Specialization.objects.all().delete()
    print("Done!")

if __name__ == "__main__":
    reset_courses()
