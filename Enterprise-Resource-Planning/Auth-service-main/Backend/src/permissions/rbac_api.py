import uuid
from typing import Optional, List
from django.http import HttpRequest
from ninja import Router, Schema
from ninja.security import HttpBearer
from permissions.models import Permission, Role, EmployeeRole, EmployeePermissionOverride
from permissions.rbac import clear_permission_cache


class SuperAdminBearer(HttpBearer):
    def authenticate(self, request: HttpRequest, token: str):
        from authentication.api import AuthBearer
        from authentication.superadmin_models import SuperAdmin
        user = AuthBearer().authenticate(request, token)
        if not isinstance(user, SuperAdmin):
            return None
        return user


router = Router(tags=["RBAC Management"], auth=SuperAdminBearer())


# ── Schemas ───────────────────────────────────────────────────────────────────

class ErrorOut(Schema):
    error: str


class MessageOut(Schema):
    message: str


class RoleOut(Schema):
    id: str
    name: str
    service: str
    is_default: bool
    description: str
    permission_count: int

    @staticmethod
    def from_role(role: Role) -> "RoleOut":
        return RoleOut(
            id=str(role.id),
            name=role.name,
            service=role.service,
            is_default=role.is_default,
            description=role.description,
            permission_count=role.permissions.count(),
        )


class RoleListOut(Schema):
    roles: List[RoleOut]
    count: int


class RoleCreateIn(Schema):
    name: str
    service: str
    description: str = ""
    permission_codenames: List[str] = []


class RoleUpdateIn(Schema):
    name: Optional[str] = None
    description: Optional[str] = None
    permission_codenames: Optional[List[str]] = None


class EmployeeRoleOut(Schema):
    id: str
    employee_id: str
    role_id: str
    role_name: str
    granted_at: str


class AssignRoleIn(Schema):
    employee_id: str  # varchar employee code e.g. "AIT01-G-26-H-0001"
    role_id: uuid.UUID


class OverrideOut(Schema):
    id: str
    employee_id: str
    permission_codename: str
    is_allowed: bool


class CreateOverrideIn(Schema):
    employee_id: uuid.UUID
    permission_codename: str
    is_allowed: bool
    force: bool = False  # bypass 409 role-conflict warning


class EffectivePermissionsOut(Schema):
    employee_id: str
    permissions: List[str]
    is_superadmin: bool = False
    has_all_permissions: bool = False


class PermissionOut(Schema):
    codename: str
    name: str
    service: str
    description: str


class PermissionListOut(Schema):
    permissions: List[PermissionOut]
    count: int


class RoleDetailOut(Schema):
    id: str
    name: str
    service: str
    is_default: bool
    description: str
    permission_codenames: List[str]


class EmployeeRoleListOut(Schema):
    assignments: List[EmployeeRoleOut]
    count: int


# ── Roles CRUD ────────────────────────────────────────────────────────────────

@router.get("/roles", response={200: RoleListOut, 401: ErrorOut})
def list_roles(request: HttpRequest, service: Optional[str] = None):
    qs = Role.objects.all()
    if service:
        qs = qs.filter(service=service)
    return 200, RoleListOut(
        roles=[RoleOut.from_role(r) for r in qs],
        count=qs.count(),
    )


@router.post("/roles", response={201: RoleOut, 400: ErrorOut, 401: ErrorOut})
def create_role(request: HttpRequest, payload: RoleCreateIn):
    if Role.objects.filter(name=payload.name, service=payload.service).exists():
        return 400, {"error": f"Role '{payload.name}' already exists for service '{payload.service}'"}
    role = Role.objects.create(
        name=payload.name,
        service=payload.service,
        description=payload.description,
    )
    if payload.permission_codenames:
        role.permissions.set(Permission.objects.filter(codename__in=payload.permission_codenames))
    return 201, RoleOut.from_role(role)


