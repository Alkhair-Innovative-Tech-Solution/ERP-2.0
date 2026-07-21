import csv
import uuid
import re
from datetime import datetime
from django.core.management.base import BaseCommand  # type: ignore
from django.db import transaction  # type: ignore
from django.contrib.auth.hashers import make_password  # type: ignore
from users.models import User, Student, GuardianInfo, ResidentialInfo, StudentAcademicRecord


class Command(BaseCommand):
    help = 'Imports historical student admission data from CSV'

    def add_arguments(self, parser):
        parser.add_argument('--csv', type=str, required=True, help='Path to the CSV file to import')
        parser.add_argument('--dry-run', action='store_true', help='Simulate import without saving to database')

    def parse_date(self, date_str):
        if not date_str:
            return None
        for fmt in ('%m/%d/%Y', '%d-%b-%Y', '%Y-%m-%d', '%d/%m/%Y', '%B %d, %Y'):
            try:
                return datetime.strptime(date_str.strip(), fmt).date()
            except ValueError:
                pass
        self.stdout.write(self.style.WARNING(f"  Could not parse date: '{date_str}'"))
        return None

    def clean_phone(self, phone_str):
        """Normalize Pakistani phone numbers to 03XXXXXXXXX format."""
        if not phone_str:
            return None
        digits = re.sub(r'\D', '', phone_str)
        if digits.startswith('92') and len(digits) == 12:
            digits = '0' + digits[2:]
        return digits[:15]  # max 15 chars

    def make_email(self, name, phone, cnic):
        """Generate a placeholder email if none given."""
        slug = re.sub(r'\s+', '.', name.strip().lower())
        suffix = phone[-4:] if phone else cnic[-4:] if cnic else '0000'
        return f"{slug}.{suffix}@ait.placeholder.com"

    def make_username(self, name, phone):
        slug = re.sub(r'\s+', '_', name.strip().lower())
        suffix = phone[-4:] if phone else '0000'
        return f"{slug}_{suffix}"[:150]

    def determine_gender(self, gender_str):
        g = gender_str.strip().upper() if gender_str else ''
        if g == 'FEMALE':
            return 'F'
        return 'M'

    def handle(self, *args, **options):
        csv_path = options['csv']
        dry_run = options['dry_run']

        if dry_run:
            self.stdout.write(self.style.WARNING('=== DRY RUN: No data will be saved ==='))

        created_count = 0
        skipped_count = 0
        error_count = 0

        try:
            with open(csv_path, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                headers = [h.strip() for h in (reader.fieldnames or [])]
                self.stdout.write(self.style.SUCCESS(f'Found {len(headers)} columns'))

                def get(row, *keys):
                    # Clean row keys (strip spaces) for matching
                    clean_row = {k.strip(): v for k, v in row.items() if k}
                    for k in keys:
                        if k in clean_row: return clean_row[k].strip()
                    return ''

                for row_num, row in enumerate(reader, start=2):
                    name = get(row, 'Name')
                    phone = self.clean_phone(get(row, 'WhatsApp Number', 'Phone'))
                    cnic = get(row, 'CNIC/B-Form Number').replace('-', '')[:15]
                    email = get(row, 'Email') or self.make_email(name, phone, cnic)
                    gender = self.determine_gender(get(row, 'Gender'))
                    dob_str = get(row, 'Date of Birth')
                    dob = self.parse_date(dob_str)
                    address = get(row, 'Full Address')
                    qualification = get(row, 'Last Qualification')
                    father_name = get(row, 'Father/Guardian Name', "Father's Name")
                    guardian_phone = self.clean_phone(get(row, 'Guardian Contact Number', 'Contact Number'))
                    application_id = get(row, 'Applications', 'Application ID', 'Student ID')
                    course_type = get(row, 'Select Course Type', 'Course Type')
                    specialization = get(row, 'Select Specialization Course', 'Specialization')
                    language_course = get(row, 'Choose Language Course')
                    section = get(row, 'Section')

                    if not name:
                        self.stdout.write(self.style.WARNING(f'  Row {row_num}: Skipping empty name'))
                        skipped_count += 1
                        continue

                    # If CNIC is empty, generate a placeholder
                    if not cnic:
                        cnic = f"PLACEHOLDER-{row_num:05d}"

                    username = self.make_username(name, phone)

                    try:
                        with transaction.atomic():
                            # --- 1. Create User ---
                            if not dry_run:
                                user, user_created = User.objects.get_or_create(
                                    cnic=cnic,
                                    defaults={
                                        'full_name': name,
                                        'email': email,
                                        'phone': phone or f'0300{row_num:07d}',
                                        'role': 'student',
                                        'password': make_password('AIT@2025'),  # default password
                                    }
                                )
                                if not user_created:
                                    self.stdout.write(self.style.WARNING(f'  Row {row_num}: User {name} (CNIC: {cnic}) already exists – skipping'))
                                    skipped_count += 1
                                    continue

                                # --- 2. Create Student Profile ---
                                student, _ = Student.objects.get_or_create(
                                    user=user,
                                    defaults={'status': 'enrolled'}
                                )

                                # --- 3. Guardian Info ---
                                GuardianInfo.objects.get_or_create(
                                    student=student,
                                    defaults={
                                        'father_name': father_name,
                                        'father_phone': guardian_phone,
                                        'emergency_contact_name': father_name,
                                        'emergency_contact_phone': guardian_phone,
                                    }
                                )

                                # --- 4. Residential Info ---
                                ResidentialInfo.objects.get_or_create(
                                    student=student,
                                    defaults={
                                        'address': address,
                                        'city': 'Karachi',
                                        'country': 'Pakistan',
                                    }
                                )

                                # --- 5. Academic Record ---
                                StudentAcademicRecord.objects.get_or_create(
                                    student=student,
                                    defaults={
                                        'highest_qualification': qualification,
                                    }
                                )

                            course_enrolled = specialization or language_course or course_type
                            self.stdout.write(self.style.SUCCESS(
                                f'  Row {row_num}: {"[DRY] " if dry_run else ""}Added -> {name} | CNIC: {cnic} | Course: {course_enrolled}'
                            ))
                            created_count += 1

                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f'  Row {row_num}: Error for {name}: {str(e)}'))
                        error_count += 1

        except FileNotFoundError:
            self.stdout.write(self.style.ERROR(f'File not found: {csv_path}'))
            return

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'=== IMPORT SUMMARY ==='))
        self.stdout.write(self.style.SUCCESS(f'  Created : {created_count}'))
        self.stdout.write(self.style.WARNING(f'  Skipped : {skipped_count}'))
        self.stdout.write(self.style.ERROR(  f'  Errors  : {error_count}'))
        if dry_run:
            self.stdout.write(self.style.WARNING('=== DRY RUN COMPLETE — Nothing was saved ==='))
        else:
            self.stdout.write(self.style.SUCCESS('=== IMPORT COMPLETE ==='))
