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
AUTH_SVC = "http://localhost:8001"  # direct, faster for login

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
    "date":             "Date",
    "id":               "Id",
    "name":             "Name",
    "gender":           "Gender",
    "whatsapp":         "WhatsApp",
    "course":           "Course",
    "specialization":   "Specialization",
    "type":             "Type",
    "total_fee":        "Total Fee",
    "discount":         "Discount",
    "discounted_fee":   "Discounted Fee",
    "reg_fee":          "Reg Fee",
    "inst1":            "Installment 1",
    "inst2":            "Installment 2",
    "inst3":            "Installment 3",
    "inst4":            "Installment 4",
    "inst5":            "Installment 5",
    "inst6":            "Installment 6",
    "deposit":          "Deposit",
    "remaining":        "Remaining",
    "group_id":         "Group Id",
    "status":           "Status",
    "remarks":          "Remarks",
}

def import_students(dry_run=False):
    print("\n👥 TAB 3: Students → Accounts + Enrollments + Deposits")
    rows = get_sheet_data(SPREADSHEET_ID, "Students!A:W")
    if not rows:
        print("   ⚠️  No data found.")
        return

    ok = skip = fail = 0
    for row in rows:
        ait_id = row.get(STUDENTS_HEADERS["id"], "").strip()
        name   = row.get(STUDENTS_HEADERS["name"], "").strip()

        if not name or not ait_id:
            continue

        phone  = parse_phone(row.get(STUDENTS_HEADERS["whatsapp"], ""))
        gender = row.get(STUDENTS_HEADERS["gender"], "").strip()
        spec   = row.get(STUDENTS_HEADERS["specialization"], "").strip()
        course = row.get(STUDENTS_HEADERS["course"], "").strip()
        group  = row.get(STUDENTS_HEADERS["group_id"], "").strip()
        status = row.get(STUDENTS_HEADERS["status"], "active").strip().lower()
        date_str = parse_date(row.get(STUDENTS_HEADERS["date"], ""))

        # ── Compute section_code from group_id (e.g. GC2-1)
        section_code = group  # already in code format from sheet

        # ── 1. Create Student Account
        username = generate_username(name, ait_id)
        account_data = {
            "username":     username,
            "email":        f"{username}@ait.edu",
            "password":     "Ait@12345",   # default password, student should change
            "first_name":   name.split()[0] if name else "",
            "last_name":    " ".join(name.split()[1:]) if len(name.split()) > 1 else "",
            "role":         "STUDENT",
            "student_id":   ait_id,
            "id_no":        ait_id,
            "phone":        phone,
            "gender":       gender.lower() if gender else "",
            "section_code": section_code,
            "specialization": spec or course,
            "source":       "google_sheet",
        }
        account_result = post(f"{AUTH_API}/register/", account_data, dry_run)
        if not account_result:
            print(f"   ⚠️  Account skip/fail for {name} ({ait_id})")
            skip += 1
            continue

        user_id = account_result.get("id") or account_result.get("user", {}).get("id")
        print(f"   ✅ Account: {name} | {ait_id} | {section_code}")

        # ── 2. Create Enrollment
        if section_code and user_id:
            enrollment_data = {
                "student_id":    str(user_id),
                "section_code":  section_code,
                "status":        "active" if status not in ("dropped", "cancelled") else status,
                "enrolled_date": date_str or date.today().isoformat(),
                "source":        "google_sheet",
            }
            enroll_result = post(f"{COURSE_API}/enrollments/from-sheet/", enrollment_data, dry_run)
            if enroll_result:
                print(f"   ✅ Enrollment: {name} → {section_code}")

        # ── 3. Create Deposit records
        total_fee     = safe_float(row.get(STUDENTS_HEADERS["total_fee"], ""))
        discount      = safe_float(row.get(STUDENTS_HEADERS["discount"], ""))
        discounted    = safe_float(row.get(STUDENTS_HEADERS["discounted_fee"], ""))
        reg_fee       = safe_float(row.get(STUDENTS_HEADERS["reg_fee"], ""))
        deposit_paid  = safe_float(row.get(STUDENTS_HEADERS["deposit"], ""))
        remaining     = safe_float(row.get(STUDENTS_HEADERS["remaining"], ""))
        fee_type      = row.get(STUDENTS_HEADERS["type"], "installment").strip().lower()

        # Installments
        installments = []
        for i in range(1, 7):
            key = f"inst{i}"
            val = safe_float(row.get(STUDENTS_HEADERS[key], ""))
            if val > 0:
                installments.append(val)

        if total_fee > 0 and user_id:
            deposit_data = {
                "student_id":       str(user_id),
                "total_fee":        total_fee,
                "discount":         discount,
                "discounted_fee":   discounted or (total_fee - discount),
                "registration_fee": reg_fee,
                "amount_paid":      deposit_paid,
                "remaining_amount": remaining,
                "payment_type":     fee_type,
                "installments":     installments,
                "status":           status,
                "source":           "google_sheet",
            }
            deposit_result = post(f"{COURSE_API}/deposits/from-sheet/", deposit_data, dry_run)
            if deposit_result:
                print(f"   ✅ Deposit: {name} | Paid={deposit_paid} | Remaining={remaining}")

        ok += 1

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
