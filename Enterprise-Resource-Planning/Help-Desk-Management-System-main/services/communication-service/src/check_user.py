import os
import django
from django.conf import settings

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth.models import User

try:
    count = User.objects.count()
    print(f"Found {count} users in auth_user table.")
    if count > 0:
        u = User.objects.first()
        print(f"User: {u.username}")
except Exception as e:
    print(f"Error: {e}")
