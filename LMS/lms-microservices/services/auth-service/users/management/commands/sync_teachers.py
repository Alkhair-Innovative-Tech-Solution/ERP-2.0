import re
from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from users.models import User, Teacher
from google_sheets_util import get_sheet_data

SPREADSHEET_ID = "17wAlHTw5jyvsEmNXlcnOCJvRZo978zIfH4magwSwkBU"

class Command(BaseCommand):
    help = 'Syncs teacher accounts from Google Sheets'

    def handle(self, *args, **options):
        self.stdout.write("Fetching teachers from Specializations and TimeTable sheet...")
        try:
            rows = get_sheet_data(SPREADSHEET_ID, "Specializations and TimeTable!A1:Z500")
            teachers_set = { (r.get('Teacher') or r.get('Full Name', '')).strip() for r in rows if (r.get('Teacher') or r.get('Full Name', '')) }
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error: {str(e)}"))
            return

        total_created = 0
        mapping = {}
        
        for name in teachers_set:
            if not name: continue
            
            # Clean name for safe email generation (no spaces or slashes)
            clean_email_name = name.lower().replace(' ', '.').replace('|', '').replace('/', '.').replace('\\', '.')
            email = f"teacher.{clean_email_name}@ait.edu.pk"
            
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'full_name': name,
                    'role': 'teacher',
                    'password': make_password('AIT@Teacher2026'),
                    'is_staff': True
                }
            )
            
            teacher, t_created = Teacher.objects.get_or_create(
                user=user,
                defaults={
                    'specialization': 'IT',
                    'qualification': 'Bachelor Degree',
                    'experience': 5,
                    'availability': {"mon": True, "tue": True, "wed": True, "thu": True, "fri": True, "sat": True}
                }
            )
            mapping[name] = str(user.id)
            if created or t_created:
                total_created += 1
                
        self.stdout.write(self.style.SUCCESS(f"Finished: {total_created} teachers synced."))
        self.stdout.write(f"MAPPING_JSON: {mapping}")
