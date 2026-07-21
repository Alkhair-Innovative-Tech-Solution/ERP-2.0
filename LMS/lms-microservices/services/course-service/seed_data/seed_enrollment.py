import os
import django
import uuid

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
django.setup()

from courses.models import Course, CourseRegistrationHistory

def seed_user_enrollment(email, user_id):
    print(f"Checking enrollment for {email} ({user_id})...")
    course = Course.objects.first()
    if not course:
        print("No courses found to enroll in!")
        return

    # Check if already enrolled
    exists = CourseRegistrationHistory.objects.filter(
        student_id=user_id,
        course=course
    ).exists()

    if not exists:
        CourseRegistrationHistory.objects.create(
            student_id=user_id,
            course=course,
            status="enrolled"
        )
        print(f"✓ Successfully enrolled {email} in {course.name}")
    else:
        print(f"User {email} is already enrolled in {course.name}")

if __name__ == "__main__":
    # From my previous check, this is the ID for fr9614053@gmail.com
    target_user_id = "8c3a1d32-889f-493f-a791-e7b10e08d55a"
    seed_user_enrollment("fr9614053@gmail.com", target_user_id)
