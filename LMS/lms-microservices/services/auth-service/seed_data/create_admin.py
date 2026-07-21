
import os
import django
import sys

# Setup Django environment
sys.path.append('/app/services/auth-service')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings')
django.setup()

from django.contrib.auth import get_user_model

def create_admin():
    User = get_user_model()
    email = 'admin@ait.com'
    password = 'admin'
    full_name = 'Admin User'
    cnic = '00000-0000000-0'
    phone = '0300-0000000'

    if User.objects.filter(email=email).exists():
        print(f"User {email} already exists. Updating password.")
        user = User.objects.get(email=email)
        user.set_password(password)
        user.is_superuser = True
        user.is_staff = True
        user.is_admin = True
        user.full_name = full_name
        user.cnic = cnic
        user.phone = phone
        user.role = 'admin'
        user.save()
        print("User updated successfully.")
    else:
        print(f"Creating user {email}...")
        User.objects.create_superuser(
            email=email,
            password=password,
            full_name=full_name,
            cnic=cnic,
            phone=phone
        )
        print("Superuser created successfully.")

if __name__ == "__main__":
    create_admin()
