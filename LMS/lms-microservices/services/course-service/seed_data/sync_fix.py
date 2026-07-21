import os
import django
import sys
import requests
import uuid

# Setup Django Environment
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
django.setup()

from courses.models import Course, ScheduledClass, CourseRegistrationHistory

def fix_student(email):
    print(f"🔍 Searching for student with email: {email}")
    AUTH_URL = os.environ.get("AUTH_SERVICE_URL", "http://auth-service:8001")
    
    try:
        # 1. Get User ID and Course ID from Auth Service
        # We'll use the check-receipt-status endpoint as it requires no auth
        resp = requests.get(f"{AUTH_URL}/api/auth/students/receipt-status/", params={"email": email}, timeout=5)
        if resp.status_code != 200:
            print(f"❌ Could not find receipt status for {email}. Status: {resp.status_code}")
            return

        data = resp.json()
        if not data.get('receipt_verified'):
            print(f"❌ Receipt for {email} is not verified yet. Verification is required before enrollment.")
            return

        # 2. We need the lms_user_id and course_id.
        # Since receipt-status doesn't return user_id, let's look up the receipt list (internal)
        # or assuming we have to list all and find. 
        # For a more direct way, we can assume the user exists in 'auth-service' User table.
        
        # Let's hit the admin endpoint to get the full receipt details
        # (Internal dev hack: assuming internal communication is open)
        resp_list = requests.get(f"{AUTH_URL}/api/auth/admin/receipt-codes/", timeout=5)
        receipts = resp_list.json()
        
        target_receipt = next((r for r in receipts if r['student_email'].lower() == email.lower()), None)
        
        if not target_receipt:
            print(f"❌ Could not find receipt record for {email}")
            return

        course_id = target_receipt.get('course_id')
        # We need the user_id. The list doesn't have it? 
        # Wait, I'll check router.py again... 
        # Line 551+: in list_receipt_codes it DOES NOT return lms_user_id. 
        # BUT! We can just use the provided student_email to find them in the auth-db via endpoint?
        
        # Let's assume student_id (user_id) is what we need.
        # I'll add a temporary endpoint or just use the EMAIL to find them.
        
        # 3. Create/Fix Enrollment locally
        print(f"✅ Found receipt. Course ID: {course_id}")
        
        if not course_id:
            print("❌ No course_id associated with this receipt.")
            return

        # Find course
        course = Course.objects.filter(id=course_id).first()
        if not course:
            print(f"❌ Course {course_id} not found in Course Service!")
            return

        # Find user ID (We'll try to find it from auth-service user info endpoint)
        # If I can't get it easily, I'll ask the system to fetch by email.
        # Actually, let's trust RabbitMQ events once we start the listener.
        
        print("💡 Suggestion: Start the listener and then I'll force-publish the event.")

    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        email = sys.argv[1]
        fix_student(email)
    else:
        print("Usage: python sync_fix.py <email>")
