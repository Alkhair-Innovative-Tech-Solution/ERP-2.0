"""
Backfill auth-service login accounts for students that are missing them.

Bulk upload creates accounts via auth-service's /api/internal/create-user/
endpoint; if those calls failed (e.g. rate-limited), students end up without
a login. This command retries the same call for every student with a
student_id. The endpoint returns 409 for users that already exist, so it is
safe to re-run any number of times.

Usage:
    python manage.py backfill_student_auth_accounts
    python manage.py backfill_student_auth_accounts --dry-run
"""

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create auth-service login accounts (via internal API) for students missing them."

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true',
                            help='List students that would be processed, without calling auth-service.')

    def handle(self, *args, **options):
        from students.models import Student
        from students.services.student_csv_import import _ensure_student_user_account

        dry_run = options['dry_run']

        # _base_manager: no request user in a management command, so the
        # org-scoped default manager would return an empty queryset.
        students = (
            Student._base_manager
            .filter(is_deleted=False, student_id__isnull=False)
            .exclude(student_id='')
            .select_related('campus', 'organization')
        )
        total = students.count()
        self.stdout.write(f'Found {total} students with a student_id.\n')

        done = 0
        for student in students.iterator():
            if dry_run:
                self.stdout.write(f'  [WOULD SYNC] {student.student_id} — {student.name}')
            else:
                # Prints its own error line on failure; 200/201/409 are all fine.
                _ensure_student_user_account(student)
            done += 1
            if done % 100 == 0:
                self.stdout.write(f'  ... {done}/{total}')

        self.stdout.write(self.style.SUCCESS(f'\nProcessed {done} students. '
                                             'Check output above for any auth-service errors.'))
