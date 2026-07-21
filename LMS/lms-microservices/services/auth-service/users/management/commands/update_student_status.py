import csv
from django.core.management.base import BaseCommand
from users.models import Student, User

class Command(BaseCommand):
    help = 'Updates student status based on deposit payment from CSV'

    def add_arguments(self, parser):
        parser.add_argument('--csv', type=str, required=True, help='Path to the batch CSV')
        parser.add_argument('--status', type=str, default='enrolled', help='Status to set')

    def handle(self, *args, **options):
        csv_path = options['csv']
        status = options['status']
        updated_count = 0
        not_found_count = 0

        try:
            with open(csv_path, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                headers = [h.strip() for h in (reader.fieldnames or [])]
                
                # Normalize headers map
                h_map = {h.lower(): h for h in headers}
                cnic_col = next((h_map[k] for k in ['cnic', 'cnic/b-form number', 'nic'] if k in h_map), None)
                dp_col = next((h_map[k] for k in ['dp', 'deposit'] if k in h_map), None)

                if not cnic_col or not dp_col:
                    self.stdout.write(self.style.ERROR(f"Missing required columns (CNIC/DP) in {csv_path}"))
                    return

                for row in reader:
                    cnic = row[cnic_col].strip().replace('-', '') if row[cnic_col] else ''
                    dp = row[dp_col].strip().upper() if row[dp_col] else ''

                    if dp == 'Y' and cnic:
                        try:
                            user = User.objects.get(cnic=cnic)
                            student = Student.objects.get(user=user)
                            student.status = status
                            student.receipt_code_verified = True
                            student.save()
                            updated_count += 1
                        except (User.DoesNotExist, Student.DoesNotExist):
                            not_found_count += 1

            self.stdout.write(self.style.SUCCESS(f"Updated {updated_count} students to '{status}'. ({not_found_count} not found in system)"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error: {str(e)}"))
