from django.core.management.base import BaseCommand
from courses.models import CourseRegistrationHistory
import requests
import os

class Command(BaseCommand):
    help = 'Generate certificates for all completed enrollments'

    def handle(self, *args, **kwargs):
        completed = CourseRegistrationHistory.objects.filter(
            status='completed'
        )
        count = completed.count()
        self.stdout.write(f"Found {count} completed enrollments")
        
        if count == 0:
            self.stdout.write(self.style.WARNING("No completed enrollments found. Mark some enrollments as completed first."))
            return
        
        cert_svc = os.environ.get('CERTIFICATION_SERVICE_URL', 'http://certification-service:8004')
        webhook_url = f"{cert_svc}/api/certifications/webhook/completion/"
        
        success = 0
        failed = 0
        skipped = 0
        
        for enrollment in completed:
            try:
                resp = requests.post(webhook_url, json={
                    'student_id': str(enrollment.student_id),
                    'course_id': str(enrollment.course_id),
                    'enrollment_id': str(enrollment.id),
                }, timeout=10)
                if resp.status_code in (200, 201):
                    success += 1
                    self.stdout.write(self.style.SUCCESS(f"  Certificate generated for {enrollment.student_id} - {enrollment.course.name}"))
                elif resp.status_code == 409:
                    skipped += 1
                    self.stdout.write(self.style.WARNING(f"  Certificate already exists for {enrollment.student_id} - {enrollment.course.name}"))
                else:
                    failed += 1
                    self.stdout.write(self.style.ERROR(f"  Failed for {enrollment.student_id}: {resp.text}"))
            except Exception as e:
                failed += 1
                self.stdout.write(self.style.ERROR(f"  Error for {enrollment.student_id}: {str(e)}"))
        
        self.stdout.write(f"\n{'='*60}")
        self.stdout.write(self.style.SUCCESS(f"Generated: {success}"))
        self.stdout.write(self.style.WARNING(f"Skipped (already exists): {skipped}"))
        self.stdout.write(self.style.ERROR(f"Failed: {failed}"))
        self.stdout.write(f"{'='*60}")