@router.patch("/roles/{role_id}", response={200: RoleOut, 404: ErrorOut, 401: ErrorOut})
def update_role(request: HttpRequest, role_id: uuid.UUID, payload: RoleUpdateIn):
    try:
        role = Role.objects.get(pk=role_id)
    except Role.DoesNotExist:
        return 404, {"error": "Role not found"}
    if payload.name is not None:
        role.name = payload.name
    if payload.description is not None:
        role.description = payload.description
    role.save()
    if payload.permission_codenames is not None:
        role.permissions.set(Permission.objects.filter(codename__in=payload.permission_codenames))
        for er in EmployeeRole.objects.filter(role=role, is_deleted=False):
            clear_permission_cache(str(er.employee_id))
    return 200, RoleOut.from_role(role)


@router.delete("/roles/{role_id}", response={200: MessageOut, 404: ErrorOut, 401: ErrorOut})
def delete_role(request: HttpRequest, role_id: uuid.UUID):
    try:
        role = Role.objects.get(pk=role_id)
    except Role.DoesNotExist:
        return 404, {"error": "Role not found"}
    for er in EmployeeRole.objects.filter(role=role, is_deleted=False):
        clear_permission_cache(str(er.employee_id))
    role.soft_delete()
    return 200, {"message": f"Role '{role.name}' deleted"}


# ── Employee Role Assignments ─────────────────────────────────────────────────

@router.post("/employee-roles", response={201: EmployeeRoleOut, 404: ErrorOut, 400: ErrorOut, 401: ErrorOut})
def assign_role(request: HttpRequest, payload: AssignRoleIn):
    from employees.models import Employee
    try:
        employee = Employee.objects.get(employee_id=payload.employee_id, is_deleted=False)
    except Employee.DoesNotExist:
        return 404, {"error": "Employee not found"}
    try:
        role = Role.objects.get(pk=payload.role_id)
    except Role.DoesNotExist:
        return 404, {"error": "Role not found"}
    if EmployeeRole.objects.filter(employee=employee, role=role, is_deleted=False).exists():
        return 400, {"error": "Employee already has this role"}
    er = EmployeeRole.objects.create(employee=employee, role=role)
    clear_permission_cache(str(employee.id))
    return 201, EmployeeRoleOut(
        id=str(er.id),
        employee_id=str(employee.id),
        role_id=str(role.id),
        role_name=role.name,
        granted_at=er.granted_at.isoformat(),
    )


@router.delete("/employee-roles/{er_id}", response={200: MessageOut, 404: ErrorOut, 401: ErrorOut})
def remove_role_assignment(request: HttpRequest, er_id: uuid.UUID):
    try:
        er = EmployeeRole.objects.get(pk=er_id)
    except EmployeeRole.DoesNotExist:
        return 404, {"error": "Assignment not found"}
    clear_permission_cache(str(er.employee_id))
    er.soft_delete()
    return 200, {"message": "Role assignment removed"}


# ── Permission Overrides ──────────────────────────────────────────────────────

@router.post("/overrides", response={201: OverrideOut, 404: ErrorOut, 400: ErrorOut, 401: ErrorOut, 409: ErrorOut})
def create_override(request: HttpRequest, payload: CreateOverrideIn):
    from employees.models import Employee
    try:
        employee = Employee.objects.get(pk=payload.employee_id, is_deleted=False)
    except Employee.DoesNotExist:
        return 404, {"error": "Employee not found"}
    try:
        perm = Permission.objects.get(codename=payload.permission_codename)
    except Permission.DoesNotExist:
        return 404, {"error": f"Permission '{payload.permission_codename}' not found"}
    if EmployeePermissionOverride.objects.filter(employee=employee, permission=perm, is_deleted=False).exists():
        return 400, {"error": "Override already exists for this employee + permission"}
    if not payload.is_allowed and not payload.force:
        role_codenames = set(
            Permission.objects.filter(
                roles__employee_roles__employee=employee,
                roles__employee_roles__is_deleted=False,
            ).values_list("codename", flat=True)
        )
        if payload.permission_codename in role_codenames:
            return 409, {"error": f"Role already grants '{payload.permission_codename}'. DENY override will block it. Confirm to proceed anyway."}
    override = EmployeePermissionOverride.objects.create(
        employee=employee, permission=perm, is_allowed=payload.is_allowed
    )
    clear_permission_cache(str(employee.id))
    return 201, OverrideOut(
        id=str(override.id),
        employee_id=str(employee.id),
        permission_codename=perm.codename,
        is_allowed=override.is_allowed,
    )


