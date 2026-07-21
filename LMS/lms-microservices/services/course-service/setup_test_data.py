import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE','course_service.settings')
django.setup()
from datetime import date
from courses.models import FeeStructure, Course, CourseRegistrationHistory

c = Course.objects.get(id='7668d57a-7463-488a-b66b-464da216ff4a')
fs, created = FeeStructure.objects.get_or_create(
    course=c,
    defaults={
        'monthly_maintenance_fee': 5000,
        'one_time_fee': 20000,
        'payment_plan': 'monthly',
        'due_day_of_month': 10,
        'is_active': True,
        'require_deposit_paid': False,
        'effective_from': date(2026, 1, 1),
    }
)
print('Course:', c.name)
print('Fee structure created:', created)
count = CourseRegistrationHistory.objects.filter(course=c, status='enrolled').count()
print('Enrollments:', count)
