import os
import uuid
import logging
from datetime import datetime, time
from django.core.management.base import BaseCommand
from courses.models import Specialization, Course, ScheduledClass, Room
from courses.sheets_sync import get_sheets_service

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Imports courses and sessions from Google Sheets'

    def handle(self, *args, **options):
        print("Cleaning up existing data...")
        ScheduledClass.objects.all().delete()
        Course.objects.all().delete()
        Specialization.objects.all().delete()
        print("Database cleaned. Starting Fresh Import from Google Sheets...")
        
        service = get_sheets_service()
        if not service:
            self.stdout.write(self.style.ERROR("Could not connect to Google Sheets API"))
            return

        spreadsheet_id = "17wAlHTw5jyvsEmNXlcnOCJvRZo978zIfH4magwSwkBU"
        tab_name = "Specializations and TimeTable"
        range_name = f"'{tab_name}'!A2:Z500"

        try:
            result = service.spreadsheets().values().get(
                spreadsheetId=spreadsheet_id, range=range_name).execute()
            rows = result.get("values", [])

            if not rows:
                print("No data found in sheet.")
                return

            print(f"Found {len(rows)} rows. Processing...")

            # pyrefly: ignore [missing-source-for-stubs]
            import requests
            AUTH_URL = os.environ.get("AUTH_SERVICE_URL", "http://auth-service:8001")
            user_map = {}
            try:
                print(f"📡 Fetching users from {AUTH_URL} to sync IDs...")
                resp = requests.get(f"{AUTH_URL}/api/auth/admin/users/", timeout=10)
                auth_users = resp.json()
                user_map = {u['full_name'].strip().lower(): u['id'] for u in auth_users if u['role'] == 'teacher'}
                print(f"✅ Loaded {len(user_map)} teacher mappings.")
            except Exception as e:
                print(f"❌ Failed to fetch users from Auth Service: {e}")

            for row in rows:
                if len(row) < 7: continue
                
                spec_name = row[0].strip()
                course_name = row[1].strip()
                course_code = row[2].strip()
                section = row[3].strip()
                duration_str = row[4].strip()
                days_raw = row[5].strip()
                time_raw = row[6].strip()
                
                room_name = "TBD"
                if len(row) > 11:
                    lab = row[10].strip()
                    cls = row[11].strip()
                    if lab or cls:
                        room_name = f"Lab {lab} / Class {cls}" if lab and cls else (lab or cls)
                
                room, _ = Room.objects.get_or_create(name=room_name, defaults={'capacity': 30})
                teacher_name = row[12].strip() if len(row) > 12 else ""
                
                instructor_id = uuid.uuid4()
                if teacher_name.lower() in user_map:
                    instructor_id = user_map[teacher_name.lower()]
                
                spec, _ = Specialization.objects.get_or_create(name=spec_name)
                
                level = 1
                if 'advance' in course_name.lower(): level = 2
                
                course, _ = Course.objects.update_or_create(
                    specialization=spec,
                    name=course_name,
                    defaults={'course_code': course_code, 'level': level}
                )

                days_list = [d.strip().upper() for d in days_raw.split()]
                day_map = {'M': 'MON', 'W': 'WED', 'F': 'FRI', 'T': 'TUE', 'TH': 'THU', 'S': 'SAT', 'SUN': 'SUN'}
                days = [day_map.get(d, d) for d in days_list]

                ScheduledClass.objects.update_or_create(
                    course=course,
                    section=section,
                    defaults={
                        'instructor_id': instructor_id, 
                        'teacher_name': teacher_name,
                        'room': room,
                        'start_time': time(13, 0),
                        'end_time': time(14, 45),
                        'days': days,
                        'lab_room': room_name,
                        'strength_status': 'seats_available',
                        'total_applications': int(row[23]) if len(row) > 23 and row[23].isdigit() else 0,
                    }
                )
            
            self.stdout.write(self.style.SUCCESS('Import completed successfully!'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error during import: {e}"))
