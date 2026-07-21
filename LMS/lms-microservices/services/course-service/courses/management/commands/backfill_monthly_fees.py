"""
backfill_monthly_fees.py
─────────────────────────────────────────────────────────────────────
One-off backfill: since 2026-07-01, a flat PKR 1000/month maintenance fee
applies to every currently-running course. Students bulk-seeded from the
master sheet (via ingest_enrollments.py) were already enrolled before this
policy existed in the system, so this generates the StudentFeeRecord rows
they should have accrued from 2026-07-01 (or their section's start date if
later) through the current month, capped at their section/course end date.

Ensures a course-scope FeeStructure (1000/month, effective 2026-07-01)
exists for every course with a currently-enrolled student; does not
touch/override an existing course-scope FeeStructure if one is already
configured (e.g. a custom amount set by an admin).

Safe to re-run: relies on the same StudentFeeRecord
(student_id, course, scheduled_class, fee_month) uniqueness used by
generate_monthly_fees.py.

Run: docker exec course-service python manage.py backfill_monthly_fees
"""
from datetime import date

from django.core.management.base import BaseCommand
from django.utils import timezone

from courses.models import Course, FeeStructure, CourseRegistrationHistory
from courses.fee_utils import generate_fee_record, next_month, resolve_course_start, resolve_course_end

POLICY_START = date(2026, 7, 1)
DEFAULT_MONTHLY_FEE = 1000


class Command(BaseCommand):
    help = 'Back-fill monthly fee records (PKR 1000/month) for currently-enrolled students since 2026-07-01'

    def handle(self, *args, **kwargs):
        current_month = timezone.now().replace(day=1).date()

        course_ids = CourseRegistrationHistory.objects.filter(
            status='enrolled'
        ).values_list('course_id', flat=True).distinct()
        courses = Course.objects.filter(id__in=course_ids)

        fee_created = 0
        fee_reused = 0
        for course in courses:
            existing = FeeStructure.objects.filter(course=course, scope='course', is_active=True).first()
            if existing:
                fee_reused += 1
                continue
            FeeStructure.objects.create(
                course=course, scope='course', scheduled_class=None,
                monthly_maintenance_fee=DEFAULT_MONTHLY_FEE,
                payment_plan='monthly',
                effective_from=POLICY_START,
                is_active=True,
            )
            fee_created += 1

        self.stdout.write(f"Fee structures: {fee_created} created, {fee_reused} already existed.\n")

        records_created = 0
        records_skipped = 0

        for course in courses:
            fee = FeeStructure.objects.filter(course=course, scope='course', is_active=True).first()
            if not fee or fee.monthly_maintenance_fee <= 0:
                continue

            enrollments = CourseRegistrationHistory.objects.filter(course=course, status='enrolled')
            for enrollment in enrollments:
                sc = enrollment.scheduled_class
                start = resolve_course_start(course, sc) or POLICY_START
                start = max(start, POLICY_START).replace(day=1)

                end = resolve_course_end(course, sc)
                last_month = min(end.replace(day=1), current_month) if end else current_month

                if start > last_month:
                    continue  # course ended before the policy took effect, or hasn't started yet

                month_cursor = start
                while month_cursor <= last_month:
                    result = generate_fee_record(fee, enrollment, month_cursor)
                    if result == 'created':
                        records_created += 1
                    else:
                        records_skipped += 1
                    month_cursor = next_month(month_cursor)

        self.stdout.write(self.style.SUCCESS(f"Fee records created: {records_created}"))
        self.stdout.write(self.style.WARNING(f"Fee records skipped: {records_skipped}"))
