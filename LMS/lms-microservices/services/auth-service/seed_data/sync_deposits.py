import os
import django
import sys
import json

# Setup Django Environment
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings')
django.setup()

from users.models import User, Student
from google_sheets_util import get_sheet_data

SPREADSHEET_ID = "17wAlHTw5jyvsEmNXlcnOCJvRZo978zIfH4magwSwkBU"
STUDENTS_RANGE = "Students!A:AQ"

HEADERS = {
    "id":         "ID",
    "name":       "Name",
    "dp":         "DP",
    "email":      "Email",
    "whatsapp":   "WhatsApp Number",
    "student_id": "New Student ID",
}

def safe_float(val):
    try:
        return float(str(val).replace(',', '').strip())
    except:
        return 0.0

def sync_deposits():
    print("\n💰 Syncing Deposits (DP) from Students tab...")
    rows = get_sheet_data(SPREADSHEET_ID, STUDENTS_RANGE)
    if not rows:
        print("   ⚠️  No data found.")
        return

    ok = skip = fail = 0
    deposit_log = []

    for row in rows:
        ait_id = row.get(HEADERS["id"], "").strip()
        name   = row.get(HEADERS["name"], "").strip()
        email  = row.get(HEADERS["email"], "").strip().lower()
        dp_val = safe_float(row.get(HEADERS["dp"], ""))

        if not name or not ait_id:
            continue

        if dp_val <= 0:
            skip += 1
            continue

        # Find corresponding Student
        student = None
        if email:
            user = User.objects.filter(email=email).first()
            if user:
                student = Student.objects.filter(user=user).first()

        if not student and ait_id:
            student = Student.objects.filter(student_id=ait_id).first()

        if not student:
            print(f"   ⚠️  Student not found for: {name} ({ait_id})")
            fail += 1
            continue

        # Log the deposit info
        deposit_log.append({
            "student_db_id": str(student.user.id),
            "student_ait_id": ait_id,
            "name": name,
            "email": email,
            "deposit_amount": dp_val,
        })
        ok += 1

    # Save to JSON for course-service or admin review
    with open('deposit_mapping.json', 'w') as f:
        json.dump(deposit_log, f, indent=4)

    print(f"\n   Summary → Logged: {ok} | Skipped (no DP): {skip} | Not Found: {fail}")
    print(f"   Deposit data saved to deposit_mapping.json")
    print(f"\n   ℹ️  To complete deposit creation, run inside course-service:")
    print(f"       docker exec course-service python ingest_deposits.py")

if __name__ == "__main__":
    sync_deposits()
