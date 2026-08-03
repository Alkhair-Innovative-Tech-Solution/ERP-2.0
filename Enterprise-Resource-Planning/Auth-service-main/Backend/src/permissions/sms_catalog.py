"""
SMS permission + default-role-template catalog.

Namespaced permissions: sms.<module>.<action>
Default role templates (tenant=None, is_template=True) are cloned per-tenant
by instantiate_tenant_roles() when a tenant activates SMS — same pattern as
permissions.vms_catalog / permissions.hdms_catalog.

Phase B3: this is also the proving ground for the generalized RBAC layer —
assign_sms_role()/get_sms_role_type() work for EITHER an Employee (staff,
B1) or a NonStaffIdentity (student, A2/B2), through the exact same
EmployeeRole model and get_effective_permissions() path (see
permissions/rbac.py). No student-specific role table exists or is needed.
"""
from permissions.models import EmployeeRole, Permission, Role, Service

SMS_PERMISSIONS = [
    {"codename": "sms.assignment.upload", "name": "Upload an assignment submission"},
    {"codename": "sms.assignment.view", "name": "View assignments"},
    {"codename": "sms.fee.pay", "name": "Pay a fee voucher"},
    {"codename": "sms.fee.view", "name": "View fee vouchers"},
    {"codename": "sms.result.view", "name": "View own results"},
]

# Back-compat-style mapping, same shape as VMS_ROLE_TYPE_TO_NAME /
# HDMS's role-slug mapping: the API/frontend speaks short role_type slugs;
# the catalog identifies roles by name.
SMS_ROLE_TYPE_TO_NAME = {
    "student": "SMS Student",
}
SMS_ROLE_NAME_TO_TYPE = {v: k for k, v in SMS_ROLE_TYPE_TO_NAME.items()}

# name -> list of permission codenames
SMS_ROLE_TEMPLATES = {
    "SMS Student": [
        "sms.assignment.upload",
        "sms.assignment.view",
        "sms.fee.pay",
        "sms.fee.view",
        "sms.result.view",
    ],
}


def seed_sms_permissions():
    """Idempotent. Returns (created_count, total_count)."""
    created = 0
    for entry in SMS_PERMISSIONS:
        _, was_created = Permission.objects.get_or_create(
            codename=entry["codename"],
            defaults={"name": entry["name"], "service": "sms"},
        )
        if was_created:
            created += 1
    return created, len(SMS_PERMISSIONS)


def seed_sms_role_templates():
    """Idempotent. Creates catalog templates (tenant=None, is_template=True). Returns created_count."""
    sms_service = Service.objects.filter(code="sms").first()
    created = 0
    for role_name, codenames in SMS_ROLE_TEMPLATES.items():
        role, was_created = Role.objects.get_or_create(
            name=role_name,
            service="sms",
            tenant=None,
            defaults={
                "service_catalog": sms_service,
                "is_default": True,
                "is_template": True,
                "description": f"SMS default role template: {role_name}",
            },
        )
        if was_created:
            created += 1
        perms = Permission.objects.filter(codename__in=codenames)
        role.permissions.set(perms)
    return created


def instantiate_tenant_roles(tenant):
    """Clone each SMS role template into a tenant-scoped Role (idempotent).
    Returns list of (role, created) tuples."""
    sms_service = Service.objects.filter(code="sms").first()
    templates = Role.objects.filter(service="sms", tenant=None, is_template=True)
    results = []
    for template in templates:
        role, was_created = Role.objects.get_or_create(
            name=template.name,
            service="sms",
            tenant=tenant,
            defaults={
                "service_catalog": sms_service,
                "is_default": template.is_default,
                "is_template": False,
                "description": template.description,
            },
        )
        role.permissions.set(template.permissions.all())
        results.append((role, was_created))
    return results


def get_sms_role_type(principal):
    """Works for either an Employee or a NonStaffIdentity — same lookup,
    only the FK filter kwarg differs. Returns None if no SMS catalog role
    is assigned."""
    from authentication.nonstaff_models import NonStaffIdentity

    filter_kwargs = {"non_staff": principal} if isinstance(principal, NonStaffIdentity) else {"employee": principal}
    er = (
        EmployeeRole.objects.filter(role__service="sms", is_deleted=False, **filter_kwargs)
        .select_related("role")
        .first()
    )
    if not er:
        return None
    return SMS_ROLE_NAME_TO_TYPE.get(er.role.name, er.role.name)


def assign_sms_role(principal, role_type: str, tenant=None):
    """Works for either an Employee or a NonStaffIdentity — ensures the
    tenant's catalog role for `role_type` exists, then (re)points the
    principal's SMS EmployeeRole at it. This is the proof that Option A's
    generalized EmployeeRole/get_effective_permissions path really is one
    code path for both principal types, not two."""
    from authentication.nonstaff_models import NonStaffIdentity

    tenant = tenant or getattr(principal, "tenant", None)
    role_name = SMS_ROLE_TYPE_TO_NAME.get(role_type)
    if not role_name:
        raise ValueError(f"Unknown SMS role_type '{role_type}'")

    instantiate_tenant_roles(tenant)
    role = Role.objects.get(name=role_name, service="sms", tenant=tenant)

    filter_kwargs = {"non_staff": principal} if isinstance(principal, NonStaffIdentity) else {"employee": principal}
    EmployeeRole.objects.filter(role__service="sms", **filter_kwargs).delete()
    return EmployeeRole.objects.create(role=role, **filter_kwargs)
