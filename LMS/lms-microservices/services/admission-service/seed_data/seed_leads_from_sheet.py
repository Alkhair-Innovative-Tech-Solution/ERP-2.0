"""
Seed leads from local CSV file (offline version).
Reads admissions.csv and creates EntranceLead records,
skipping duplicates by email to avoid clobbering leads
created by seed_from_master_sheet.py.
"""
import os, sys, re, django

sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'admission_service.settings')
django.setup()

from django.db import transaction
from tests.models import EntranceLead
from google_sheets_util import read_csv_data

CSV_FILE = os.environ.get('LEADS_CSV', '/app/seed_data/admissions.csv')

COURSE_COLUMNS = [
    'Select Specialization Course',
    'Choose Language Course',
    'Select Course Type',
]


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


def seed_leads():
    print(f"Reading leads from {CSV_FILE}...")
    rows = read_csv_data(CSV_FILE)
    if not rows:
        print("No data found.")
        return

    print(f"{len(rows)} rows loaded.")

    existing_emails = set(
        EntranceLead.objects.filter(email__isnull=False)
        .values_list('email', flat=True)
    )
    print(f"Existing leads in DB: {len(existing_emails)}")

    created_count = 0
    skipped_count = 0
    errors = 0
    BATCH = 100

    leads_to_create = []
    for i, row in enumerate(rows):
        name = tr(row.get('Name'))
        email = tr(row.get('Email')).lower()
        phone = clean_phone(row.get('WhatsApp Number'))

        if not name:
            continue
        if not email and not phone:
            continue

        if not email:
            safe = re.sub(r'[^a-z0-9]', '', name.lower())
            email = f"lead.{safe}_{i}@ait.iak.ngo"

        if email in existing_emails:
            skipped_count += 1
            continue

        course_req = ''
        for col in COURSE_COLUMNS:
            val = tr(row.get(col))
            if val:
                course_req = val
                break
        if not course_req:
            course_req = tr(row.get('Select Specialization Course'))
        if not course_req:
            course_req = tr(row.get('Applications'))

        leads_to_create.append(EntranceLead(
            name=name,
            email=email,
            phone=phone,
            whatsapp_number=phone,
            gender=map_gender(row.get('Gender')),
            father_guardian_name=tr(row.get('Father/Guardian Name')),
            guardian_contact=clean_phone(row.get('Guardian Contact Number')),
            relationship_to_student=tr(row.get('Relationship to Student'), 100),
            full_address=tr(row.get('Full Address'), 500),
            cnic_number=tr(row.get('CNIC/B-Form Number'), 20),
            last_qualification=tr(row.get('Last Qualification'), 100),
            course_name_requested=course_req,
            status='pending',
        ))

    # Bulk create in batches
    for start in range(0, len(leads_to_create), BATCH):
        batch = leads_to_create[start:start + BATCH]
        try:
            EntranceLead.objects.bulk_create(batch, ignore_conflicts=True)
            created_count += len(batch)
        except Exception as e:
            errors += 1

        done = min(start + BATCH, len(leads_to_create))
        print(f"  [{done}/{len(leads_to_create)}] Created: {created_count} | Skipped: {skipped_count} | Errors: {errors}")

    print("\n============================================================")
    print("DONE!")
    print(f"Leads created: {created_count}")
    print(f"Skipped (already exist): {skipped_count}")
    print(f"Errors: {errors}")
    print("============================================================")


if __name__ == '__main__':
    seed_leads()
