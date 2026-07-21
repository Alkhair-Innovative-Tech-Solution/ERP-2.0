#!/usr/bin/env python3
"""
AIT LMS - Google Sheets Data Import Script
============================================
Reads the updated Google Sheet and feeds data into the LMS system via APIs.

Sheet Structure:
  Tab 1: "Admissions Application"   --> Admission Service (Leads)
  Tab 2: "Specializations and TimeTable" --> Course Service (Scheduled Classes, Teachers)
  Tab 3: "Students"                 --> Auth (accounts) + Admission (enrollments) + Course (deposits)

Usage:
  python import_sheet_data.py [--dry-run] [--tab {all|admissions|timetable|students}]
"""

import requests
import json
import re
import sys
import argparse
from datetime import datetime, date
from google_sheets_util import get_sheet_data, list_sheets

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
SPREADSHEET_ID = "17wAlHTw5jyvsEmNXlcnOCJvRZo978zIfH4magwSwkBU"
GATEWAY = "http://api-gateway:8000"
AUTH_SVC = "http://auth-service:8001"  # direct, faster for login

# Exact API route prefixes (matched to api-gateway/main.py)
AUTH_API    = f"{GATEWAY}/api/auth"
COURSE_API  = f"{GATEWAY}/api/courses"
ADMIN_API   = f"{GATEWAY}/api/admission"

# Admin credentials
ADMIN_EMAIL = "faizan.ait@iak.ngo"
ADMIN_PASSWORD = "Ait@1234"

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
_token_cache = None

