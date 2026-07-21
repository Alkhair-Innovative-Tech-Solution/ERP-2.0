from django.core.management.base import BaseCommand
from django.db import transaction
from courses.models import CourseRegistrationHistory, ScheduledClass


class Command(BaseCommand):
    help = 'Sync enrollment lifecycle statuses based on ScheduledClass.status'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Show changes without applying')

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        class_status_map = {
            'completed': 'completed',
            'active': 'enrolled',
            'upcoming': 'enrolled',
        }

        results = {}

        for class_status, target_enrollment_status in class_status_map.items():
            qs = CourseRegistrationHistory.objects.filter(
                scheduled_class__status=class_status
            ).exclude(status=target_enrollment_status)

            count = qs.count()
            results[class_status] = {'target': target_enrollment_status, 'count': count}

            if count > 0:
                self.stdout.write(
                    f"{class_status}: {count} enrollments will change to '{target_enrollment_status}'"
                )
                if not dry_run:
                    qs.update(status=target_enrollment_status)
                    self.stdout.write(self.style.SUCCESS(f"  -> Updated {count} enrollments"))

        total = sum(r['count'] for r in results.values())
        if dry_run:
            self.stdout.write(self.style.WARNING(f"DRY RUN: {total} enrollments would be updated"))
        else:
            self.stdout.write(self.style.SUCCESS(f"Updated {total} enrollments"))
