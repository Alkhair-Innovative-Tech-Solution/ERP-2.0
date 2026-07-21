import csv
import json
import uuid
import re
from django.core.management.base import BaseCommand
from django.db import transaction
from courses.models import Course, ScheduledClass, CourseRegistrationHistory

class Command(BaseCommand):
    help = 'Enrolls students into courses using admission CSV and a student mapping file'

    def add_arguments(self, parser):
        parser.add_argument('--csv', type=str, required=True, help='Path to admission CSV')
        parser.add_argument('--mapping', type=str, required=True, help='Path to student_mapping.json')
        parser.add_argument('--dry-run', action='store_true', help='Simulate enrollment')
        parser.add_argument('--ignore-dp', action='store_true', help='Ignore DP check')

    def handle(self, *args, **options):
        csv_path = options['csv']
        mapping_path = options['mapping']
        dry_run = options['dry_run']

        try:
            with open(mapping_path, 'r', encoding='utf-8-sig') as f:
                mapping = json.load(f)
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Could not load mapping: {e}"))
            return

        enrolled = 0
        skipped = 0
        errors = 0

        try:
            with open(csv_path, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                
                # Normalize headers (strip spaces)
                clean_headers = [h.strip() for h in (reader.fieldnames or [])]
                
                def get_val(row, *keys):
                    clean_row = {k.strip(): v for k, v in row.items() if k}
                    for k in keys:
                        if k in clean_row: return clean_row[k].strip()
                    return ""

                with transaction.atomic():
                    for row_num, row in enumerate(reader, start=2):
                        name = get_val(row, 'Name')
                        cnic = get_val(row, 'CNIC/B-Form Number').replace('-', '')[:15]
                        sheet_student_id = get_val(row, 'Student ID')
                        spec = get_val(row, 'Select Specialization Course', 'Specialization', 'Course Type')
                        lang = get_val(row, 'Choose Language Course')
                        course_name_csv = spec or lang
                        section_csv = get_val(row, 'Section')

                        # Try CNIC first, then Student ID as fallback
                        student_id_str = mapping.get(cnic) or mapping.get(sheet_student_id)
                        if not student_id_str:
                            skipped += 1
                            continue

                        student_id = uuid.UUID(student_id_str)

                        def get_word_set(text):
                            if not text: return set()
                            return set(re.sub(r'[^a-zA-Z0-9 ]', ' ', text).lower().split())

                        target_course = None
                        csv_words = get_word_set(course_name_csv)
                        
                        if not csv_words:
                            errors += 1
                            continue

                        for c in Course.objects.all():
                            db_words = get_word_set(c.name)
                            # Handle common typos in mapping
                            norm_db_words = {w.replace('begineer', 'beginner') for w in db_words}
                            norm_csv_words = {w.replace('begineer', 'beginner') for w in csv_words}
                            
                            if norm_csv_words.issubset(norm_db_words) or norm_db_words.issubset(norm_csv_words):
                                target_course = c
                                break
                            
                            intersection = norm_csv_words.intersection(norm_db_words)
                            if len(intersection) >= 2 and ('level' in intersection or 'beginner' in intersection or 'advance' in intersection):
                                target_course = c
                                break
                        
                        if not target_course:
                            if errors < 10:
                                self.stdout.write(self.style.WARNING(f"    Missing Course: '{course_name_csv}'"))
                            errors += 1
                            continue

                        # --- NEW: Deposit (DP) Check ---
                        dp_status = get_val(row, 'DP', 'Deposit').upper()
                        if dp_status != 'Y' and not options.get('ignore_dp', False):
                            skipped += 1
                            continue

                        # Get all classes for this course
                        from django.db.models import Count
                        all_classes = list(ScheduledClass.objects.filter(course=target_course).annotate(
                            student_count=Count('enrolled_students')
                        ).order_by('section'))
                        
                        if not all_classes:
                            errors += 1
                            continue

                        # Clean sync: Clear existing enrollments for this specific course on the first row of processing
                        # (This is handled by the 'delete()' call below for each student to ensure one class per course)

                        # Match Section Logic
                        scheduled_class = None
                        if section_csv:
                            # 1. Try to find a class where section ends with the sheet's section number (e.g. sheet Sec 2 -> Timetable Sec 12)
                            # AND it must have space (< 30)
                            scheduled_class = next((c for c in all_classes if (str(c.section) == section_csv or str(c.section).endswith(section_csv)) and c.student_count < 30), None)
                        
                        # 2. Fallback: If no match or class is full, find ANY class for this course with space
                        if not scheduled_class:
                            scheduled_class = next((c for c in all_classes if c.student_count < 30), None)
                        
                        # 3. Final Fallback: If everything is full, just pick the first one (or we could error)
                        if not scheduled_class:
                            scheduled_class = all_classes[0]

                        # Create Enrollment
                        if not dry_run:
                            # Ensure student is only in ONE section of this course
                            CourseRegistrationHistory.objects.filter(
                                student_id=student_id, 
                                course=target_course
                            ).delete()

                            CourseRegistrationHistory.objects.create(
                                student_id=student_id,
                                course=target_course,
                                scheduled_class=scheduled_class,
                                status='enrolled'
                            )
                            enrolled += 1
                        else:
                            enrolled += 1

                self.stdout.write(self.style.SUCCESS(f"SUMMARY: Enrolled: {enrolled} | Skipped: {skipped} | Errors: {errors}"))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error: {str(e)}"))
