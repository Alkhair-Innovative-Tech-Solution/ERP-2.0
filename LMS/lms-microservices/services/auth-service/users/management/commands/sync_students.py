import uuid
import json
from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth.hashers import make_password
from users.models import User, Student
from google_sheets_util import get_sheet_data

SPREADSHEET_ID = "17wAlHTw5jyvsEmNXlcnOCJvRZo978zIfH4magwSwkBU"
CLASS_SHEETS = [
    "CF0", "CF1",
    "GC1", "GC2",
    "LE1", "LE2",
    "VE1",
    "WD1", "WD2",
    "DM1",
    "CS1", "CS2",
    "NS1", "NS2",
    "DS1", "DS2",
    "AI1", "AI2",
    "GD1", "GD2",
]

class Command(BaseCommand):
    help = 'Syncs student accounts from class-specific Google Sheets'

    def handle(self, *args, **options):
        self.stdout.write("Syncing Student Accounts from Class Sheets...")
        total_created = 0
        skipped = 0
        mapping = {}
        
        for sheet_name in CLASS_SHEETS:
            self.stdout.write(f"  Processing sheet: {sheet_name}")
            try:
                # Read entire sheet
                rows = get_sheet_data(SPREADSHEET_ID, f"{sheet_name}!A1:AZ1000")
                for row in rows:
                    name = row.get('Name', '').strip()
                    email = row.get('Email', '').strip().lower()
                    dp = row.get('DP', '').strip().upper()
                    student_id_from_sheet = row.get('Student ID', '').strip()
                    
                    if not name: 
                        continue
                        
                    # We only want to create users with actual emails 
                    # OR we can skip DP check if they have a real email and ID.
                    # As requested, skip if empty email.
                    if not email:
                        skipped += 1
                        continue
                    
                    cnic = row.get('CNIC/B-Form Number', '').strip()
                    phone = row.get('WhatsApp Number', '').strip() or row.get('Phone', '').strip()
                    
                    final_email = email
                    
                    try:
                        with transaction.atomic():
                            # Create User
                            user, created = User.objects.get_or_create(
                                email=final_email,
                                defaults={
                                    'full_name': name,
                                    'role': 'student',
                                    'password': make_password('AIT@2025'),
                                    'cnic': cnic or f"PENDING-{uuid.uuid4().hex[:8]}",
                                    'phone': phone or f"0000-{uuid.uuid4().hex[:6]}"
                                }
                            )
                            # Update existing name if necessary 
                            if not created and user.full_name != name:
                                user.full_name = name
                                user.save()
                                
                            student, s_created = Student.objects.get_or_create(
                                user=user,
                                defaults={
                                    'status': 'enrolled',
                                    'lms_account_created': True,
                                    'student_id': student_id_from_sheet,
                                    'terms_agreed': True,
                                    'whatsapp_number': phone
                                }
                            )
                            
                            if student_id_from_sheet:
                                student.student_id = student_id_from_sheet
                                student.save()
                            
                            mapping[student_id_from_sheet] = str(user.id)
                            
                            if created or s_created:
                                total_created += 1
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f"    Skipped row '{name}' due to error: {str(e)}"))
            except Exception as sheet_e:
                self.stdout.write(self.style.WARNING(f"    Notice: sheet {sheet_name} issues: {str(sheet_e)}"))

        self.stdout.write(self.style.SUCCESS(f"Finished: {total_created} students created/updated. Skipped {skipped} missing-email rows."))
        
        # Save mapping to file
        with open("student_mapping.json", "w") as f:
            json.dump(mapping, f, indent=2)
        self.stdout.write(self.style.SUCCESS("Saved student_mapping.json"))
