"""
Mark past-due invoices as overdue and block orgs.
Run every hour via cron:
    0 * * * * docker exec sms_org-service python manage.py mark_overdue_invoices
"""
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = 'Mark overdue invoices and suspend orgs that missed payment.'

    def handle(self, *args, **options):
        from users.models import Invoice, Organization

        now = timezone.now()

        overdue_invoices = Invoice.objects.filter(
            status='pending',
            due_date__lt=now,
        ).select_related('organization')

        blocked = 0
        for invoice in overdue_invoices:
            invoice.status = 'overdue'
            invoice.save(update_fields=['status'])

            org = invoice.organization
            if org.payment_status != 'overdue':
                Organization.all_objects.filter(pk=org.pk).update(payment_status='overdue')

                # Phase D-R6: the auth-8001 sync (POST /api/internal/sync-org/)
                # is removed — auth-8001 no longer exists (D-R5). See
                # docs/PHASE_D_R4R6_REMOVAL_RESULT.md.

                blocked += 1
                self.stdout.write(f'  Blocked {org.name} (invoice {invoice.invoice_number})')

        self.stdout.write(self.style.SUCCESS(f'Done. {blocked} org(s) suspended.'))
