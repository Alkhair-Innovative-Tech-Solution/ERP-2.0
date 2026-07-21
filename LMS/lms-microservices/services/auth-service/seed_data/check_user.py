
import os
import django
import sys

# Setup Django environment
sys.path.append('/app/services/auth-service')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings')
django.setup()

from django.contrib.auth import get_user_model

def check_user():
    User = get_user_model()
    email = 'admin@ait.com'
    
    try:
        user = User.objects.get(email=email)
        print(f"User found: {user.email}")
        print(f"  - Check Password: {user.check_password('admin')}")
        print(f"  - Is Active: {user.is_active}")
        print(f"  - Is Staff: {user.is_staff}")
        print(f"  - Is Superuser: {user.is_superuser}")
        print(f"  - Role: {user.role}")
    except User.DoesNotExist:
        print(f"ERROR: User {email} DOES NOT EXIST.")

if __name__ == "__main__":
    check_user()
