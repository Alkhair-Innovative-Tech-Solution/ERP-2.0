"""
Script to create a Django superadmin for ticket-service.
Uses the shared User model from user-service.
"""
import os
import sys
import django
from pathlib import Path

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

# Add user-service apps to path
BASE_DIR = Path(__file__).resolve().parent
user_service_apps_path = BASE_DIR.parent.parent / 'user-service' / 'src' / 'apps'
if user_service_apps_path.exists() and str(user_service_apps_path) not in sys.path:
    sys.path.insert(0, str(user_service_apps_path))

django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

try:
    # Check if a superadmin already exists
    existing_superadmins = User.objects.filter(is_superuser=True)
    if existing_superadmins.exists():
        print(f"Superadmin(s) already exist:")
        for su in existing_superadmins:
            print(f"  - {su.employee_code}: {su.get_full_name() or su.email}")
    else:
        # Create superadmin using environment variables
        first_name = os.getenv('SUPERADMIN_FIRST_NAME', 'Admin')
        last_name = os.getenv('SUPERADMIN_LAST_NAME', 'User')
        email = os.getenv('SUPERADMIN_EMAIL', 'admin@hdms.com')
        password = os.getenv('SUPERADMIN_PASSWORD', 'admin123')
        cnic = os.getenv('SUPERADMIN_CNIC')
        phone_number = os.getenv('SUPERADMIN_PHONE')
        
        print("Creating superadmin...")
        user = User.objects.create_superuser(
            employee_code=None,  # Will be auto-generated
            password=password,
            email=email,
            first_name=first_name,
            last_name=last_name,
            cnic=cnic,
            phone_number=phone_number,
        )
        
        print(f"✓ Superadmin created successfully!")
        print(f"  Employee Code: {user.employee_code}")
        print(f"  Name: {user.get_full_name()}")
        print(f"  Email: {user.email}")

except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()
