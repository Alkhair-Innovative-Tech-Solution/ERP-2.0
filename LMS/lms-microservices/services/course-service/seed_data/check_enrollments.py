import sys, json, os
sys.path.append('/app')
sys.path.append('/app/seed_data')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
import django
django.setup()
from courses.models import CourseRegistrationHistory

# Load JSON
with open('/app/seed_data/master_enrollment_mapping.json') as f:
    data = json.load(f)
print('JSON records:', len(data))
total_enroll = sum(len(r.get('enrollments', [])) for r in data)
print('Total enrollment entries in JSON:', total_enroll)

# Check first few enrollment records from DB
first = CourseRegistrationHistory.objects.order_by('registration_date').first()
if first:
    print('\nFirst DB enrollment (oldest):')
    print('  student_id:', first.student_id)
    print('  course:', first.course.name if first.course else None)
    print('  status:', first.status)
    print('  roll_number:', first.roll_number)

# Count by status
from django.db.models import Count
status_counts = CourseRegistrationHistory.objects.values('status').annotate(count=Count('id'))
print('\nEnrollments by status:')
for s in status_counts:
    print(f'  {s["status"]}: {s["count"]}')
