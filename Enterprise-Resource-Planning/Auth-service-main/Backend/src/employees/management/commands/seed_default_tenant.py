"""
Seed a single Tenant (the paying-customer root) — idempotent, additive only.

Increment 4a: the Tenant model, Organization.tenant (nullable FK), and
Subscription.tenant already existed (built in Increment 0 for VMS). This
command is the one genuinely new piece: a generic, reusable way to create
a Tenant and (only if explicitly asked) attach an existing Organization to
it — so a later increment (e.g. SMS's org) can do that linkage in one line
instead of writing bespoke seed code each time, the way seed_vms_increment0
did inline for VMS specifically.

Does NOT attach anything automatically. Does NOT touch any existing
Organization unless --attach-org is passed. Does NOT backfill.

Usage:
    python manage.py seed_default_tenant --tenant-code SMS --name "SMS Tenant"
    python manage.py seed_default_tenant --tenant-code SMS --name "SMS Tenant" --attach-org SMSORG
"""
from django.core.management.base import BaseCommand, CommandError

from employees.models import Organization, Tenant


class Command(BaseCommand):
    help = "Idempotently create one Tenant, optionally attaching a named existing Organization to it."

    def add_arguments(self, parser):
        parser.add_argument('--tenant-code', required=True, help="Short unique code for the tenant (e.g. 'SMS').")
        parser.add_argument('--name', required=True, help="Tenant / customer display name.")
        parser.add_argument(
            '--attach-org',
            metavar='ORG_CODE',
            help="Optional: org_code of an existing Organization to attach to this tenant. "
                 "Refuses to overwrite an Organization that already has a DIFFERENT tenant set.",
        )

    def handle(self, *args, **options):
        tenant_code = options['tenant_code']
        name = options['name']
        attach_org_code = options.get('attach_org')

        tenant, created = Tenant.objects.get_or_create(
            tenant_code=tenant_code,
            defaults={'name': name, 'is_active': True},
        )
        self.stdout.write(f"  {'Created' if created else 'Exists'}: Tenant {tenant.tenant_code} ({tenant.name})")

        if not attach_org_code:
            self.stdout.write(self.style.SUCCESS(f"\nDone. Tenant id={tenant.id}"))
            return

        try:
            org = Organization.objects.get(org_code=attach_org_code)
        except Organization.DoesNotExist:
            raise CommandError(f"Organization with org_code='{attach_org_code}' not found — nothing attached.")

        if org.tenant_id and org.tenant_id != tenant.id:
            raise CommandError(
                f"Organization '{org.org_code}' already has a different tenant "
                f"({org.tenant.tenant_code}) — refusing to overwrite. Detach it manually first if this is intentional."
            )

        if org.tenant_id == tenant.id:
            self.stdout.write(f"  Exists: Organization {org.org_code} already attached to {tenant.tenant_code}")
        else:
            org.tenant = tenant
            org.save(update_fields=['tenant'])
            self.stdout.write(f"  Attached: Organization {org.org_code} -> Tenant {tenant.tenant_code}")

        self.stdout.write(self.style.SUCCESS(f"\nDone. Tenant id={tenant.id}"))
