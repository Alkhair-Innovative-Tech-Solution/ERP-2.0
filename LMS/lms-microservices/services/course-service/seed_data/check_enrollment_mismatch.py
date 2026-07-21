import sys, json, os
sys.path.append('/app')
sys.path.append('/app/seed_data')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
import django
django.setup()
from courses.models import CourseRegistrationHistory
import requests

all_ids = list(CourseRegistrationHistory.objects.values_list('student_id', flat=True))
unique_ids = list(set(str(uid) for uid in all_ids))
print(f'Total enrollments: {len(all_ids)}')
print(f'Unique student_ids: {len(unique_ids)}')

resp = requests.post(
    'http://auth-service:8001/api/auth/users/bulk/',
    json={'ids': unique_ids},
    timeout=15
)
if resp.status_code == 200:
    found = resp.json()
    found_ids = {u['id'] for u in found}
    missing = [sid for sid in unique_ids if sid not in found_ids]
    print(f'Users found in auth: {len(found_ids)}')
    print(f'Missing student_ids: {len(missing)}')
    if missing:
        print('Sample missing:', missing[:10])
        # Check which enrollments have missing IDs
        bad = CourseRegistrationHistory.objects.filter(student_id__in=missing[:10])
        for b in bad:
            print(f'  Bad enrollment: id={b.id}, student_id={b.student_id}, course={b.course.name if b.course else "N/A"}')
else:
    print(f'API error: {resp.status_code} {resp.text[:500]}')
