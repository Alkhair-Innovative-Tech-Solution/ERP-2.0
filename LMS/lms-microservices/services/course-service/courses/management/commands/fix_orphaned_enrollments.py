import requests
from django.core.management.base import BaseCommand
from django.db import transaction
from courses.models import CourseRegistrationHistory
from django.conf import settings


class Command(BaseCommand):
    help = 'Find and fix orphaned enrollment student_ids that don\'t exist in auth-service'

    def add_arguments(self, parser):
        parser.add_argument('--fix', action='store_true', help='Create stub student records for missing UUIDs')
        parser.add_argument('--dry-run', action='store_true', help='Report only, no changes')

    def handle(self, *args, **options):
        fix = options['fix']
        dry_run = options['dry_run']

        all_ids = list(CourseRegistrationHistory.objects.values_list('student_id', flat=True))
        unique_ids = list(set(str(uid) for uid in all_ids))
        self.stdout.write(f'Total enrollments: {len(all_ids)}')
        self.stdout.write(f'Unique student_ids: {len(unique_ids)}')

        auth_url = 'http://auth-service:8001/api/auth/users/bulk/'
        try:
            resp = requests.post(auth_url, json={'ids': unique_ids}, timeout=15)
        except requests.exceptions.RequestException as e:
            self.stdout.write(self.style.ERROR(f'Cannot reach auth-service: {e}'))
            return

        if resp.status_code != 200:
            self.stdout.write(self.style.ERROR(f'Auth API error: {resp.status_code} {resp.text[:300]}'))
            return

        found = resp.json()
        found_ids = {u['id'] for u in found}
        missing = [sid for sid in unique_ids if sid not in found_ids]

        self.stdout.write(f'Users found in auth: {len(found_ids)}')
        self.stdout.write(self.style.WARNING(f'Orphaned student_ids: {len(missing)}'))

        if not missing:
            self.stdout.write(self.style.SUCCESS('No orphaned enrollments. All student IDs exist in auth-service.'))
            return

        if missing:
            self.stdout.write('Sample orphaned UUIDs:')
            for sid in missing[:10]:
                enrollments = CourseRegistrationHistory.objects.filter(student_id=sid)[:3]
                for e in enrollments:
                    ref = e.reference_number or 'N/A'
                    course_name = e.course.name if e.course else 'N/A'
                    self.stdout.write(f'  student_id={sid}, ref={ref}, course={course_name}')

        if not fix:
            self.stdout.write(self.style.WARNING('Run with --fix to create stub records for missing students'))
            return

        if dry_run:
            self.stdout.write(self.style.WARNING(f'DRY RUN: Would create {len(missing)} stub student records'))
            return

        created = 0
        failed = 0
        for sid in missing:
            try:
                enrollments = CourseRegistrationHistory.objects.filter(student_id=sid)
                ref = enrollments.first().reference_number or ''
                course = enrollments.first().course

                placeholder_email = f"orphan.{sid[:8]}@recover.ait.iak.ngo"
                payload = {
                    "email": placeholder_email,
                    "full_name": f"Student ({ref or sid[:12]})",
                    "phone": f"+92300{sid[:7].replace('-', '0')}",
                    "cnic": f"{sid[:5]}-{sid[5:12]}-{sid[12] if len(sid) > 12 else '1'}",
                    "role": "student",
                    "student_id": ref or sid[:12],
                }

                admin_token = getattr(settings, 'AUTH_SERVICE_ADMIN_TOKEN', None)
                headers = {'Authorization': f'Bearer {admin_token}'} if admin_token else {}

                create_resp = requests.post(
                    'http://auth-service:8001/api/auth/coordinator/users/',
                    json=payload,
                    headers=headers,
                    timeout=10
                )

                if create_resp.status_code in (200, 201):
                    created += 1
                    self.stdout.write(f'  Created stub for {sid[:12]}...')
                else:
                    failed += 1
                    self.stdout.write(self.style.ERROR(f'  Failed {sid[:12]}...: {create_resp.status_code} {create_resp.text[:100]}'))
            except Exception as e:
                failed += 1
                self.stdout.write(self.style.ERROR(f'  Error {sid[:12]}...: {e}'))

        self.stdout.write(self.style.SUCCESS(f'Created {created} stub records, {failed} failed'))
