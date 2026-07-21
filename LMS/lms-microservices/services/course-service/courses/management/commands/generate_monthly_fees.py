from django.core.management.base import BaseCommand
from courses.models import FeeStructure, CourseRegistrationHistory
from courses.fee_utils import generate_fee_record, next_month
from django.utils import timezone

class Command(BaseCommand):
    help = 'Generate monthly fee records for all eligible students'

    def add_arguments(self, parser):
        parser.add_argument('--month', type=str, help='Target month in YYYY-MM format')

    def handle(self, *args, **kwargs):
        target_month_str = kwargs.get('month')
        if target_month_str:
            year, month = map(int, target_month_str.split('-'))
            fee_month = timezone.now().replace(year=year, month=month, day=1).date()
        else:
            fee_month = timezone.now().replace(day=1).date()

        upper_bound = next_month(fee_month)

        self.stdout.write(f"\n{'='*60}")
        self.stdout.write(f"Generating fee records for: {fee_month.strftime('%%B %%Y')}")
        self.stdout.write(f"{'='*60}\n")

        active_fees = FeeStructure.objects.filter(
            is_active=True,
            effective_from__lte=upper_bound,
        ).exclude(effective_to__lt=fee_month)

        created_count = 0
        skipped_count = 0

        for fee in active_fees:
            self.stdout.write(f"\n  Processing: {fee.course.name}")
            if fee.scheduled_class:
                self.stdout.write(f"    Section: {fee.scheduled_class.section}")
            self.stdout.write(f"    Plan: {fee.payment_plan} | Amount: PKR {fee.monthly_maintenance_fee}")

            if fee.scope == 'scheduled_class' and fee.scheduled_class:
                enrollments = CourseRegistrationHistory.objects.filter(
                    course=fee.course,
                    scheduled_class=fee.scheduled_class,
                    status='enrolled',
                )
            else:
                enrollments = CourseRegistrationHistory.objects.filter(
                    course=fee.course,
                    status='enrolled',
                )

            for enrollment in enrollments:
                result = generate_fee_record(fee, enrollment, fee_month)
                if result == 'created':
                    created_count += 1
                else:
                    skipped_count += 1

        self.stdout.write(f"\n{'='*60}")
        self.stdout.write(self.style.SUCCESS(f"Created: {created_count} fee records"))
        self.stdout.write(self.style.WARNING(f"Skipped: {skipped_count}"))
        self.stdout.write(f"{'='*60}\n")
