from django.core.management.base import BaseCommand

from permissions.vms_catalog import seed_vms_permissions, seed_vms_role_templates


class Command(BaseCommand):
    help = "Seed VMS's namespaced permissions (vms.<module>.<action>) and default role templates. Idempotent."

    def handle(self, *args, **options):
        created, total = seed_vms_permissions()
        self.stdout.write(f"Permissions: {created} new, {total - created} already existed (of {total}).")

        created_roles = seed_vms_role_templates()
        self.stdout.write(f"Role templates: {created_roles} new.")

        self.stdout.write(self.style.SUCCESS("Done."))
