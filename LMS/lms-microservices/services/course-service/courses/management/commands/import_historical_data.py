import csv
import uuid
from datetime import datetime
from django.core.management.base import BaseCommand  # type: ignore
from django.db import transaction  # type: ignore
from courses.models import Batch, Specialization, Course, Room, ScheduledClass

class Command(BaseCommand):
    help = 'Imports historical course data from a CSV file.'

    def add_arguments(self, parser):
        parser.add_argument('--csv', type=str, required=True, help='Path to the CSV file to import')
        parser.add_argument('--dry-run', action='store_true', help='Read data and print actions without saving to database')

    def parse_date(self, date_str):
        if not date_str or date_str.lower() in ['none', 'null', 'nan', '']:
            return None
        # Try to parse '27-Sep-2025' or similar formats
        for fmt in ('%d-%b-%Y', '%Y-%m-%d', '%d/%m/%Y', '%B %d, %Y', '%A, %B %d, %Y', '%A %d %B %Y'):
            try:
                # Remove ordinals like 1st, 2nd, 3rd, 4th from the date string for parsing if present
                import re
                clean_date = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', date_str.strip())
                # Normalize double spaces to single spaces
                clean_date = re.sub(r'\s+', ' ', clean_date)
                return datetime.strptime(clean_date, fmt).date()
            except ValueError:
                pass
        return None

    def parse_time(self, t_str, default_hour):
        from datetime import time
        if not t_str or t_str.lower() in ['none', '']:
            return time(default_hour, 0)
        
        t_str = t_str.lower().strip()
        try:
            # Handle format like "5:15 pm"
            if 'pm' in t_str or 'am' in t_str:
                format_str = '%I:%M %p' if ':' in t_str else '%I %p'
                return datetime.strptime(t_str, format_str).time()
            elif ':' in t_str:
                return datetime.strptime(t_str, '%H:%M').time()
        except ValueError:
            pass
        return time(default_hour, 0)

    def handle(self, *args, **options):
        csv_file_path = options['csv']
        dry_run = options['dry_run']

        if dry_run:
            self.stdout.write(self.style.WARNING("=== DRY RUN MODE: Database will not be modified ==="))

        try:
            with open(csv_file_path, mode='r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                # Ensure headers exist. Use loose matching for common variants
                headers = [h.strip() for h in reader.fieldnames or []]
                self.stdout.write(self.style.SUCCESS(f"Found headers: {headers}"))

                def get_val(row, *possible_keys):
                    for k in possible_keys:
                        if k in row: return row[k].strip()
                    return ""

                with transaction.atomic():
                    for row_num, row in enumerate(reader, start=2):
                        
                        spec_name = get_val(row, 'Specialization')
                        course_level_str = get_val(row, 'Course')
                        code = get_val(row, 'Code')
                        section = get_val(row, 'Section')
                        duration_str = get_val(row, 'Durration', 'Duration')
                        days_str = get_val(row, 'Days')
                        time_str = get_val(row, 'Time')
                        ramdan_time = get_val(row, 'Ramdan Time')
                        status_str = get_val(row, 'Status')
                        room_name = get_val(row, 'Lab | Class', 'Lab')
                        teacher_name = get_val(row, 'Teacher')
                        start_date_str = get_val(row, 'Satrt Date', 'Start Date')
                        end_date_str = get_val(row, 'End Date')
                        exam_date_str = get_val(row, 'Exam Date')
                        exam_status = get_val(row, 'Exam Status')
                        cert_date_str = get_val(row, 'Certificate Date')
                        cert_status = get_val(row, 'Certificate Status')
                        students_count = get_val(row, 'Students')
                        apps_count = get_val(row, 'Applications')
                        asst_teacher = get_val(row, 'Ass. Teacher')
                        description = get_val(row, 'Description')

                        # Skip empty rows
                        if not spec_name and not code:
                            continue

                        # Parse Dates
                        start_date = self.parse_date(start_date_str)
                        end_date = self.parse_date(end_date_str)
                        exam_date = self.parse_date(exam_date_str)
                        cert_date = self.parse_date(cert_date_str)

                        # Determine/Find Batch
                        # Map to a Batch based on start date
                        batch_name = "Imported Batch"
                        if start_date:
                            batch_name = f"Batch - {start_date.strftime('%b %Y')}"
                        
                        if not dry_run:
                            batch, _ = Batch.objects.get_or_create(
                                name=batch_name,
                                defaults={'start_date': start_date, 'end_date': end_date}
                            )
                        else:
                            batch = Batch(id=uuid.uuid4(), name=batch_name, start_date=start_date, end_date=end_date)
                        
                        # Find Specialization
                        if not dry_run:
                            specialization, _ = Specialization.objects.get_or_create(
                                name=spec_name,
                                batch=batch,
                                defaults={'description': f'Imported specialization for {batch_name}'}
                            )
                        else:
                            specialization = Specialization(id=uuid.uuid4(), name=spec_name, batch=batch)

                        # Determine Level
                        level_choice = 0
                        l_lower = course_level_str.lower()
                        if 'advance' in l_lower or 'level 2' in l_lower: level_choice = 2
                        elif 'begin' in l_lower or 'level 1' in l_lower or 'level 0' in l_lower: level_choice = 1
                        
                        duration_months = 4 
                        import re
                        digits = re.findall(r'\d+', duration_str)
                        if digits: duration_months = int(digits[0])

                        # Create Course
                        course_display_name = f"{code} - {course_level_str} {spec_name}" if code else f"{course_level_str} {spec_name}"
                        course_display_name = course_display_name[:250]
                        if not dry_run:
                            course, _ = Course.objects.get_or_create(
                                name=course_display_name,
                                specialization=specialization,
                                defaults={
                                    'description': description or course_level_str,
                                    'level': level_choice,
                                    'duration': duration_months
                                }
                            )
                        else:
                            course = Course(id=uuid.uuid4(), name=course_display_name, specialization=specialization, level=level_choice)

                        # Create Room
                        if not room_name: room_name = 'TBD'
                        if not dry_run:
                            room, _ = Room.objects.get_or_create(name=room_name)
                        else:
                            room = Room(id=uuid.uuid4(), name=room_name)
                            
                        # Instructor Mapping
                        instructor_id = uuid.uuid5(uuid.NAMESPACE_DNS, teacher_name) if teacher_name else uuid.uuid4()
                        asst_inst_id = uuid.uuid5(uuid.NAMESPACE_DNS, asst_teacher) if asst_teacher else None

                        # Scheduled Class
                        if not dry_run:
                            ScheduledClass.objects.get_or_create(
                                course=course,
                                batch=batch,
                                room=room,
                                section=section,
                                defaults={
                                    'instructor_id': instructor_id,
                                    'assistant_teacher_id': asst_inst_id,
                                    'start_time': self.parse_time(time_str.split('-')[0] if '-' in time_str else '', 13),
                                    'end_time': self.parse_time(time_str.split('-')[1] if '-' in time_str else '', 15),
                                    'ramdan_time': ramdan_time,
                                    'course_start_date': start_date,
                                    'course_end_date': end_date,
                                    'exam_date': exam_date,
                                    'exam_status': exam_status,
                                    'certificate_date': cert_date,
                                    'certificate_status': cert_status,
                                    'total_students': int(students_count) if students_count.isdigit() else 0,
                                    'total_applications': int(apps_count) if apps_count.isdigit() else 0,
                                    'days': days_str.split() if days_str else [],
                                    'active': 'Full' not in status_str.title()
                                }
                            )
                        
                        self.stdout.write(self.style.SUCCESS(f"Row {row_num}: Processed '{course_display_name}'"))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error occurred: {str(e)}"))
            if dry_run:
                raise e

        self.stdout.write(self.style.SUCCESS("=== OPERATION COMPLETE ==="))
