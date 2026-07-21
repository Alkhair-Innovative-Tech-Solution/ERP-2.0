"""
link_course_ids.py
───────────────────
Matches every EntranceLead.course_name_requested to the correct
Course UUID from course-service and saves it as course_id.

Run inside the admission-service container:
    docker exec admission-service python link_course_ids.py
"""

import os, django, sys, uuid

sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'admission_service.settings')
django.setup()

from tests.models import EntranceLead

# ── Course UUIDs from course-service (hardcoded from DB query) ──────────────
COURSE_UUID_MAP = {
    'ai':          '264700d1-843c-4f82-b2b8-898585dea981',   # AI & Data Science with Python
    'data':        '264700d1-843c-4f82-b2b8-898585dea981',
    'cybersecurity': '7a1e0bd7-ecf2-4451-a98c-ddbd7cb9460a',
    'cyber':       '7a1e0bd7-ecf2-4451-a98c-ddbd7cb9460a',
    'digital':     'ebe8e406-93a7-4a25-b0e0-dafcbaddba73',   # Digital Marketing
    'marketing':   'ebe8e406-93a7-4a25-b0e0-dafcbaddba73',
    'game':        'bcb9ff0d-25e7-4a5b-88ec-713ab63f22a3',   # Game Development
    'graphic':     'd004395d-9bb1-443d-b67d-aa8ae33b646d',   # Graphic Design & Video Editing
    'video':       'd004395d-9bb1-443d-b67d-aa8ae33b646d',
    'web':         'de182669-7957-47fb-bb81-35f9f15c405d',    # Web Development (MERN)
    'mern':        'de182669-7957-47fb-bb81-35f9f15c405d',
    'fundamental': 'fd3d1201-df53-4fc5-a6d6-9796e23c1d62',   # Fundamentals (CIT)
    'cit':         'fd3d1201-df53-4fc5-a6d6-9796e23c1d62',
    'network':     '22d44ef3-7906-48d8-a739-cc2055543351',   # Networking
    'language':    'ce6323cd-d5f8-4a2b-aabc-2357cb0be4a5',   # Language: English
    'english':     'ce6323cd-d5f8-4a2b-aabc-2357cb0be4a5',
    'project':     '7452617e-b7e7-4dcb-b1da-5dfe6da87164',   # Project Management
}

def match_course(name: str):
    """Return UUID string for the best-matching course, or None."""
    if not name:
        return None
    name_lower = name.lower()
    for keyword, uid in COURSE_UUID_MAP.items():
        if keyword in name_lower:
            return uid
    return None

def link_courses():
    leads = EntranceLead.objects.filter(course_id__isnull=True)
    total = leads.count()
    print(f"Found {total} leads without course_id. Linking now...")

    updated = 0
    skipped = 0

    for lead in leads:
        uid_str = match_course(lead.course_name_requested)
        if uid_str:
            lead.course_id = uuid.UUID(uid_str)
            lead.save(update_fields=['course_id'])
            updated += 1
        else:
            skipped += 1
            if skipped <= 10:
                print(f"  ⚠ No match for: '{lead.course_name_requested}'")

    print(f"\n✅ Linked:   {updated}")
    print(f"⚠  Skipped:  {skipped} (no keyword match)")
    print(f"\nDone! Refresh the deposits page to see course names.")

if __name__ == '__main__':
    link_courses()
