import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings')
django.setup()

from users.models import User, Student
from users.serializers import user_to_schema

def check_student_data():
    email = "raorazafaizan@gmail.com"
    print(f"🔍 Checking data for email: {email}")
    
    try:
        user = User.objects.get(email=email)
        print(f"👤 Found User: {user.full_name} (Role: {user.role})")
        
        student = Student.objects.filter(user=user).first()
        if student:
            print(f"🎓 Found Student Record! Status: {student.status}")
            print(f"🆔 Student ID in DB: '{student.student_id}'")
        else:
            print("❌ No Student record found for this user!")
            return

        # Check what the serializer returns
        schema_data = user_to_schema(user)
        print(f"📦 Serialized student_id: '{schema_data.student_id}'")
        
        if schema_data.student_id:
            print("✅ Backend is CORRECTLY sending the ID.")
        else:
            print("⚠️ Backend is sending EMPTY student_id.")

    except User.DoesNotExist:
        print("❌ User not found.")

if __name__ == "__main__":
    check_student_data()
