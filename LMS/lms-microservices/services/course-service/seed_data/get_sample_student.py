import os
import django
import sys

# Setup Django Environment
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
django.setup()

from courses.models import CourseRegistrationHistory

def get_sample_student():
    crh = CourseRegistrationHistory.objects.filter(status='enrolled').first()
    if crh:
        print(f"Student ID: {crh.student_id}")
        print(f"Course: {crh.course.name}")
        print(f"Section: {crh.scheduled_class.section}")
    else:
        print("No enrolled students found.")

if __name__ == "__main__":
    get_sample_student()
