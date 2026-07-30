from django.core.management.base import BaseCommand

from permissions.hdms_catalog import seed_hdms_permissions, seed_hdms_role_templates


class Command(BaseCommand):
    help = "Seed HDMS's namespaced permissions (hdms.<module>.<action>) and default role templates. Idempotent."

    def handle(self, *args, **options):
        created, total = seed_hdms_permissions()
        self.stdout.write(f"Permissions: {created} new, {total - created} already existed (of {total}).")

        created_roles = seed_hdms_role_templates()
        self.stdout.write(f"Role templates: {created_roles} new.")

        self.stdout.write(self.style.SUCCESS("Done."))
