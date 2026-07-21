import sys, json, os
sys.path.append('/app')
sys.path.append('/app/seed_data')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
import django
django.setup()
import requests
from courses.models import CourseRegistrationHistory

with open('/app/seed_data/master_enrollment_mapping.json') as f:
    data = json.load(f)

first_json_id = data[0]['student_user_id']
print('JSON student_user_id:', first_json_id)

first_db = CourseRegistrationHistory.objects.order_by('registration_date').first()
print('DB student_id:', first_db.student_id)
print('Match:', str(first_db.student_id) == first_json_id)
print('Course:', first_db.course.name if first_db.course else None)

resp = requests.post(
    'http://auth-service:8001/api/auth/users/bulk/',
    json={'ids': [first_json_id]},
    timeout=10
)
print('Auth lookup for JSON id:', resp.json())

resp2 = requests.post(
    'http://auth-service:8001/api/auth/users/bulk/',
    json={'ids': [str(first_db.student_id)]},
    timeout=10
)
print('Auth lookup for DB id:', resp2.json())

# Count how many from JSON actually exist in enrollments
json_ids = set(r['student_user_id'] for r in data)
db_ids = set(str(r) for r in CourseRegistrationHistory.objects.values_list('student_id', flat=True))
overlap = json_ids & db_ids
only_json = json_ids - db_ids
only_db = db_ids - json_ids
print(f'\nJSON unique IDs: {len(json_ids)}')
print(f'DB unique IDs: {len(db_ids)}')
print(f'Overlap: {len(overlap)}')
print(f'Only in JSON (not in DB): {len(only_json)}')
print(f'Only in DB (not from JSON): {len(only_db)}')