@router.delete("/overrides/{override_id}", response={200: MessageOut, 404: ErrorOut, 401: ErrorOut})
def remove_override(request: HttpRequest, override_id: uuid.UUID):
    try:
        override = EmployeePermissionOverride.objects.get(pk=override_id)
    except EmployeePermissionOverride.DoesNotExist:
        return 404, {"error": "Override not found"}
    clear_permission_cache(str(override.employee_id))
    override.soft_delete()
    return 200, {"message": "Override removed"}


# ── Permissions List ──────────────────────────────────────────────────────────

@router.get("/permissions", response={200: PermissionListOut, 401: ErrorOut})
def list_permissions(request: HttpRequest, service: Optional[str] = None):
    qs = Permission.objects.all()
    if service:
        qs = qs.filter(service=service)
    return 200, PermissionListOut(
        permissions=[PermissionOut(codename=p.codename, name=p.name, service=p.service, description=p.description) for p in qs],
        count=qs.count(),
    )


# ── Role Detail ───────────────────────────────────────────────────────────────

@router.get("/roles/{role_id}", response={200: RoleDetailOut, 404: ErrorOut, 401: ErrorOut})
def get_role_detail(request: HttpRequest, role_id: uuid.UUID):
    try:
        role = Role.objects.get(pk=role_id)
    except Role.DoesNotExist:
        return 404, {"error": "Role not found"}
    return 200, RoleDetailOut(
        id=str(role.id),
        name=role.name,
        service=role.service,
        is_default=role.is_default,
        description=role.description,
        permission_codenames=list(role.permissions.values_list("codename", flat=True)),
    )


# ── Employee Roles List ───────────────────────────────────────────────────────

@router.get("/employee-roles", response={200: EmployeeRoleListOut, 401: ErrorOut})
def list_employee_roles(request: HttpRequest, employee_id: Optional[uuid.UUID] = None):
    qs = EmployeeRole.objects.filter(is_deleted=False).select_related("role", "employee")
    if employee_id:
        qs = qs.filter(employee_id=employee_id)
    return 200, EmployeeRoleListOut(
        assignments=[
            EmployeeRoleOut(
                id=str(er.id),
                employee_id=str(er.employee_id),
                role_id=str(er.role_id),
                role_name=er.role.name,
                granted_at=er.granted_at.isoformat(),
            ) for er in qs
        ],
        count=qs.count(),
    )


# ── Effective Permissions ─────────────────────────────────────────────────────

@router.get("/effective-permissions/{target_id}", response={200: EffectivePermissionsOut, 404: ErrorOut, 401: ErrorOut})
def get_effective_permissions_view(request: HttpRequest, target_id: uuid.UUID, is_superadmin: bool = False):
    from authentication.superadmin_models import SuperAdmin
    from permissions.rbac import get_effective_permissions

    if is_superadmin:
        try:
            SuperAdmin.objects.get(pk=target_id, is_active=True)
        except SuperAdmin.DoesNotExist:
            return 404, {"error": "SuperAdmin not found"}
        return 200, EffectivePermissionsOut(
            employee_id=str(target_id),
            permissions=list(Permission.objects.values_list("codename", flat=True)),
            is_superadmin=True,
            has_all_permissions=True,
        )

    from employees.models import Employee
    try:
        Employee.objects.get(pk=target_id, is_deleted=False)
    except Employee.DoesNotExist:
        return 404, {"error": "Employee not found"}

    perms = get_effective_permissions(str(target_id))
    return 200, EffectivePermissionsOut(
        employee_id=str(target_id),
        permissions=sorted(perms),
    )
