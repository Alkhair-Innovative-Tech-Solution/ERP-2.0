"""
seed_teachers_from_sheet.py
───────────────────────────────────────────────────
Reads 'Specializations and TimeTable' sheet and creates teacher accounts
for ALL names found in both the 'Teacher' AND 'Ass. Teacher' columns.

Run: docker exec auth-service python seed_teachers_from_sheet.py
"""
import os
import sys
import json
import django
import re

# Setup Django Environment
sys.path.append('/app')
sys.path.append('/app/seed_data')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings')
django.setup()

from users.models import User, Teacher, Branch
try:
    from google_sheets_util import read_csv_data
except ImportError:
    from .google_sheets_util import read_csv_data

CSV_FILE = os.environ.get('TIMETABLE_CSV', '/app/seed_data/timetable.csv')

# Path to enriched teacher profile data
TEACHERS_CSV = os.environ.get('TEACHERS_CSV', '/app/shared/teachers.csv')


def load_teachers_csv(filepath):
    """Load teachers.csv and return {lowercase_name: {field: value}} for enrichment."""
    if not filepath or not os.path.exists(filepath):
        print(f"  ℹ  Teachers CSV not found at: {filepath}")
        return {}
    rows = read_csv_data(filepath)
    if not rows:
        return {}

    lookup = {}
    for row in rows:
        raw_name = (row.get('full_name') or '').strip()
        if not raw_name:
            continue
        # 'experiance' is a known typo in the CSV header
        experience_raw = (row.get('experiance') or row.get('experience') or '').strip()

        entry = {
            'email':          (row.get('email') or '').strip(),
            'phone':          (row.get('phone') or '').strip(),
            'cnic':           (row.get('cnic') or '').strip(),
            'password':       (row.get('password') or '').strip(),
            'specialization': (row.get('specialization') or '').strip(),
            'qualification':  (row.get('qualification') or '').strip(),
            'experience':     experience_raw,
            'branch':         (row.get('branch') or '').strip(),
        }
        lookup[raw_name.lower()] = entry

    print(f"  ✅ Loaded {len(rows)} teacher records from {filepath}")
    return lookup


def normalize_name(name):
    """Strip whitespace from teacher names."""
    if not name:
        return name
    return name.strip()


