"""
VMS permission + default-role-template catalog.

Namespaced permissions: vms.<module>.<action>
Default role templates (tenant=None, is_template=True) are cloned per-tenant
by instantiate_tenant_roles() when a tenant activates VMS.
"""
from permissions.models import Permission, Role, Service

VMS_PERMISSIONS = [
    {"codename": "vms.visit.create", "name": "Create Visit (check-in)"},
    {"codename": "vms.visit.checkout", "name": "Check out a visit"},
    {"codename": "vms.visit.view_own", "name": "View own gate's visits"},
    {"codename": "vms.visit.view_all", "name": "View all visits (tenant-wide)"},
    {"codename": "vms.visitor.view", "name": "View visitor records"},
    {"codename": "vms.visitor.create", "name": "Create visitor record"},
    {"codename": "vms.visitor.edit", "name": "Edit visitor record"},
    {"codename": "vms.gate.manage", "name": "Manage gates/locations"},
    {"codename": "vms.role.manage", "name": "Manage VMS users and roles"},
    {"codename": "vms.report.view", "name": "View VMS reports"},
]

# Back-compat mapping: old VmsRole.role_type slug <-> catalog Role.name.
# The frontend/API historically spoke 'admin' | 'receptionist' | 'security_staff';
# the catalog identifies roles by name. Keep both directions here in one place.
VMS_ROLE_TYPE_TO_NAME = {
    "admin": "VMS Admin",
    "receptionist": "VMS Receptionist",
    "security_staff": "VMS Security Staff",
}
VMS_ROLE_NAME_TO_TYPE = {v: k for k, v in VMS_ROLE_TYPE_TO_NAME.items()}

# name -> list of permission codenames
VMS_ROLE_TEMPLATES = {
    "VMS Admin": [p["codename"] for p in VMS_PERMISSIONS],  # everything
    "VMS Receptionist": [
        "vms.visit.create",
        "vms.visit.checkout",
        "vms.visit.view_own",
        "vms.visitor.view",
        "vms.visitor.create",
    ],
    "VMS Security Staff": [
        "vms.visit.view_own",
        "vms.visit.checkout",
        "vms.visitor.view",
    ],
}


def seed_vms_permissions():
    """Idempotent. Returns (created_count, total_count)."""
    created = 0
    for entry in VMS_PERMISSIONS:
        _, was_created = Permission.objects.get_or_create(
            codename=entry["codename"],
            defaults={"name": entry["name"], "service": "vms"},
        )
        if was_created:
            created += 1
    return created, len(VMS_PERMISSIONS)


def seed_vms_role_templates():
    """Idempotent. Creates catalog templates (tenant=None, is_template=True). Returns created_count."""
    vms_service = Service.objects.filter(code="vms").first()
    created = 0
    for role_name, codenames in VMS_ROLE_TEMPLATES.items():
        role, was_created = Role.objects.get_or_create(
            name=role_name,
            service="vms",
            tenant=None,
            defaults={
                "service_catalog": vms_service,
                "is_default": True,
                "is_template": True,
                "description": f"VMS default role template: {role_name}",
            },
        )
        if was_created:
            created += 1
        perms = Permission.objects.filter(codename__in=codenames)
        role.permissions.set(perms)
    return created


def get_employee_vms_role_type(employee):
    """Replaces VmsRole lookup: EmployeeRole -> catalog Role -> legacy role_type slug.
    Returns None if the employee has no VMS catalog role assigned."""
    from permissions.models import EmployeeRole

    er = (
        EmployeeRole.objects.filter(
            employee=employee, role__service="vms", is_deleted=False
        )
        .select_related("role")
        .first()
    )
    if not er:
        return None
    return VMS_ROLE_NAME_TO_TYPE.get(er.role.name, er.role.name)


def assign_employee_vms_role(employee, role_type: str, tenant=None):
    """Replaces VmsRole.objects.create/update: ensure the tenant's catalog role
    for `role_type` exists, then (re)point the employee's VMS EmployeeRole at it."""
    from permissions.models import EmployeeRole, Role

    tenant = tenant or employee.tenant
    role_name = VMS_ROLE_TYPE_TO_NAME.get(role_type)
    if not role_name:
        raise ValueError(f"Unknown VMS role_type '{role_type}'")

    instantiate_tenant_roles(tenant)
    role = Role.objects.get(name=role_name, service="vms", tenant=tenant)

    EmployeeRole.objects.filter(employee=employee, role__service="vms").delete()
    return EmployeeRole.objects.create(employee=employee, role=role)


def instantiate_tenant_roles(tenant):
    """
    Clone each VMS role template into a tenant-scoped Role (idempotent).
    Returns list of (role, created) tuples.
    """
    vms_service = Service.objects.filter(code="vms").first()
    templates = Role.objects.filter(service="vms", tenant=None, is_template=True)
    results = []
    for template in templates:
        role, was_created = Role.objects.get_or_create(
            name=template.name,
            service="vms",
            tenant=tenant,
            defaults={
                "service_catalog": vms_service,
                "is_default": template.is_default,
                "is_template": False,
                "description": template.description,
            },
        )
        role.permissions.set(template.permissions.all())
        results.append((role, was_created))
    return results
