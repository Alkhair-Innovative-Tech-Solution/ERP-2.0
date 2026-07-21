import json
import uuid
import re
from django.core.management.base import BaseCommand
from django.db import models, transaction
from courses.models import Course, ScheduledClass, CourseRegistrationHistory
from google_sheets_util import get_sheet_data

SPREADSHEET_ID = "17wAlHTw5jyvsEmNXlcnOCJvRZo978zIfH4magwSwkBU"
CLASS_SHEETS = ["CF0", "CF1", "GC1", "LE1", "VE1", "WD1", "DM1", "CS1", "NS1", "DS1", "AI1", "GD1"]

class Command(BaseCommand):
    help = 'Enrolls students directly from class Google Sheets using student_mapping.json'

    def handle(self, *args, **options):
        self.stdout.write("Starting automatic student enrollment from sheets...")
        
        try:
            with open("student_mapping.json", 'r', encoding='utf-8') as f:
                mapping = json.load(f)
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Could not load student_mapping.json: {e}"))
            return

        enrolled = 0
        skipped = 0
        errors = 0

        for sheet_name in CLASS_SHEETS:
            self.stdout.write(f"\nProcessing sheet: {sheet_name}")
            try:
                rows = get_sheet_data(SPREADSHEET_ID, f"{sheet_name}!A1:Z1000")
                for row in rows:
                    student_id_str = row.get('Student ID', '').strip()
                    section_csv = str(row.get('Section', '')).strip()
                    
                    if not student_id_str:
                        continue
                        
                    uuid_str = mapping.get(student_id_str)
                    if not uuid_str:
                        skipped += 1
                        continue
                        
                    student_uuid = uuid.UUID(uuid_str)
                    
                    # Find ScheduledClass
                    # Course code is usually exactly the sheet name, e.g. "CF0"
                    classes_for_course = ScheduledClass.objects.filter(course__course_code=sheet_name)
                    
                    if not classes_for_course.exists():
                        self.stdout.write(self.style.WARNING(f"  Warning: No scheduled classes found for course code {sheet_name}. Searching by name..."))
                        classes_for_course = ScheduledClass.objects.filter(course__name__icontains=sheet_name)
                        
                    if not classes_for_course.exists():
                        errors += 1
                        continue
                        
                    target_class = None
                    if section_csv:
                        # Try precise match if section is provided AND has space < 30
                        target_class = classes_for_course.filter(section=section_csv).annotate(num_enrolled=models.Count('enrolled_students')).filter(num_enrolled__lt=30).first()
                        
                    if not target_class:
                        # NEW BALANCED Logic: Pick the section for this course with the FEWEST students among those with space < 30
                        target_class = classes_for_course.annotate(num_enrolled=models.Count('enrolled_students')).filter(num_enrolled__lt=30).order_by('num_enrolled').first()
                        
                    if not target_class:
                        # Final fallback: Pick the one with the least students regardless of the 30 limit
                        target_class = classes_for_course.annotate(num_enrolled=models.Count('enrolled_students')).order_by('num_enrolled').first()
                        
                    if target_class:
                        try:
                            # Avoid duplicates
                            CourseRegistrationHistory.objects.filter(
                                student_id=student_uuid,
                                course=target_class.course
                            ).delete()
                            
                            CourseRegistrationHistory.objects.create(
                                student_id=student_uuid,
                                course=target_class.course,
                                scheduled_class=target_class,
                                status='enrolled'
                            )
                            enrolled += 1
                        except Exception as e:
                            self.stdout.write(self.style.ERROR(f"  Error enrolling {student_id_str}: {e}"))
                            errors += 1
                    else:
                        errors += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Failed to process sheet {sheet_name}: {e}"))
                
        self.stdout.write(self.style.SUCCESS(f"\nSUMMARY: Enrolled: {enrolled} | Skipped: {skipped} | Errors: {errors}"))
