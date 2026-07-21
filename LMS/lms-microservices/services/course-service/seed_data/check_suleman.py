import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
django.setup()

from courses.models import ScheduledClass, CourseRegistrationHistory

suleman_name_match = "2a1972e8-860c-414a-ad59-7fa6cc99f145"

scs = ScheduledClass.objects.filter(instructor_id=suleman_name_match)
print(f"Suleman ScheduledClasses: {scs.count()}")
for sc in scs:
    print(f" - {sc.course.course_code}: ID={sc.id}, active={sc.active}")

enrollments = CourseRegistrationHistory.objects.filter(course_id__in=scs.values_list('course_id', flat=True))
print(f"Enrollments for these courses: {enrollments.count()}")
