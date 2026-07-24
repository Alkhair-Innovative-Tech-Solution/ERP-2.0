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

                # Sync to auth-service
                try:
                    import os, requests as http_requests
                    auth_url = os.environ.get('AUTH_SERVICE_URL', 'http://auth-service:8001')
                    secret = os.environ.get('INTERNAL_SERVICE_SECRET', '')
                    http_requests.post(
                        f'{auth_url}/api/internal/sync-org/',
                        json={'id': org.id, 'payment_status': 'overdue'},
                        headers={'X-Internal-Secret': secret},
                        timeout=5,
                    )
                except Exception as e:
                    self.stderr.write(f'[WARN] Auth sync failed for org {org.id}: {e}')

                blocked += 1
                self.stdout.write(f'  Blocked {org.name} (invoice {invoice.invoice_number})')

        self.stdout.write(self.style.SUCCESS(f'Done. {blocked} org(s) suspended.'))
