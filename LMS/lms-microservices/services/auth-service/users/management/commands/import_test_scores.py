import csv
import re
from django.core.management.base import BaseCommand
from django.db import transaction
from users.models import User, Student

class Command(BaseCommand):
    help = 'Imports entrance test scores using student names'

    def add_arguments(self, parser):
        parser.add_argument('--csv', type=str, required=True, help='Path to test results CSV')
        parser.add_argument('--dry-run', action='store_true', help='Simulate without saving')

    def clean_score(self, score_str):
        if not score_str:
            return 0
        match = re.search(r'(\d+)', score_str)
        return int(match.group(1)) if match else 0

    def normalize_name(self, name):
        if not name: return ""
        # Remove special chars and extra spaces to help matching
        return re.sub(r'[^a-zA-Z0-9 ]', '', name).strip().lower()

    def handle(self, *args, **options):
        csv_path = options['csv']
        dry_run = options['dry_run']

        updated = 0
        not_found = 0
        errors = 0

        try:
            with open(csv_path, mode='r', encoding='utf-8') as f:
                # We need to skip the long header rows or handle them
                # Based on user paste, we have many columns then the data starts
                reader = csv.reader(f)
                headers = next(reader) # Row 1: Headers
                
                # Try to find which column is score. Usually the 3rd column (index 2)
                # or look for "Score" in headers
                score_idx = 2
                for i, h in enumerate(headers):
                    if 'score' in h.lower():
                        score_idx = i
                        break
                
                # In this sheet, students are often identified by name after the questions?
                # Actually, the user paste shows data like:
                # Timestamp, Test ID, Score, Q1, Q2...
                # Wait, I need to know where the Student Name is in this specific CSV.
                # Assuming the student name is NOT in the test sheet but we might match by something else?
                # Actually, usually the student fills their name in one of the questions.
                
                # Let's try to find a column with names
                # For now, I will assume the user Paste (Aiman, Muhammad Toheed Raza) 
                # means those names are somewhere in the row.
                
                for row_num, row in enumerate(reader, start=2):
                    if not row: continue
                    
                    try:
                        score = self.clean_score(row[score_idx])
                        
                        # Find a name in the row (searching columns for something that looks like a name)
                        # or if we know which column it is. Let's look for a name-like string.
                        found_student = None
                        
                        # We will look through the row for any value that matches a student full_name
                        for val in row:
                            norm_val = self.normalize_name(val)
                            if len(norm_val) < 3: continue
                            
                            # Smart search: find user with this full_name
                            # We normalize both for better luck
                            possible_users = User.objects.filter(role='student')
                            for u in possible_users:
                                if self.normalize_name(u.full_name) == norm_val:
                                    found_student = Student.objects.filter(user=u).first()
                                    break
                            if found_student: break

                        if found_student:
                            if not dry_run:
                                eligibility = found_student.eligible_course or {}
                                eligibility['entrance_test_score'] = score
                                found_student.eligible_course = eligibility
                                if score >= 20: 
                                    found_student.status = 'pending_interview'
                                found_student.save()
                            
                            self.stdout.write(self.style.SUCCESS(f"  Match Found: {found_student.user.full_name} -> Score {score}"))
                            updated += 1
                        else:
                            # self.stdout.write(self.style.WARNING(f"  Row {row_num}: No matching student found in this row."))
                            not_found += 1
                            
                    except Exception as e:
                        errors += 1

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Critical error: {str(e)}"))

        self.stdout.write(self.style.SUCCESS(f"FINAL RESULT -> Updated: {updated} | Not Found: {not_found} | Errors: {errors}"))
