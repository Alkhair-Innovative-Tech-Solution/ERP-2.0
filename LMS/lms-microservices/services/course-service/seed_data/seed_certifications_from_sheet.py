"""
Script: seed_certifications_from_sheet.py (course-service version)
Runs INSIDE the course-service container which has Google Sheets API credentials.

Reads the Final Exam Sheet, finds students with CERTIFICATED ISSUE == 'Issue',
then writes Certification records directly into the certification-service DB.
"""

import os
import django
import sys
import json
import uuid
import re
from datetime import datetime

# === Django Setup for COURSE-SERVICE (to get Sheets API) ===
sys.path.append('/app')
sys.path.append('/app/seed_data')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
django.setup()

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

def get_service_api():
    creds = None
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    return build("sheets", "v4", credentials=creds)

def list_all_tabs():
    service = get_service_api()
    spreadsheet = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
    return [s['properties']['title'] for s in spreadsheet.get('sheets', [])]

# === Now connect to CERTIFICATION DB directly ===
# The certification-service DB connection needs to be configured.
# We'll use psycopg2 directly to insert into it.
import psycopg2
import os

# Get cert DB settings from environment or hardcode
CERT_DB = {
    "host": os.getenv("CERT_DB_HOST", "postgres-certification"),
    "port": int(os.getenv("CERT_DB_PORT", "5432")),
    "dbname": os.getenv("CERT_DB_NAME", "certification_db"),
    "user": os.getenv("CERT_DB_USER", "lms_user"),
    "password": os.getenv("CERT_DB_PASSWORD", "lms_password"),
}

AUTH_DB = {
    "host": "postgres-auth",
    "port": 5432,
    "dbname": "auth_db",
    "user": "lms_user",
    "password": "lms_password",
}

SPREADSHEET_ID = "1xjKEMq5N5PoG30AkDFBAgctiR20cdH30Ma4dpBrpIAI"

def fetch_student_id_map():
    try:
        conn = psycopg2.connect(**AUTH_DB)
        cursor = conn.cursor()
        cursor.execute("SELECT username, id FROM users_user WHERE role='student'")
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return {username: user_id for username, user_id in rows}
    except Exception as e:
        print(f"ERROR: Could not connect to auth DB: {e}")
        return {}

def extract_course_code(student_id_val):
    """Extract course code from student ID like AIT25-DS11-0872 -> DS1"""
    parts = student_id_val.split('-')
    if len(parts) >= 2:
        code_sec = parts[1]
        match = re.match(r'^([A-Za-z]+\d*)([1-9]\d*)$', code_sec)
        if match:
            return match.group(1)
        return code_sec
    return ''

def make_cert_number():
    return f"AIT-CERT-{uuid.uuid4().hex[:8].upper()}"

def make_verification_code():
    return uuid.uuid4().hex[:16].upper()

def seed_certifications():
    print("Fetching all tab names from exam sheet...")
    tabs = list_all_tabs()
    print(f"Found {len(tabs)} tabs: {tabs}")

    # Connect to cert DB
    try:
        conn = psycopg2.connect(**CERT_DB)
        cursor = conn.cursor()
        print("Connected to certification DB successfully.")
    except Exception as e:
        print(f"ERROR: Could not connect to certification DB: {e}")
        print("Hint: Check CERT_DB_HOST, CERT_DB_NAME, CERT_DB_USER, CERT_DB_PASSWORD env variables.")
        return

    created = 0
    skipped = 0
    errors = 0
    issued_date = datetime.now().isoformat()

    print("Fetching auth user mapping...")
    student_map = fetch_student_id_map()
    print(f"Mapped {len(student_map)} students from auth-service.")

    service = get_service_api()

    for tab_name in tabs:
        print(f"\nProcessing tab: {tab_name}...")
        try:
            # Rows 1-2 are merged title rows; row 3 has actual headers, row 4+ has data
            result = service.spreadsheets().values().get(
                spreadsheetId=SPREADSHEET_ID,
                range=f"'{tab_name}'!A3:Z500"
            ).execute()
            values = result.get("values", [])
        except Exception as e:
            print(f"  Error fetching tab: {e}")
            continue

        if not values:
            print(f"  No data.")
            continue

        # Row 0 = headers (actual headers in row 3)
        headers = [h.strip().upper().replace('  ', ' ') for h in values[0]]
        
        certified_rows = []
        for row in values[1:]:
            if len(row) < len(headers):
                row += [''] * (len(headers) - len(row))
            nrow = dict(zip(headers, [c.strip() for c in row]))
            cert_issue = nrow.get('CERTIFICATED ISSUE', '').strip().upper()
            student_id_val = nrow.get('ID', '').strip()
            student_name = nrow.get('STUDENT NAME', '').strip()
            # Skip summary rows (no AIT ID pattern)
            if cert_issue == 'ISSUE' and student_id_val.startswith('AIT') and student_name:
                certified_rows.append(nrow)

        print(f"  Found {len(certified_rows)} students marked for certificate.")
        
        for row in certified_rows:
            student_id_val = row.get('ID', '').strip()
            student_name = row.get('STUDENT NAME', '').strip()
            paper_marks_raw = row.get('PAPER MARKS', '').strip()
            
            course_code = extract_course_code(student_id_val)
            
            try:
                grade = float(paper_marks_raw) if paper_marks_raw and paper_marks_raw not in ('-', '') else None
            except ValueError:
                grade = None
            
            cert_number = make_cert_number()
            verification_code = make_verification_code()
            
            # Find the actual numeric ID from Auth DB if available
            numeric_user_id = student_map.get(student_id_val)
            db_student_id = str(numeric_user_id) if numeric_user_id else student_id_val

            # Check for duplicate
            cursor.execute(
                "SELECT id FROM certifications_certification WHERE student_name=%s AND course_code=%s",
                (student_name, course_code)
            )
            if cursor.fetchone():
                skipped += 1
                continue
            
            try:
                cursor.execute("""
                    INSERT INTO certifications_certification
                    (id, student_id, course_id, certificate_number, verification_code,
                     student_name, course_title, course_code, grade, is_verified,
                     verified_at, institution_name, issued_date, updated_at, certificate_url, enrollment_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    str(uuid.uuid4()),
                    db_student_id,
                    str(uuid.UUID('00000000-0000-0000-0000-000000000000')),
                    cert_number,
                    verification_code,
                    student_name,
                    tab_name,
                    course_code,
                    grade,
                    True,
                    issued_date,
                    'AIT Institute',
                    issued_date,
                    issued_date,
                    '',
                    None
                ))
                conn.commit()
                print(f"  ✓ Cert issued: {student_name} ({student_id_val}) - Marks: {grade}")
                created += 1
            except Exception as e:
                conn.rollback()
                print(f"  ✗ Error inserting {student_id_val}: {e}")
                errors += 1

    cursor.close()
    conn.close()
    print(f"\nCertification seeding finished!")
    print(f"Certificates Created: {created}")
    print(f"Skipped (Duplicates):  {skipped}")
    print(f"Errors:                {errors}")

if __name__ == "__main__":
    seed_certifications()
