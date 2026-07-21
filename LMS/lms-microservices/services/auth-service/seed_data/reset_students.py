import os
import django
import sys

# Setup Django Environment
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings')
django.setup()

from users.models import User, Student

def delete_students():
    print(f"Deleting {Student.objects.count()} student profiles...")
    Student.objects.all().delete()
    
    users = User.objects.filter(role='student')
    print(f"Deleting {users.count()} user accounts...")
    users.delete()
    
    print("Done!")

if __name__ == "__main__":
    delete_students()