def get_admin_token():
    global _token_cache
    if _token_cache:
        return _token_cache
    print("🔐 Logging in as admin...")
    r = requests.post(f"{AUTH_SVC}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code == 200:
        data = r.json()
        _token_cache = data.get("token") or data.get("access")
        print(f"   ✅ Token obtained")
        return _token_cache
    else:
        print(f"   ❌ Login failed: {r.status_code} - {r.text}")
        sys.exit(1)

def headers():
    return {"Authorization": f"Bearer {get_admin_token()}", "Content-Type": "application/json"}

def safe_int(val, default=0):
    try:
        return int(str(val).replace(",", "").strip()) if val else default
    except:
        return default

def safe_float(val, default=0.0):
    try:
        return float(str(val).replace(",", "").strip()) if val else default
    except:
        return default

def parse_phone(val):
    """Normalize phone number to 03xxxxxxxxx format."""
    if not val:
        return ""
    val = re.sub(r"[^\d]", "", str(val))
    if val.startswith("92") and len(val) == 12:
        val = "0" + val[2:]
    return val

def generate_username(name, ait_id):
    """Generate a clean username from name and ID."""
    name_part = re.sub(r"[^a-z0-9]", "", name.lower().replace(" ", "."))[:15]
    id_part = re.sub(r"[^a-z0-9]", "", ait_id.lower())
    return f"{name_part}.{id_part}"

def parse_date(val):
    """Parse various date formats from the sheet."""
    if not val:
        return None
    for fmt in ["%m/%d/%Y %H:%M:%S", "%m/%d/%Y", "%d/%m/%Y", "%Y-%m-%d"]:
        try:
            return datetime.strptime(val.strip(), fmt).date().isoformat()
        except:
            pass
    return None

def post(url, data, dry_run=False):
    if dry_run:
        print(f"   [DRY-RUN] POST {url}")
        print(f"             {json.dumps(data, indent=6)[:300]}")
        return {"id": "dry-run-id"}
    r = requests.post(url, json=data, headers=headers())
    if r.status_code in (200, 201):
        return r.json()
    elif r.status_code == 400 and "already exists" in r.text.lower():
        print(f"   ⚠️  Already exists, skipping.")
        return None
    else:
        print(f"   ❌ POST {url} failed: {r.status_code} - {r.text[:300]}")
        return None


# ─────────────────────────────────────────────
# TAB 1: Admissions Application → Leads
# ─────────────────────────────────────────────
ADMISSION_HEADERS = {
    "timestamp":        "Timestamp",
    "app_no":           "Applications",
    "ait_id":           "# ID",
    "name":             "Name",
    "gender":           "Gender",
    "whatsapp":         "WhatsApp Number",
    "course":           "Select Course",
    "specialization":   "Select Specialization Course",
    "language":         "Choose Language Course",
    "address":          "Address",
    "education":        "Education",
    "cnic":             "CNIC / B-Form",
    "group":            "Group",
    "status":           "Status",
    "remarks":          "Remarks",
}

def import_admissions(dry_run=False):
    print("\n📋 TAB 1: Admissions Application → Leads")
    rows = get_sheet_data(SPREADSHEET_ID, "Admissions Application!A:O")
    if not rows:
        print("   ⚠️  No data found.")
        return

    ok = skip = fail = 0
    for row in rows:
        name = row.get(ADMISSION_HEADERS["name"], "").strip()
        if not name:
            continue

        phone = parse_phone(row.get(ADMISSION_HEADERS["whatsapp"], ""))
        course = row.get(ADMISSION_HEADERS["course"], "").strip()
        spec   = row.get(ADMISSION_HEADERS["specialization"], "").strip()
        status = row.get(ADMISSION_HEADERS["status"], "Pending").strip()

        lead_data = {
            "name":             name,
            "phone":            phone,
            "email":            f"{generate_username(name, row.get(ADMISSION_HEADERS['ait_id'], 'na'))}@ait.edu",
            "course_interest":  spec or course,
            "address":          row.get(ADMISSION_HEADERS["address"], ""),
            "education":        row.get(ADMISSION_HEADERS["education"], ""),
            "cnic":             row.get(ADMISSION_HEADERS["cnic"], ""),
            "gender":           row.get(ADMISSION_HEADERS["gender"], ""),
            "remarks":          row.get(ADMISSION_HEADERS["remarks"], ""),
            "status":           status.lower() if status else "pending",
            "source":           "google_sheet",
        }

        result = post(f"{ADMIN_API}/leads/", lead_data, dry_run)
        if result:
            print(f"   ✅ Lead created: {name}")
            ok += 1
        else:
            skip += 1

    print(f"\n   Summary → Created: {ok} | Skipped: {skip} | Failed: {fail}")


# ─────────────────────────────────────────────
# TAB 2: Specializations and TimeTable → Scheduled Classes
# ─────────────────────────────────────────────
TIMETABLE_HEADERS = {
    "specialization":   "Specialization",
    "course":           "Course",
    "code":             "Code",
    "section":          "Section",
    "duration":         "Duration",
    "days":             "Days",
    "time":             "Time",
    "strength":         "Strength Status",
    "students":         "Students",
    "lab_class":        "Lab | Class",
    "teacher":          "Teacher",
    "ass_teacher":      "Ass. Teacher",
    "attendance":       "Attendance Sheet",
    "content_share":    "Content share",
    "wa_group":         "WA Group Created",
    "status":           "Course Status",
}

def parse_time_slot(time_str):
    """Convert '5 pm - 6:45 pm' to start_time / end_time."""
    if not time_str:
        return None, None
    parts = [p.strip() for p in time_str.split("-")]
    def to_24h(t):
        for fmt in ["%I:%M %p", "%I %p", "%I:%M%p", "%I%p"]:
            try:
                return datetime.strptime(t.upper(), fmt).strftime("%H:%M")
            except:
                pass
        return None
    start = to_24h(parts[0]) if len(parts) > 0 else None
    end   = to_24h(parts[1]) if len(parts) > 1 else None
    return start, end

def parse_days(days_str):
    """Convert 'Mon, Wed, Fri' style string to list."""
    if not days_str:
        return []
    return [d.strip() for d in re.split(r"[,/&\n]", days_str) if d.strip()]

def import_timetable(dry_run=False):
    print("\n📅 TAB 2: Specializations & TimeTable → Scheduled Classes")
    rows = get_sheet_data(SPREADSHEET_ID, "Specializations and TimeTable!A:P")
    if not rows:
        print("   ⚠️  No data found.")
        return

    ok = skip = 0
    for row in rows:
        spec     = row.get(TIMETABLE_HEADERS["specialization"], "").strip()
        course   = row.get(TIMETABLE_HEADERS["course"], "").strip()
        code     = row.get(TIMETABLE_HEADERS["code"], "").strip()
        section  = row.get(TIMETABLE_HEADERS["section"], "").strip()
        teacher  = row.get(TIMETABLE_HEADERS["teacher"], "").strip()
        days_str = row.get(TIMETABLE_HEADERS["days"], "").strip()
        time_str = row.get(TIMETABLE_HEADERS["time"], "").strip()
        status   = row.get(TIMETABLE_HEADERS["status"], "").strip()

        if not code and not course:
            continue

        start_time, end_time = parse_time_slot(time_str)
        days = parse_days(days_str)

        class_data = {
            "specialization_name": spec,
            "course_name":         f"{spec} ({course})" if course else spec,
            "section_code":        f"{code}-{section}" if section else code,
            "teacher_name":        teacher,
            "assistant_teacher":   row.get(TIMETABLE_HEADERS["ass_teacher"], "").strip(),
            "days":                days,
            "start_time":          start_time,
            "end_time":            end_time,
            "room_type":           row.get(TIMETABLE_HEADERS["lab_class"], "Class").strip(),
            "max_students":        safe_int(row.get(TIMETABLE_HEADERS["students"], ""), 30),
            "status":              "active" if status.lower() == "running" else "pending",
            "source":              "google_sheet",
        }

        result = post(f"{COURSE_API}/scheduled-classes/from-sheet/", class_data, dry_run)
        if result:
            print(f"   ✅ Class: {code}-{section} | {teacher} | {time_str}")
            ok += 1
        else:
            skip += 1

    print(f"\n   Summary → Created: {ok} | Skipped: {skip}")


# ─────────────────────────────────────────────
# TAB 3: Students → Accounts + Enrollments + Deposits
# ─────────────────────────────────────────────
STUDENTS_HEADERS = {
    "test":             "Test",
    "dp":               "DP",
    "batch":            "Batch",
    "beg_batch":        "New Beginner Batch",
    "adv_batch":        "New Advance Batch",
    "dep_returned":     "Deposit returned",
    "bag_purchased":    "Bag Purchased",
    "new_student_id":   "New Student ID",
    "student_id_alt":   "Student ID",
    "new_course":       "New Course Name",
    "id":               "ID",
    "name":             "Name",
    "gender":           "Gender",
    "whatsapp":         "WhatsApp Number",
    "course_type":      "Select Course Type",
    "specialization":   "Select Specialization Course",
    "language":         "Choose Language Course",
    "father_name":      "Father/Guardian Name",
    "email":            "Email",
    "address":          "Full Address",
    "cnic":             "CNIC/B-Form Number",
    "dob":              "Date of Birth",
    "age":              "Age (years)",
    "guardian_name":    "Guardian Name",
    "guardian_contact": "Contact Number",
    "relationship":     "Relationship to Student",
    "qualification":    "Last Qualification",
    "study_work":       "Are you currently studying or working?",
    "work_details":     "for studying or working, write details",
    "terms":            "Do you agree to the Terms & Conditions?",
    "signature":        "Signature (Type your full name as signature)",
    "studied_idara":    "Have you studied at Idara Al-Khair?",
    "studying_idara":   "Are you studying at Idara Al-Khair?",
}

def import_students(dry_run=False):
    print("\n👥 TAB 3: Students → Accounts + Enrollments + Deposits")
    rows = get_sheet_data(SPREADSHEET_ID, "Students!A:AQ")
    if not rows:
        print("   ⚠️  No data found.")
        return

    ok = skip = fail = 0
    for row in rows:
        ait_id = row.get(STUDENTS_HEADERS["id"], "").strip()
        name   = row.get(STUDENTS_HEADERS["name"], "").strip()

        if not name or not ait_id:
            continue

        email  = row.get(STUDENTS_HEADERS["email"], "").strip()
        username = generate_username(name, ait_id)
        if not email:
            email = f"{username}@ait.edu"

        # ── 1. Create Student Account with Full Profile
        account_data = {
            "full_name":        name,
            "email":            email,
            "password":         "Ait@12345",
            "role":             "student",
            "student_id":       ait_id,
            "phone":            parse_phone(row.get(STUDENTS_HEADERS["whatsapp"], "")),
            "cnic":             row.get(STUDENTS_HEADERS["cnic"], ""),
            "gender":           row.get(STUDENTS_HEADERS["gender"], "").lower(),
            "father_name":      row.get(STUDENTS_HEADERS["father_name"], ""),
            "address":          row.get(STUDENTS_HEADERS["address"], ""),
            "whatsapp_number":  parse_phone(row.get(STUDENTS_HEADERS["whatsapp"], "")),
            "level":            "Level 1",
            "batch":            row.get(STUDENTS_HEADERS["batch"], ""),
            "specialization":   row.get(STUDENTS_HEADERS["specialization"], ""),
            "last_qualification": row.get(STUDENTS_HEADERS["qualification"], ""),
            "study_work_status": row.get(STUDENTS_HEADERS["study_work"], ""),
            "work_details":     row.get(STUDENTS_HEADERS["work_details"], ""),
            "signature":        row.get(STUDENTS_HEADERS["signature"], ""),
            "studied_at_idara": row.get(STUDENTS_HEADERS["studied_idara"], "").lower() == "yes",
            "studying_at_idara": row.get(STUDENTS_HEADERS["studying_idara"], "").lower() == "yes",
            "guardian_name":    row.get(STUDENTS_HEADERS["guardian_name"], ""),
            "guardian_contact": parse_phone(row.get(STUDENTS_HEADERS["guardian_contact"], "")),
            "relationship":     row.get(STUDENTS_HEADERS["relationship"], ""),
            "dob":              row.get(STUDENTS_HEADERS["dob"], ""),
        }
        
        account_result = post(f"{AUTH_API}/register/", account_data, dry_run)
        if not account_result:
            print(f"   ⚠️  Account skip/fail for {name} ({ait_id})")
            skip += 1
            continue

        user_id = account_result.get("id") or account_result.get("user", {}).get("id")
        print(f"   ✅ Account created: {name} | {ait_id}")

        # ── 2. Create Deposit Record using DP
        deposit_val = safe_float(row.get(STUDENTS_HEADERS["dp"], ""))
        if deposit_val > 0 and user_id:
            deposit_data = {
                "student_id":       str(user_id),
                "total_fee":        0, # Unknown from sheet, just tracking deposit
                "amount_paid":      deposit_val,
                "source":           "google_sheet",
                "status":           "active"
            }
            post(f"{COURSE_API}/deposits/from-sheet/", deposit_data, dry_run)
            print(f"   ✅ Deposit logged: {deposit_val} for {name}")

        ok += 1

    print(f"\n   Summary → Processed: {ok} | Skipped: {skip} | Failed: {fail}")

    print(f"\n   Summary → Processed: {ok} | Skipped: {skip} | Failed: {fail}")


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import Google Sheet data into AIT LMS")
    parser.add_argument("--dry-run", action="store_true", help="Preview without making API calls")
    parser.add_argument("--tab", choices=["all", "admissions", "timetable", "students"], default="all",
                        help="Which tab to import (default: all)")
    args = parser.parse_args()

    if args.dry_run:
        print("🔍 DRY-RUN MODE — No data will be created\n")

    # First, verify the sheet is accessible
    print("📊 Connecting to Google Sheet...")
    tabs = list_sheets(SPREADSHEET_ID)
    print(f"   Found tabs: {tabs}\n")

    if args.tab in ("all", "admissions"):
        import_admissions(args.dry_run)

    if args.tab in ("all", "timetable"):
        import_timetable(args.dry_run)

    if args.tab in ("all", "students"):
        import_students(args.dry_run)

    print("\n✅ Import complete!")
