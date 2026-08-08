"""
Management command: generate monthly recurring invoices.
Run via cron on 1st of each month (or use billing_day on each org's activation_date).

Usage:
    python manage.py generate_recurring_invoices

Cron (1st of every month at 00:05):
    5 0 1 * * docker exec sms_org-service python manage.py generate_recurring_invoices
"""
import calendar
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = 'Generate monthly recurring invoices for active paid organizations.'

    def handle(self, *args, **options):
        from users.models import Organization, Invoice

        now = timezone.now()
        today = now.date()

        active_orgs = Organization.all_objects.filter(
            is_active=True,
            payment_status='paid',
            activation_date__isnull=False,
        )

        created = 0
        for org in active_orgs:
            billing_day = org.activation_date.day

            # Only generate if today is the billing day
            if today.day != billing_day:
                continue

            # Skip if a recurring invoice already exists for this month
            already = Invoice.objects.filter(
                organization=org,
                invoice_type='recurring',
                billing_period_start__year=today.year,
                billing_period_start__month=today.month,
            ).exists()
            if already:
                continue

            # Period: today → last day of month
            last_day = calendar.monthrange(today.year, today.month)[1]
            period_end = today.replace(day=last_day)

            # Due date: 1 day grace for recurring invoices
            due_date = now + timedelta(days=1)

            # Calculate amount
            plan = org.plan
            amount = 0
            if plan:
                amount = (
                    plan.base_price
                    + (org.max_students * plan.price_per_student)
                    + (org.max_users * plan.price_per_user)
                )

            # Invoice number
            prefix = org.code_prefix or str(org.id)
            period_str = today.strftime('%Y%m')
            base = f"INV-{prefix}-{period_str}"
            seq = Invoice.objects.filter(invoice_number__startswith=base).count() + 1
            invoice_number = f"{base}-{seq:03d}"

            invoice = Invoice.objects.create(
                organization=org,
                plan=plan,
                invoice_number=invoice_number,
                invoice_type='recurring',
                amount=amount,
                status='pending',
                due_date=due_date,
                billing_period_start=today,
                billing_period_end=period_end,
            )

            # Set org payment_status=pending (1 day grace — overdue after due_date)
            Organization.all_objects.filter(pk=org.pk).update(payment_status='pending')

            # Phase D-R6: the auth-8001 sync (POST /api/internal/sync-org/)
            # is removed — auth-8001 no longer exists (D-R5). See
            # docs/PHASE_D_R4R6_REMOVAL_RESULT.md.

            # Notify org admin
            try:
                from users.models import User
                from notifications.services import create_notification
                org_admin = User.objects.filter(organization_id=org.id, is_org_admin=True).first()
                if org_admin:
                    create_notification(
                        user_id=org_admin.id,
                        notification_type='invoice_generated',
                        title='New Invoice Generated',
                        message=f'Monthly invoice {invoice.invoice_number} has been generated. Please upload your payment receipt within 1 day.',
                        data={'invoice_id': invoice.id},
                    )
            except Exception as e:
                self.stderr.write(f'[WARN] Notification failed for org {org.id}: {e}')

            created += 1
            self.stdout.write(f'  Created {invoice_number} for {org.name}')

        self.stdout.write(self.style.SUCCESS(f'Done. {created} recurring invoice(s) created.'))
