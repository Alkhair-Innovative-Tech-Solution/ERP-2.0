"""
Seed data for VMS Increment 0 vertical slice.

Creates: one super admin, one test org/institution/branch/department/designation,
one VMS test employee with vms ServiceAccess + a catalog-driven tenant role
(see permissions.vms_catalog), and prints login credentials.

Idempotent — safe to re-run (get_or_create everywhere).
"""
from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction

from authentication.models import UserCredentials
from authentication.superadmin_models import SuperAdmin
from employees.models import (
    Branch,
    Department,
    Designation,
    Employee,
    EmployeeAssignment,
    Institution,
    Organization,
    Tenant,
)
from permissions.models import Service, ServiceAccess, Subscription
from permissions.vms_catalog import assign_employee_vms_role, seed_vms_permissions, seed_vms_role_templates

SUPERADMIN_CODE = "S-26-0001"
SUPERADMIN_PASSWORD = "SuperAdmin@123"

VMS_EMPLOYEE_CNIC = "42101-9999999-0"
VMS_EMPLOYEE_PASSWORD = "VmsUser@123"


class Command(BaseCommand):
    help = "Seed VMS Increment 0 test data: super admin + test tenant employee with VMS access. Idempotent."

    @transaction.atomic
    def handle(self, *args, **options):
        superadmin = self._seed_superadmin()
        org = self._seed_org()
        self._seed_subscription(org["tenant"])
        employee = self._seed_vms_employee(org)
        self._seed_vms_access(employee)
        self._seed_catalog_role(org["tenant"], employee)

        self.stdout.write(self.style.SUCCESS("\nDone. Increment 0 seed data ready."))
        self.stdout.write(f"  SuperAdmin login: code={SUPERADMIN_CODE} password={SUPERADMIN_PASSWORD}")
        self.stdout.write(
            f"  VMS test user login: code={employee.employee_code} password={VMS_EMPLOYEE_PASSWORD}"
        )
        self.stdout.write(f"  SuperAdmin id={superadmin.id}  Employee id={employee.id}")

    def _seed_superadmin(self):
        superadmin, created = SuperAdmin.objects.get_or_create(
            superadmin_code=SUPERADMIN_CODE,
            defaults={
                "full_name": "Increment0 SuperAdmin",
                "email": "superadmin.increment0@iak.ngo",
                "is_active": True,
            },
        )
        self.stdout.write(f"  {'Created' if created else 'Exists'}: SuperAdmin {superadmin.superadmin_code}")

        creds, cred_created = UserCredentials.objects.get_or_create(superadmin=superadmin)
        if cred_created or not creds.check_password(SUPERADMIN_PASSWORD):
            creds.set_password(SUPERADMIN_PASSWORD)
            creds.save()
        return superadmin

    def _seed_org(self):
        tenant, created = Tenant.objects.get_or_create(
            tenant_code="VMST",
            defaults={"name": "VMS Increment0 Test Tenant", "is_active": True},
        )
        self.stdout.write(f"  {'Created' if created else 'Exists'}: Tenant {tenant.tenant_code}")

        org, created = Organization.objects.get_or_create(
            org_code="VMST",
            defaults={"name": "VMS Increment0 Test Org", "tenant": tenant},
        )
        if org.tenant_id != tenant.id:
            org.tenant = tenant
            org.save(update_fields=["tenant"])
        self.stdout.write(f"  {'Created' if created else 'Exists'}: Organization {org.org_code}")

        institution, created = Institution.objects.get_or_create(
            inst_code="VMST01",
            defaults={
                "name": "VMS Increment0 Test Institution",
                "inst_type": "administrative",
                "organization": org,
            },
        )
        self.stdout.write(f"  {'Created' if created else 'Exists'}: Institution {institution.inst_code}")

        branch, created = Branch.objects.get_or_create(
            branch_code="VMST-B1",
            defaults={
                "institution": institution,
                "branch_name": "VMS Increment0 Test Branch",
                "status": "active",
            },
        )
        self.stdout.write(f"  {'Created' if created else 'Exists'}: Branch {branch.branch_code}")

        department, created = Department.objects.get_or_create(
            branch=branch,
            dept_code="VMS",
            defaults={"dept_name": "VMS Front Desk"},
        )
        self.stdout.write(f"  {'Created' if created else 'Exists'}: Department {department.dept_code}")

        designation, created = Designation.objects.get_or_create(
            department=department,
            position_code="V",
            defaults={"position_name": "VMS Receptionist"},
        )
        self.stdout.write(f"  {'Created' if created else 'Exists'}: Designation {designation.position_name}")

        return {"tenant": tenant, "org": org, "department": department, "designation": designation}

    def _seed_subscription(self, tenant):
        try:
            vms_service = Service.objects.get(code="vms", is_active=True)
        except Service.DoesNotExist:
            self.stdout.write(self.style.WARNING("  Service 'vms' not found/active — skipping Subscription."))
            return

        subscription, created = Subscription.objects.get_or_create(
            tenant=tenant,
            service=vms_service,
            defaults={"status": "active"},
        )
        if not created and subscription.status != "active":
            subscription.status = "active"
            subscription.save(update_fields=["status"])
        self.stdout.write(f"  {'Created' if created else 'Exists'}: Subscription {tenant.tenant_code} -> vms ({subscription.status})")

    def _seed_vms_employee(self, org_ctx):
        employee, created = Employee.objects.get_or_create(
            cnic=VMS_EMPLOYEE_CNIC,
            defaults={
                "organization": org_ctx["org"],
                "full_name": "Increment0 VMS TestUser",
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
            department=org_ctx["department"],
            designation=org_ctx["designation"],
            defaults={"joining_date": date.today(), "is_primary": True},
        )
        employee.refresh_from_db()

        creds, cred_created = UserCredentials.objects.get_or_create(employee=employee)
        if cred_created or not creds.check_password(VMS_EMPLOYEE_PASSWORD):
            creds.set_password(VMS_EMPLOYEE_PASSWORD)
            creds.save()

        return employee

    def _seed_vms_access(self, employee):
        if not Service.objects.filter(code="vms", is_active=True).exists():
            self.stdout.write(self.style.WARNING("  Service 'vms' not found/active — skipping ServiceAccess."))
            return

        if not Subscription.tenant_has_active(employee.tenant_id, "vms"):
            self.stdout.write(self.style.WARNING(
                f"  Tenant {employee.tenant_id} has no active vms Subscription — skipping ServiceAccess."
            ))
            return

        service_access, created = ServiceAccess.objects.get_or_create(
            employee=employee,
            service="vms",
            defaults={"is_active": True},
        )
        self.stdout.write(f"  {'Created' if created else 'Exists'}: ServiceAccess vms for {employee.employee_code}")

    def _seed_catalog_role(self, tenant, employee):
        """Seed VMS catalog (permissions + templates), then assign the
        catalog-driven 'receptionist' role to the test employee for this tenant.
        """
        created_perms, total_perms = seed_vms_permissions()
        self.stdout.write(f"  Catalog permissions: {created_perms} new / {total_perms} total")

        created_templates = seed_vms_role_templates()
        self.stdout.write(f"  Catalog role templates: {created_templates} new")

        assign_employee_vms_role(employee, "receptionist", tenant=tenant)
        self.stdout.write(f"  EmployeeRole: {employee.employee_code} -> VMS Receptionist ({tenant.tenant_code})")
