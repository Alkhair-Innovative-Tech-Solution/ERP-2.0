"""
Seed data for HDMS Increment 2a (auth-service side).

Reuses the VMST tenant/org/institution/branch created by
seed_vms_increment0 (a tenant can hold subscriptions to multiple services —
this proves that, rather than inventing a second tenant for no reason).
Creates: an active `hdms` Subscription for that tenant, a new HDMS
department/designation, one HDMS test employee with hdms ServiceAccess +
a catalog-driven tenant role (see permissions.hdms_catalog), and prints
login credentials.

Idempotent — safe to re-run (get_or_create everywhere). Depends on
seed_vms_increment0 having run first (needs the VMST tenant/org/branch to
exist) — run that first if this errors with "VMST org not found".
"""
from datetime import date

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from authentication.models import UserCredentials
from employees.models import Branch, Department, Designation, Employee, EmployeeAssignment, Organization
from permissions.models import Service, ServiceAccess, Subscription
from permissions.hdms_catalog import assign_employee_hdms_role, seed_hdms_permissions, seed_hdms_role_templates

HDMS_EMPLOYEE_CNIC = "42101-8888888-0"
HDMS_EMPLOYEE_PASSWORD = "HdmsUser@123"


class Command(BaseCommand):
    help = "Seed HDMS Increment 2a test data: hdms Subscription + test employee with an HDMS catalog role. Idempotent."

    @transaction.atomic
    def handle(self, *args, **options):
        org_ctx = self._get_vmst_org()
        self._seed_subscription(org_ctx["tenant"])
        dept_ctx = self._seed_hdms_dept(org_ctx)
        employee = self._seed_hdms_employee(org_ctx, dept_ctx)
        self._seed_hdms_access(employee)
        self._seed_catalog_role(org_ctx["tenant"], employee)

        self.stdout.write(self.style.SUCCESS("\nDone. Increment 2a HDMS seed data ready."))
        self.stdout.write(
            f"  HDMS test user login: code={employee.employee_code} password={HDMS_EMPLOYEE_PASSWORD}"
        )
        self.stdout.write(f"  Employee id={employee.id}  Tenant={org_ctx['tenant'].tenant_code}")

    def _get_vmst_org(self):
        try:
            org = Organization.objects.get(org_code="VMST")
        except Organization.DoesNotExist:
            raise CommandError(
                "VMST org not found — run `python manage.py seed_vms_increment0` first "
                "(this command reuses the tenant/org it creates)."
            )
        branch = Branch.objects.get(branch_code="VMST-B1")
        return {"tenant": org.tenant, "org": org, "branch": branch}

    def _seed_subscription(self, tenant):
        try:
            hdms_service = Service.objects.get(code="hdms", is_active=True)
        except Service.DoesNotExist:
            self.stdout.write(self.style.WARNING("  Service 'hdms' not found/active — skipping Subscription."))
            return

        subscription, created = Subscription.objects.get_or_create(
            tenant=tenant,
            service=hdms_service,
            defaults={"status": "active"},
        )
        if not created and subscription.status != "active":
            subscription.status = "active"
            subscription.save(update_fields=["status"])
        self.stdout.write(f"  {'Created' if created else 'Exists'}: Subscription {tenant.tenant_code} -> hdms ({subscription.status})")

    def _seed_hdms_dept(self, org_ctx):
        department, created = Department.objects.get_or_create(
            branch=org_ctx["branch"],
            dept_code="HDMS",
            defaults={"dept_name": "HDMS Help Desk"},
        )
        self.stdout.write(f"  {'Created' if created else 'Exists'}: Department {department.dept_code}")

        designation, created = Designation.objects.get_or_create(
            department=department,
            position_code="H",
            defaults={"position_name": "HDMS Assignee"},
        )
        self.stdout.write(f"  {'Created' if created else 'Exists'}: Designation {designation.position_name}")

        return {"department": department, "designation": designation}

    def _seed_hdms_employee(self, org_ctx, dept_ctx):
        employee, created = Employee.objects.get_or_create(
            cnic=HDMS_EMPLOYEE_CNIC,
            defaults={
                "organization": org_ctx["org"],
                "full_name": "Increment2a HDMS TestUser",
                "dob": date(1995, 1, 1),
                "gender": "other",
            },
        )
        self.stdout.write(f"  {'Created' if created else 'Exists'}: Employee {employee.full_name}")

        if employee.tenant_id != org_ctx["tenant"].id:
            employee.tenant = org_ctx["tenant"]
            employee.save(update_fields=["tenant"])

        EmployeeAssignment.objects.get_or_create(
            employee=employee,
            department=dept_ctx["department"],
            designation=dept_ctx["designation"],
            defaults={"joining_date": date.today(), "is_primary": True},
        )
        employee.refresh_from_db()

        creds, cred_created = UserCredentials.objects.get_or_create(employee=employee)
        if cred_created or not creds.check_password(HDMS_EMPLOYEE_PASSWORD):
            creds.set_password(HDMS_EMPLOYEE_PASSWORD)
            creds.save()

        return employee

    def _seed_hdms_access(self, employee):
        if not Service.objects.filter(code="hdms", is_active=True).exists():
            self.stdout.write(self.style.WARNING("  Service 'hdms' not found/active — skipping ServiceAccess."))
            return

        if not Subscription.tenant_has_active(employee.tenant_id, "hdms"):
            self.stdout.write(self.style.WARNING(
                f"  Tenant {employee.tenant_id} has no active hdms Subscription — skipping ServiceAccess."
            ))
            return

        service_access, created = ServiceAccess.objects.get_or_create(
            employee=employee,
            service="hdms",
            defaults={"is_active": True},
        )
        self.stdout.write(f"  {'Created' if created else 'Exists'}: ServiceAccess hdms for {employee.employee_code}")

    def _seed_catalog_role(self, tenant, employee):
        """Seed HDMS catalog (permissions + templates), then assign the
        catalog-driven 'assignee' role to the test employee for this tenant.
        """
        created_perms, total_perms = seed_hdms_permissions()
        self.stdout.write(f"  Catalog permissions: {created_perms} new / {total_perms} total")

        created_templates = seed_hdms_role_templates()
        self.stdout.write(f"  Catalog role templates: {created_templates} new")

        assign_employee_hdms_role(employee, "assignee", tenant=tenant)
        self.stdout.write(f"  EmployeeRole: {employee.employee_code} -> HDMS Assignee ({tenant.tenant_code})")
