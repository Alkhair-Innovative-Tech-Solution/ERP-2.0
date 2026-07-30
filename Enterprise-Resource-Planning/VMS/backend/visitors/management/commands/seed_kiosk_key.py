"""
Create (or update) a KioskKey mapping a public QR check-in kiosk to a
tenant. Idempotent — safe to re-run with the same --key.

Usage:
    python manage.py seed_kiosk_key --key main-gate --tenant-id <uuid> --label "Main Gate"
"""
from django.core.management.base import BaseCommand, CommandError

from visitors.models import KioskKey


class Command(BaseCommand):
    help = "Create or update a KioskKey mapping a public kiosk to a tenant."

    def add_arguments(self, parser):
        parser.add_argument('--key', required=True, help='The kiosk key value the QR page will send.')
        parser.add_argument('--tenant-id', required=True, help='Tenant UUID (from auth-service) this kiosk belongs to.')
        parser.add_argument('--label', default='', help='Human-readable label, e.g. "Main Gate — Idara Al-Khair".')

    def handle(self, *args, **options):
        try:
            kk, created = KioskKey.objects.update_or_create(
                key=options['key'],
                defaults={'tenant_id': options['tenant_id'], 'label': options['label'], 'is_active': True},
            )
        except Exception as exc:
            raise CommandError(str(exc))

        verb = 'Created' if created else 'Updated'
        self.stdout.write(self.style.SUCCESS(f"{verb} KioskKey '{kk.key}' -> tenant {kk.tenant_id}"))
