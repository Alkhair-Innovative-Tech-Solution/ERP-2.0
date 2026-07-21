import csv
import uuid
import re
from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from users.models import User

class Command(BaseCommand):
    help = 'Creates teacher accounts from the timetable CSV'

    def add_arguments(self, parser):
        parser.add_argument('--csv', type=str, required=True, help='Path to timetable CSV')

    def normalize_name(self, name):
        if not name: return ""
        # Handle cases like "Zia ul Haq / Usman" -> take first one or handle both?
        # For now, let's treat the entry as one full identity
        return name.strip()

    def handle(self, *args, **options):
        csv_path = options['csv']
        
        teachers_found = set()
        
        try:
            with open(csv_path, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # Clean the keys to handle spaces
                    clean_row = {k.strip(): v for k, v in row.items() if k}
                    t1_raw = clean_row.get('Teacher', '').strip()
                    t2_raw = clean_row.get('Ass. Teacher', '').strip()
                    
                    # Function to split and clean names
                    def split_names(raw_str):
                        if not raw_str: return []
                        # Split by |, /, or ,
                        parts = re.split(r'[|/,]', raw_str)
                        return [p.strip() for p in parts if p.strip()]

                    for name in split_names(t1_raw): teachers_found.add(name)
                    for name in split_names(t2_raw): teachers_found.add(name)

            created = 0
            skipped = 0

            for t_name in teachers_found:
                # Generate same UUID as we used in course-service
                t_id = uuid.uuid5(uuid.NAMESPACE_DNS, t_name)
                
                # Create User if not exists
                # We use a placeholder email based on name
                email_slug = re.sub(r'\s+', '.', t_name.lower())
                email = f"{email_slug}@ait.edu.pk"
                
                user, was_created = User.objects.get_or_create(
                    id=t_id,
                    defaults={
                        'full_name': t_name,
                        'email': email,
                        'phone': f"0000{str(uuid.uuid4().int)[:10]}",
                        'role': 'teacher',
                        'password': make_password('AIT@Teacher2025'),
                        'cnic': f"T-{t_id.hex[:10]}" # Placeholder CNIC
                    }
                )
                
                if was_created:
                    created += 1
                else:
                    skipped += 1

            self.stdout.write(self.style.SUCCESS(f"Teacher Sync: Created {created} | Already Exists {skipped}"))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error: {str(e)}"))
