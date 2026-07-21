import csv
from django.core.management.base import BaseCommand
from tests.models import EntranceLead

class Command(BaseCommand):
    help = 'Imports Test Scores and Deposit Status for Entrance Leads from a CSV.'

    def add_arguments(self, parser):
        parser.add_argument('--csv', type=str, required=True, help='Path to the CSV file')

    def handle(self, *args, **options):
        csv_file = options['csv']
        self.stdout.write(f"Importing evaluations from {csv_file}...")

        updated_count = 0
        try:
            with open(csv_file, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    lead_id = row.get('Lead ID')
                    deposit = row.get('Deposit Paid (Y/N)', '').strip().upper()
                    score_str = row.get('Test Score', '').strip()
                    
                    if not lead_id:
                        continue
                        
                    try:
                        lead = EntranceLead.objects.get(lead_auto_id=int(lead_id))
                    except (EntranceLead.DoesNotExist, ValueError):
                        self.stdout.write(self.style.WARNING(f"Lead ID {lead_id} not found."))
                        continue
                    
                    lead.has_paid_deposit = (deposit == 'Y')
                    
                    if score_str and score_str.isdigit():
                        lead.test_score = int(score_str)
                        
                    # Auto-evaluate status
                    # Pass condition: CIT/Language course OR score >= 18
                    course_name = lead.course_name_requested.lower() if lead.course_name_requested else ""
                    is_cit_lang = "cit" in course_name or "language" in course_name
                    
                    score_passed = lead.test_score is not None and lead.test_score >= 18
                    
                    if lead.has_paid_deposit and (is_cit_lang or score_passed):
                        lead.status = "passed" # Ready to be enrolled
                    elif not lead.has_paid_deposit:
                        lead.status = "pending_deposit"
                    else:
                        lead.status = "failed"
                        
                    lead.save()
                    updated_count += 1
                    
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error reading CSV: {str(e)}"))
            return

        self.stdout.write(self.style.SUCCESS(f"Finished evaluating {updated_count} leads."))
