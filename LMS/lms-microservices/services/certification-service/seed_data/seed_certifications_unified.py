"""
Unified certification seeding script.
Links certificates to enrollment records by student_id + course_code.
Usage (inside cert-service container):
  python seed_data/seed_certifications_unified.py
"""

import os, sys, django, csv, json, uuid, re, io, urllib.request
from datetime import datetime

sys.path.append('/app/seed_data')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'certification_service.settings')
django.setup()

from certifications.models import Certification

SPREADSHEET_ID = "1xjKEMq5N5PoG30AkDFBAgctiR20cdH30Ma4dpBrpIAI"

SHEET_TABS = [
    "AI11", "AI12", "CF01", "CF02", "CF03", "CF04", "CF05", "CF06",
    "CF07", "CF08", "CF09", "CF010", "CS11", "CS12", "DM11", "DM12",
    "DS11", "DS12", "GC11", "GC12", "GC13", "GC14", "GD11",
    "LE11", "LE12", "LE13", "LE14", "NS11", "VE11",
    "WD11", "WD12", "WD13", "WD14",
]

COURSE_MAPPING_PATH = '/app/course_mapping.json'

AUTH_SERVICE_URL = 'http://auth-service:8001'
COURSE_SERVICE_URL = 'http://course-service:8004'

import requests


def extract_course_code(student_id_val):
    parts = student_id_val.split('-')
    if len(parts) >= 2:
        code_sec = parts[1]
        match = re.match(r'^([A-Za-z]+\d*)([1-9]\d*)$', code_sec)
        return match.group(1) if match else code_sec
    return ''


def fetch_sheet_csv(spreadsheet_id, sheet_name):
    url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/gviz/tq?tqx=out:csv&sheet={sheet_name}"
    try:
        resp = urllib.request.urlopen(url, timeout=30)
        content = resp.read().decode('utf-8-sig')
        rows = list(csv.reader(io.StringIO(content)))
        if not rows:
            return []
        header_row_idx = None
        for i, row in enumerate(rows):
            normalized = [c.strip().upper() for c in row]
            if 'ID' in normalized and 'STUDENT NAME' in normalized:
                header_row_idx = i
                break
        if header_row_idx is None:
            return []
        headers = [c.strip().upper() for c in rows[header_row_idx]]
        result = []
        for row in rows[header_row_idx + 1:]:
            if len(row) < len(headers):
                row += [''] * (len(headers) - len(row))
            result.append(dict(zip(headers, [c.strip() for c in row])))
        return result
    except Exception as e:
        print(f"  Error fetching '{sheet_name}': {e}")
        return []


def get_enrollments_map():
    try:
        enrollments = []
        page = 1
        while True:
            resp = requests.get(
                f"{COURSE_SERVICE_URL}/api/courses/enrollments/",
                params={'page': page, 'limit': 200, 'class_status': 'completed'},
                timeout=15
            )
            if resp.status_code != 200:
                break
            data = resp.json()
            items = data.get('items', [])
            enrollments.extend(items)
            total = data.get('total', 0)
            if page * 200 >= total:
                break
            page += 1

        lookup = {}
        for enr in enrollments:
            course = enr.get('course', {}) or {}
            course_name = (course.get('name') or course.get('title') or '').upper()
            scheduled = enr.get('scheduled_class', {}) or {}
            section = (scheduled.get('section') or '').strip()
            student_id = enr.get('student_id', '')
            enrollment_id = enr.get('id', '')
            course_id = course.get('id', '')
            code = f"{student_id}|{course_name}|{section}"
            lookup[code] = {
                'enrollment_id': enrollment_id,
                'student_id': student_id,
                'course_id': course_id,
                'course_name': course_name,
            }
        print(f"Fetched {len(enrollments)} completed enrollments")
        return lookup
    except Exception as e:
        print(f"Error fetching enrollments: {e}")
        return {}


def extract_section_from_tab(tab_name):
    match = re.match(r'^([A-Za-z]+\d*)([1-9]\d*)$', tab_name)
    if match:
        return match.group(2)
    return ''


def seed_certifications():
    course_by_code = {}
    if os.path.exists(COURSE_MAPPING_PATH):
        with open(COURSE_MAPPING_PATH, 'r') as f:
            course_by_code = json.load(f)
        print(f"Loaded {len(course_by_code)} course code->UUID mappings.")
    else:
        print("No course_mapping.json found.")

    enrollments_map = get_enrollments_map()
    if not enrollments_map:
        print("WARNING: No completed enrollments found. Certificates will be created without enrollment link.")

    created = 0
    skipped = 0
    errors = 0
    linked = 0

    for tab_name in SHEET_TABS:
        print(f"\nTab: {tab_name}...")
        rows = fetch_sheet_csv(SPREADSHEET_ID, tab_name)
        print(f"  Rows: {len(rows)}")

        section_num = extract_section_from_tab(tab_name)
        course_code_prefix = re.match(r'^([A-Za-z]+\d*)', tab_name)
        course_code = course_code_prefix.group(1) if course_code_prefix else tab_name

        for row in rows:
            student_id_val = row.get('ID', '').strip()
            student_name = row.get('STUDENT NAME', '').strip()
            cert_issue = row.get('CERTIFICATED ISSUE', '').strip().upper()
            paper_marks_raw = row.get('PAPER MARKS', '').strip()

            if cert_issue != 'ISSUE' or not student_id_val or not student_name:
                skipped += 1
                continue

            if Certification.objects.filter(student_name=student_name, course_code=course_code).exists():
                skipped += 1
                continue

            try:
                grade = float(paper_marks_raw) if paper_marks_raw and paper_marks_raw != '-' else None
            except ValueError:
                grade = None

            course_uuid = course_by_code.get(course_code)

            enrollment_info = enrollments_map.get(
                f"{student_id_val}|{course_code.upper()}|{section_num}"
            )
            if not enrollment_info:
                enrollment_info = enrollments_map.get(
                    f"{student_id_val}|{course_code.upper()}|"
                )

            if enrollment_info:
                linked += 1

            student_uuid = enrollment_info['student_id'] if enrollment_info else None
            resolved_course_id = course_uuid or (enrollment_info['course_id'] if enrollment_info else None)

            verif_code = uuid.uuid4().hex[:16].upper()

            try:
                cert = Certification.objects.create(
                    student_id=student_uuid or student_id_val,
                    course_id=resolved_course_id,
                    enrollment_id=enrollment_info['enrollment_id'] if enrollment_info else None,
                    certificate_number=f"AIT-CERT-{datetime.now().year}-{created + 1:05d}",
                    verification_code=verif_code,
                    student_name=student_name,
                    course_title=tab_name,
                    course_code=course_code,
                    grade=grade,
                    is_verified=True,
                    verified_at=datetime.now(),
                    institution_name='AIT Institute',
                )
                link_status = " linked" if enrollment_info else " NO LINK"
                print(f"  OK {student_name} ({student_id_val}){link_status}")
                created += 1
            except Exception as e:
                print(f"  ERR {student_id_val}: {e}")
                errors += 1

    print(f"\nCreated: {created}  Skipped: {skipped}  Errors: {errors}  Linked: {linked}")


if __name__ == "__main__":
    seed_certifications()
