import os, django, sys

def clean_course_service():
    print("Clearing course-service data...")
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
    sys.path.append('/app')
    django.setup()
    
    from courses.models import Course, Batch, ScheduledClass, CourseRegistrationHistory
    
    # Order matters due to foreign keys
    deleted_registrations = CourseRegistrationHistory.objects.all().delete()[0]
    deleted_schedules = ScheduledClass.objects.all().delete()[0]
    deleted_batches = Batch.objects.all().delete()[0]
    deleted_courses = Course.objects.all().delete()[0]
    
    print(f"Deleted: {deleted_registrations} Enrollments, {deleted_schedules} Schedules, {deleted_batches} Batches, {deleted_courses} Courses.")

def clean_auth_service():
    print("Clearing auth-service student data...")
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings')
    sys.path.append('/app')
    django.setup()
    
    from users.models import User, Student
    
    # We only delete students to avoid deleting admin/teacher accounts
    deleted_students = Student.objects.all().delete()[0]
    # Delete users with role 'student'
    deleted_users = User.objects.filter(role='student').delete()[0]
    
    print(f"Deleted: {deleted_students} Student records, {deleted_users} Student User accounts.")

if __name__ == '__main__':
    service = sys.argv[1] if len(sys.argv) > 1 else None
    if service == 'course':
        clean_course_service()
    elif service == 'auth':
        clean_auth_service()
    else:
        print("Specify 'course' or 'auth'")
