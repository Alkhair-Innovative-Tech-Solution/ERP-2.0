
import os
import django
import sys

# Setup Django environment
sys.path.append('/app/services/auth-service')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings')
django.setup()

from django.contrib.auth import get_user_model

def force_reset():
    User = get_user_model()
    email = 'admin@ait.com'
    password = 'admin'
    
    try:
        if User.objects.filter(email=email).exists():
            user = User.objects.get(email=email)
            print(f"Updating existing user: {email}")
            user.set_password(password)
            user.save()
        else:
            print(f"Creating new user: {email}")
            user = User.objects.create_superuser(
                email=email,
                password=password,
                full_name='Admin User',
                cnic='00000-0000000-0',
                phone='0300-0000000'
            )
        
        # Verify
        user.refresh_from_db()
        is_correct = user.check_password(password)
        print(f"VERIFICATION: Password check for '{password}' -> {is_correct}")
        print(f"User Details: Active={user.is_active}, Staff={user.is_staff}, Super={user.is_superuser}")
        
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    force_reset()
