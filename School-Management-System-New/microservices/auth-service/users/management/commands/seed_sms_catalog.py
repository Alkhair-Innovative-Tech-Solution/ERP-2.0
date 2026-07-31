"""
Seed RolePermission rows from the catalog (users/sms_catalog.py). Idempotent
— safe to re-run. This is now the only seed command for SMS role
permissions — the old seed_permissions.py / DEFAULT_PERMISSIONS dict it
replaced (Increment 3a) was deleted once the catalog was proven
byte-for-byte equivalent; see docs/INCREMENT_3A_SMS_ROLES_RESULT.md for the
before/after diff proof.
"""
from django.core.management.base import BaseCommand

from users.sms_catalog import seed_sms_permissions, seed_sms_role_templates


class Command(BaseCommand):
    help = (
        "Seed SMS's namespaced permission catalog (sms.<module>.<action>) into "
        "RolePermission, via legacy_codename."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Reset existing rows to match the catalog exactly (WARNING: overwrites existing toggles).',
        )

    def handle(self, *args, **options):
        reset = options.get('reset', False)

        _, total_perms = seed_sms_permissions()
        self.stdout.write(f"Catalog permissions declared: {total_perms}")

        created, updated, skipped = seed_sms_role_templates(reset=reset)
        self.stdout.write(
            f"RolePermission rows — Created: {created}, Reset: {updated}, Skipped (already exists): {skipped}"
        )

        self.stdout.write(self.style.SUCCESS("Done."))
