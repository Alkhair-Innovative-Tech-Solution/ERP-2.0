"""
HDMS permission + default-role-template catalog.

Namespaced permissions: hdms.<module>.<action>
Default role templates (tenant=None, is_template=True) are cloned per-tenant
by instantiate_tenant_roles() when a tenant activates HDMS.

Mirrors vms_catalog.py exactly — see that file's comments for the pattern.
Permissions are derived from the old HdmsRole.save()'s per-role_type grants
(can_view_all_tickets / can_assign_tickets / can_close_tickets /
can_manage_users) plus the baseline create/view-own capability every role
had via ServiceAccess alone (the old HdmsRole gave Requestor no booleans at
all — its docstring says "Can only create tickets and view own tickets",
which is why hdms.ticket.create / hdms.ticket.view_own exist as an explicit
baseline here rather than being implicit).
"""
from permissions.models import Permission, Role, Service

HDMS_PERMISSIONS = [
    {"codename": "hdms.ticket.create", "name": "Create a ticket"},
    {"codename": "hdms.ticket.view_own", "name": "View own tickets"},
    {"codename": "hdms.ticket.view_all", "name": "View all tickets (tenant-wide)"},
    {"codename": "hdms.ticket.assign", "name": "Assign tickets to others"},
    {"codename": "hdms.ticket.close", "name": "Close/resolve tickets"},
    {"codename": "hdms.user.manage", "name": "Manage HDMS users and permissions"},
]

# Back-compat mapping: old HdmsRole.role_type slug <-> catalog Role.name.
# The frontend/API historically spoke 'admin' | 'moderator' | 'assignee' | 'requestor';
# the catalog identifies roles by name. Keep both directions here in one place.
HDMS_ROLE_TYPE_TO_NAME = {
    "admin": "HDMS Admin",
    "moderator": "HDMS Moderator",
    "assignee": "HDMS Assignee",
    "requestor": "HDMS Requestor",
}
HDMS_ROLE_NAME_TO_TYPE = {v: k for k, v in HDMS_ROLE_TYPE_TO_NAME.items()}

# name -> list of permission codenames
HDMS_ROLE_TEMPLATES = {
    "HDMS Admin": [p["codename"] for p in HDMS_PERMISSIONS],  # everything
    "HDMS Moderator": [
        "hdms.ticket.create",
        "hdms.ticket.view_own",
        "hdms.ticket.view_all",
        "hdms.ticket.assign",
        "hdms.ticket.close",
    ],
    "HDMS Assignee": [
        "hdms.ticket.create",
        "hdms.ticket.view_own",
        "hdms.ticket.close",
    ],
    "HDMS Requestor": [
        "hdms.ticket.create",
        "hdms.ticket.view_own",
    ],
}


def seed_hdms_permissions():
    """Idempotent. Returns (created_count, total_count)."""
    created = 0
    for entry in HDMS_PERMISSIONS:
        _, was_created = Permission.objects.get_or_create(
            codename=entry["codename"],
            defaults={"name": entry["name"], "service": "hdms"},
        )
        if was_created:
            created += 1
    return created, len(HDMS_PERMISSIONS)


def seed_hdms_role_templates():
    """Idempotent. Creates catalog templates (tenant=None, is_template=True). Returns created_count."""
    hdms_service = Service.objects.filter(code="hdms").first()
    created = 0
    for role_name, codenames in HDMS_ROLE_TEMPLATES.items():
        role, was_created = Role.objects.get_or_create(
            name=role_name,
            service="hdms",
            tenant=None,
            defaults={
                "service_catalog": hdms_service,
                "is_default": True,
                "is_template": True,
                "description": f"HDMS default role template: {role_name}",
            },
        )
        if was_created:
            created += 1
        perms = Permission.objects.filter(codename__in=codenames)
        role.permissions.set(perms)
    return created


def get_employee_hdms_role_type(employee):
    """Replaces HdmsRole lookup: EmployeeRole -> catalog Role -> legacy role_type slug.
    Returns None if the employee has no HDMS catalog role assigned."""
    from permissions.models import EmployeeRole

    er = (
        EmployeeRole.objects.filter(
            employee=employee, role__service="hdms", is_deleted=False
        )
        .select_related("role")
        .first()
    )
    if not er:
        return None
    return HDMS_ROLE_NAME_TO_TYPE.get(er.role.name, er.role.name)


def assign_employee_hdms_role(employee, role_type: str, tenant=None):
    """Replaces HdmsRole.objects.create/update: ensure the tenant's catalog role
    for `role_type` exists, then (re)point the employee's HDMS EmployeeRole at it."""
    from permissions.models import EmployeeRole, Role

    tenant = tenant or employee.tenant
    role_name = HDMS_ROLE_TYPE_TO_NAME.get(role_type)
    if not role_name:
        raise ValueError(f"Unknown HDMS role_type '{role_type}'")

    instantiate_tenant_roles(tenant)
    role = Role.objects.get(name=role_name, service="hdms", tenant=tenant)

    EmployeeRole.objects.filter(employee=employee, role__service="hdms").delete()
    return EmployeeRole.objects.create(employee=employee, role=role)


def instantiate_tenant_roles(tenant):
    """
    Clone each HDMS role template into a tenant-scoped Role (idempotent).
    Returns list of (role, created) tuples.
    """
    hdms_service = Service.objects.filter(code="hdms").first()
    templates = Role.objects.filter(service="hdms", tenant=None, is_template=True)
    results = []
    for template in templates:
        role, was_created = Role.objects.get_or_create(
            name=template.name,
            service="hdms",
            tenant=tenant,
            defaults={
                "service_catalog": hdms_service,
                "is_default": template.is_default,
                "is_template": False,
                "description": template.description,
            },
        )
        role.permissions.set(template.permissions.all())
        results.append((role, was_created))
    return results