def seed_teachers():
    print(f"Reading data from {CSV_FILE}...")
    rows = read_csv_data(CSV_FILE)

    if not rows:
        print("No data found.")
        return

    # ─────────────────────────────────────────────────────────────────
    # Load enriched teacher profile data from teachers.csv
    # ─────────────────────────────────────────────────────────────────
    teachers_lookup = load_teachers_csv(TEACHERS_CSV)
    enriched_count = 0

    # ─────────────────────────────────────────────────────────────────
    # Collect unique names from BOTH 'Teacher' AND 'Ass. Teacher' cols
    # ─────────────────────────────────────────────────────────────────
    raw_teacher_names = set()
    for row in rows:
        for col in ['Teacher', 'Ass. Teacher']:
            raw = row.get(col, '').strip()
            if raw:
                # Split on '|' or ',' in case multiple names are in one cell
                names = [normalize_name(n) for n in re.split(r'[|,]', raw) if n.strip()]
                raw_teacher_names.update(names)

    # Remove any empty strings that slipped through
    raw_teacher_names.discard('')
    raw_teacher_names.discard(None)

    print(f"Found {len(raw_teacher_names)} unique teacher names "
          f"(main + assistant, after normalization).")

    mapping = {}
    total_count = 0

    for name in sorted(raw_teacher_names):
        if not name:
            continue

        # ── Look up enriched data from teachers.csv ──────────────
        csv_data = teachers_lookup.get(name.strip().lower()) if teachers_lookup else None
        if csv_data:
            enriched_count += 1

        # Build a safe email from the teacher's name (fallback)
        safe_name = re.sub(r'[^a-zA-Z0-9]', '', name).lower()
        email = csv_data['email'] if csv_data and csv_data['email'] else f"{safe_name}.ait@iak.ngo"

        # Resolve branch from teachers.csv (try exact → contains → code)
        branch_obj = None
        if csv_data and csv_data['branch']:
            branch_name = csv_data['branch']
            branch_obj = (
                Branch.objects.filter(name__iexact=branch_name).first() or
                Branch.objects.filter(name__icontains=branch_name).first() or
                Branch.objects.filter(code__iexact=branch_name).first()
            )

        # Check if user already exists (by email, guards against duplicate runs)
        existing_user = User.objects.filter(email=email).first()

        if existing_user:
            user = existing_user
            # Update enriched fields on existing user if CSV data is available
            if csv_data:
                changed = False
                if csv_data['phone'] and not user.phone:
                    user.phone = csv_data['phone']
                    changed = True
                if csv_data['cnic'] and not user.cnic:
                    user.cnic = csv_data['cnic']
                    changed = True
                if csv_data['password']:
                    user.set_password(csv_data['password'])
                    changed = True
                if branch_obj and user.branch != branch_obj:
                    user.branch = branch_obj
                    changed = True
                if changed:
                    user.save()
            print(f"  ℹ  Already exists:      {name}")
        else:
            password = csv_data['password'] if csv_data and csv_data['password'] else "ait_teacher_123"
            user = User.objects.create_user(
                full_name=name,
                cnic=csv_data['cnic'] if csv_data else None,
                email=email,
                phone=csv_data['phone'] if csv_data else None,
                password=password,
                role="teacher"
            )
            if branch_obj:
                user.branch = branch_obj
                user.save(update_fields=['branch'])
            print(f"  ✅ Created account for: {name}")

        # ── Ensure Teacher profile exists with enriched data ─────
        specialization = csv_data['specialization'] if csv_data and csv_data['specialization'] else 'General Instructor'
        qualification = csv_data['qualification'] if csv_data and csv_data['qualification'] else 'Assigned from Sheet'
        # Extract first number from experience string (e.g. "1 Year" → 1)
        experience_match = re.search(r'\d+', csv_data['experience']) if csv_data and csv_data['experience'] else None
        experience = int(experience_match.group()) if experience_match else 1

        teacher, created = Teacher.objects.get_or_create(
            user=user,
            defaults={
                'specialization': specialization,
                'qualification':  qualification,
                'experience':     experience,
                'availability':   {},
                'branch':         branch_obj,
            }
        )
        # Update existing teacher profile if CSV data is richer
        if not created and csv_data:
            update_fields = []
            if csv_data['specialization'] and teacher.specialization != csv_data['specialization']:
                teacher.specialization = specialization
                update_fields.append('specialization')
            if csv_data['qualification'] and teacher.qualification != csv_data['qualification']:
                teacher.qualification = qualification
                update_fields.append('qualification')
            if csv_data['experience'] and teacher.experience != experience:
                teacher.experience = experience
                update_fields.append('experience')
            if branch_obj and teacher.branch != branch_obj:
                teacher.branch = branch_obj
                update_fields.append('branch')
            if update_fields:
                teacher.save(update_fields=update_fields)

        mapping[name] = str(user.id)
        total_count += 1

    # ─────────────────────────────────────────────────────────────────
    # Save name → UUID mapping (consumed by import_academic_structure)
    # Write to shared volume so course-service can read it
    # ─────────────────────────────────────────────────────────────────
    os.makedirs('/app/shared', exist_ok=True)
    with open('teacher_mapping.json', 'w') as f:
        json.dump(mapping, f, indent=4)
    with open('/app/shared/teacher_mapping.json', 'w') as f:
        json.dump(mapping, f, indent=4)

    print(f"\nTeacher seeding finished!")
    print(f"Total mapped teachers    : {total_count}")
    if teachers_lookup:
        print(f"Enriched from teachers.csv: {enriched_count}/{total_count}")
    print(f"Mapping saved to        : teacher_mapping.json (local + shared)")


if __name__ == "__main__":
    seed_teachers()
