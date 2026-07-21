import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings')
django.setup()

from users.models import User
teachers = User.objects.filter(role='teacher').values('full_name', 'email')[:3]
for t in teachers:
    print(f"Teacher: {t['full_name']} | Email: {t['email']}")
