"""
reset_teacher_passwords.py
─────────────────────────────────────────────
Resets all teacher passwords to a known default.
Run: docker exec auth-service python seed_data/reset_teacher_passwords.py
"""
import os, sys, django
sys.path.extend(['/app', '/app/seed_data'])
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings')
django.setup()

from users.models import User

password = os.getenv('TEACHER_DEFAULT_PASSWORD', 'ait_teacher_123')
count = 0
for user in User.objects.filter(role='teacher'):
    user.set_password(password)
    user.save(update_fields=['password'])
    count += 1

print(f"Reset passwords for {count} teachers to '{password}'")
