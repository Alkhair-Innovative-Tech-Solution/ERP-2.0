
import os
import django
import sys

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings')
django.setup()

from users.models import User, Teacher

def create_or_update_teacher(name, email, password, cnic, phone):
    try:
        user = User.objects.filter(email=email).first()
        
        if user:
            print(f"⚠️ User with email {email} already exists.")
            print(f"🔄 Updating password...")
            user.set_password(password)
            user.save()
            print(f"✅ Password updated successfully.")
            
            # Check if teacher profile exists
            if not hasattr(user, 'teacher'):
                print(f"⚠️ User exists but is not a teacher. Creating Teacher profile...")
                Teacher.objects.create(
                    user=user,
                    specialization="General",
                    qualification="PhD",
                    experience=5,
                    availability={}
                )
                user.role = "teacher"
                user.save()
                print(f"✅ Teacher profile created.")
            
        else:
            print(f"🆕 Creating NEW Teacher...")
            user = User.objects.create_user(
                full_name=name,
                email=email,
                password=password,
                cnic=cnic,
                phone=phone,
                role="teacher"
            )
            
            Teacher.objects.create(
                user=user,
                specialization="General",
                qualification="PhD",
                experience=5,
                availability={}
            )
            print(f"✅ Teacher {name} created successfully.")
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    # YOU CAN CHANGE THESE DETAILS
    TEACHER_NAME = "Sir Ali"
    TEACHER_EMAIL = "ali@ait.com"
    TEACHER_PASS = "teacher123" 
    TEACHER_CNIC = "3310012345678"
    TEACHER_PHONE = "03001234567"

    create_or_update_teacher(TEACHER_NAME, TEACHER_EMAIL, TEACHER_PASS, TEACHER_CNIC, TEACHER_PHONE)
