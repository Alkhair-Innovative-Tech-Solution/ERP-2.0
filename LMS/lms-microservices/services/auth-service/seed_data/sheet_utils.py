import os, re, json, requests

SPREADSHEET_ID = "17wAlHTw5jyvsEmNXlcnOCJvRZo978zIfH4magwSwkBU"
STUDENTS_RANGE = "Students!A1:AG5000"

COURSE_NAME_MAP = {
    'AI1': 'AI & Data Science with Python Beginner',
    'AI2': 'AI & Data Science with Python Advance',
    'CS1': 'Cybersecurity Beginner',
    'CS2': 'Cybersecurity Advance',
    'DM1': 'Digital Marketing Beginner',
    'DM2': 'Digital Marketing Advance',
    'CF0': 'Fundamentals(CIT) Level 0',
    'GC1': 'Graphic Designing & Video Editing Beginner',
    'GC2': 'Graphic Designing & Video Editing Advance',
    'GD1': 'Game Development Beginner',
    'GD2': 'Game Development Advance',
    'LE1': 'Language: English Beginner',
    'LE2': 'Language: English Advance',
    'PM1': 'Project Management Beginner',
    'WD1': 'Web Development (MERN) Beginner',
    'WD2': 'Web Development (MERN) Advance',
}

COURSE_ID_MAP_FALLBACK = {
    'AI1': 'a831d3a8-dd66-47e7-ab00-a694222254ba',
    'AI2': 'de376f7f-d285-47fa-b2ea-32982b56940e',
    'CS1': 'e3ef314a-8194-4183-a170-37786164df18',
    'CS2': '2cea1a5a-9f7e-4b16-8f48-977a331cc9b1',
    'DM1': '7536e4bb-dd8c-4f18-a7d5-3b6bedbcea58',
    'DM2': '69843366-32c4-4ed1-b7a6-70d81f0d3b3e',
    'CF0': '5759b740-4ca8-4e2e-b929-aca63486160f',
    'GC1': '6bac155d-a7eb-4ab8-89f7-d7518d6c37c4',
    'GC2': 'f0969f30-d6e5-4f82-adc0-8ae92f54d928',
    'GD1': '2ddbc210-9d52-4e30-9eb2-33f25c600a30',
    'GD2': 'a501e5c1-3799-4770-9916-fb4e7fe5e9a9',
    'LE1': '2d067eca-9787-4210-aee8-5c79e54b0f71',
    'LE2': 'ac62dcd5-3f17-4113-8246-e677ad11ddc5',
    'WD1': 'be7c6ff5-3052-4f6f-8bd6-f55ecd604353',
    'WD2': '349b6eef-3f1a-40ab-a13d-5d6e9aadd867',
}


def tr(v, n=255):
    return str(v).strip()[:n] if v else ''


def clean_phone(v):
    if not v:
        return ''
    s = str(v).strip()
    if s.lower() in ['male', 'female', 'y', 'n', 'yes', 'no', '']:
        return ''
    s = re.sub(r'[^\d+]', '', s)
    return s[:15]


def map_gender(v):
    if not v:
        return ''
    v = v.lower()
    if 'female' in v:
        return 'female'
    if 'male' in v:
        return 'male'
    return ''


def parse_status(v):
    if not v:
        return 'no'
    return str(v).strip().lower()


def parse_certificate_status(v):
    if not v:
        return ''
    s = str(v).strip().lower()
    if s == 'issue':
        return 'issue'
    if s in ['not issue', 'not-issue', 'not_issue']:
        return 'not_issue'
    if s == 'pending':
        return 'pending'
    return ''


def clean_score(v):
    if not v or v == 'N/A':
        return 0
    try:
        s = str(v).split('/')[0].strip()
        s = re.sub(r'[^\d]', '', s)
        return int(s) if s else 0
    except:
        return 0


def decode_student_id(sid):
    if not sid:
        return None
    sid = sid.strip().replace(' ', '')
    m = re.match(r'^AIT\d{2}-([A-Za-z]{2}\d)(\d+)-(\d+)$', sid)
    if not m:
        return None
    return {
        'course_code': m.group(1).upper(),
        'section':     m.group(2),
        'seq':         m.group(3),
    }


def build_enrollment_entry(decoded, status):
    if not decoded:
        return None
    code = decoded['course_code']
    return {
        'course_code':  code,
        'course_name':  COURSE_NAME_MAP.get(code, ''),
        'section':      decoded['section'],
        'status':       status,
    }


def fetch_course_map():
    try:
        resp = requests.get('http://course-service:8002/api/courses/courses/', timeout=10)
        if resp.status_code == 200:
            courses = resp.json()
            result = {c['course_code']: c['id'] for c in courses if c.get('course_code')}
            if result:
                print(f"   Fetched {len(result)} course UUIDs from live API.")
                return result
    except Exception as e:
        print(f"   Could not fetch courses from API: {e}")

    for path in ['course_mapping.json', '/app/seed_data/course_mapping.json']:
        if os.path.exists(path):
            try:
                with open(path) as f:
                    data = json.load(f)
                result = {code: info['id'] for code, info in data.items() if info.get('id')}
                if result:
                    print(f"   Loaded {len(result)} course UUIDs from {path}.")
                    return result
            except Exception as e:
                print(f"   Could not read {path}: {e}")

    print("   Using fallback hardcoded course ID map.")
    return dict(COURSE_ID_MAP_FALLBACK)


def generate_receipt_code(slip_no, is_paid, is_waiver):
    if not slip_no:
        return None
    if is_paid:
        return f"p-{slip_no}"
    elif is_waiver:
        return f"w-{slip_no}"
    return f"u-{slip_no}"
