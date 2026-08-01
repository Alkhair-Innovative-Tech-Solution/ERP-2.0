"""
Seed a single Tenant (the paying-customer root) — idempotent, additive only.

Increment 4a: the Tenant model, Organization.tenant (nullable FK), and
Subscription.tenant already existed (built in Increment 0 for VMS). This
command is the one genuinely new piece: a generic, reusable way to create
a Tenant, an Organization under it, and a service Subscription for it — so
a later increment (e.g. SMS's) can do that linkage in one line instead of
writing bespoke seed code each time, the way seed_vms_increment0 did
inline for VMS specifically.

Increment 4b extended this with --create-org / --subscribe: registering a
product whose own Organization lives in a database central auth can't
reach (SMS has its own separate `auth_db`) means there's no existing
central-auth Organization row to --attach-org to — a brand new one has to
be created here instead.

Does nothing automatically. Does NOT touch any existing Organization
unless --attach-org (or --create-org, which only ever creates, never
touches an existing row under a different code) is passed. Does NOT
backfill.

Usage:
    python manage.py seed_default_tenant --tenant-code SMS --name "SMS Tenant"
    python manage.py seed_default_tenant --tenant-code SMS --name "SMS Tenant" --attach-org SMSORG
    python manage.py seed_default_tenant --tenant-code SMS01 --name "SMS School" \\
        --create-org SMS01 --org-name "SMS School" \\
        --subscribe sms --service-name "School Management System"
"""
from django.core.management.base import BaseCommand, CommandError

from employees.models import Organization, Tenant
from permissions.models import Service, Subscription


class Command(BaseCommand):
    help = (
        "Idempotently create one Tenant, optionally attach an existing Organization "
        "(--attach-org) or create a new one (--create-org), and optionally subscribe "
        "the tenant to a service (--subscribe)."
    )

    def add_arguments(self, parser):
        parser.add_argument('--tenant-code', required=True, help="Short unique code for the tenant (e.g. 'SMS01').")
        parser.add_argument('--name', required=True, help="Tenant / customer display name.")
        parser.add_argument(
            '--attach-org',
            metavar='ORG_CODE',
            help="Optional: org_code of an EXISTING Organization (in central auth's own DB) to attach to "
                 "this tenant. Refuses to overwrite an Organization that already has a DIFFERENT tenant set. "
                 "Mutually exclusive with --create-org.",
        )
        parser.add_argument(
            '--create-org',
            metavar='ORG_CODE',
            help="Optional: create a NEW Organization with this org_code under the tenant — for registering "
                 "a product whose real Organization lives in a separate database central auth can't reach "
                 "(e.g. SMS). Idempotent: if an Organization with this org_code already exists, it's reused "
                 "(and must already belong to this tenant, or refused, same as --attach-org). "
                 "Mutually exclusive with --attach-org.",
        )
        parser.add_argument('--org-name', help="Display name for --create-org (required if --create-org is passed).")
        parser.add_argument(
            '--subscribe',
            metavar='SERVICE_CODE',
            help="Optional: service code to give this tenant an active Subscription for (e.g. 'sms'). "
                 "Creates the Service catalog entry too if it doesn't exist yet (just the registry row — "
                 "not a full permission catalog).",
        )
        parser.add_argument('--service-name', help="Display name for --subscribe's Service if it needs creating.")

    def handle(self, *args, **options):
        tenant_code = options['tenant_code']
        name = options['name']
        attach_org_code = options.get('attach_org')
        create_org_code = options.get('create_org')
        org_name = options.get('org_name')
        subscribe_service_code = options.get('subscribe')
        service_name = options.get('service_name')

        if attach_org_code and create_org_code:
            raise CommandError("--attach-org and --create-org are mutually exclusive.")
        if create_org_code and not org_name:
            raise CommandError("--create-org requires --org-name.")
        if subscribe_service_code and not service_name:
            # Only required when the Service doesn't exist yet — checked below where we know that.
            pass

        tenant, created = Tenant.objects.get_or_create(
            tenant_code=tenant_code,
            defaults={'name': name, 'is_active': True},
        )
        self.stdout.write(f"  {'Created' if created else 'Exists'}: Tenant {tenant.tenant_code} ({tenant.name})")

        if attach_org_code:
            self._attach_existing_org(tenant, attach_org_code)
        elif create_org_code:
            self._create_new_org(tenant, create_org_code, org_name)

        if subscribe_service_code:
            self._subscribe(tenant, subscribe_service_code, service_name)

        self.stdout.write(self.style.SUCCESS(f"\nDone. Tenant id={tenant.id}"))

    def _attach_existing_org(self, tenant, org_code):
        try:
            org = Organization.objects.get(org_code=org_code)
        except Organization.DoesNotExist:
            raise CommandError(f"Organization with org_code='{org_code}' not found — nothing attached.")

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

    def _create_new_org(self, tenant, org_code, org_name):
        org = Organization.objects.filter(org_code=org_code).first()
        if org is not None:
            if org.tenant_id and org.tenant_id != tenant.id:
                raise CommandError(
                    f"Organization '{org.org_code}' already exists under a different tenant "
                    f"({org.tenant.tenant_code}) — refusing to reassign it."
                )
            self.stdout.write(f"  Exists: Organization {org.org_code} (tenant={tenant.tenant_code})")
            return

        Organization.objects.create(org_code=org_code, name=org_name, tenant=tenant)
        self.stdout.write(f"  Created: Organization {org_code} ({org_name}) -> Tenant {tenant.tenant_code}")

    def _subscribe(self, tenant, service_code, service_name):
        service = Service.objects.filter(code=service_code).first()
        if service is None:
            if not service_name:
                raise CommandError(
                    f"Service '{service_code}' does not exist yet — pass --service-name to create it."
                )
            service = Service.objects.create(code=service_code, name=service_name, is_active=True)
            self.stdout.write(f"  Created: Service {service.code} ({service.name})")
        else:
            self.stdout.write(f"  Exists: Service {service.code} ({service.name})")

        subscription, created = Subscription.objects.get_or_create(
            tenant=tenant,
            service=service,
            defaults={'status': 'active'},
        )
        if not created and subscription.status != 'active':
            subscription.status = 'active'
            subscription.save(update_fields=['status'])
        self.stdout.write(
            f"  {'Created' if created else 'Exists'}: Subscription {tenant.tenant_code} -> {service.code} ({subscription.status})"
        )
