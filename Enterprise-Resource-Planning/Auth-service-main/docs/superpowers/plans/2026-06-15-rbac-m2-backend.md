# RBAC M2 — Backend API & Permission Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the permission engine (`has_permission`), `@require_permission` decorator, and 9 RBAC management API endpoints (roles CRUD, assignments, overrides, effective-permissions) — all with Redis caching and SuperAdmin bypass.

**Architecture:** Three new files added to the `permissions` app. `rbac.py` is the pure engine (no HTTP concerns). `decorators.py` wraps Django Ninja endpoints. `rbac_api.py` contains all 9 management endpoints mounted at `/api/permissions/rbac/*`. All write operations invalidate the Redis cache. SuperAdmin bypasses all permission checks unconditionally.

**Tech Stack:** Django 5, Django Ninja, django-redis (`django.core.cache`), pytest-django, `authentication.api.AuthBearer` (existing), `ninja.errors.HttpError`.

**Branch:** `feat/rbac-m2-backend` (create before starting)

**Save plan to:** `Auth-service/docs/superpowers/plans/2026-06-15-rbac-m2-backend.md`

---

## Codebase Context

- All commands run via Docker: `docker exec auth_service python -m pytest ...` and `docker exec -u root auth_service python manage.py ...`
- Working directory inside container: `/app` (maps to `Auth-service/Backend/src/`)
- `AuthBearer` is in `authentication.api`. `request.auth` is `Employee` or `SuperAdmin` after auth passes.
- `SuperAdmin` model: `authentication.superadmin_models.SuperAdmin`
- Redis cache: `django.core.cache.cache` (already configured as `django_redis`, 5-min TTL = 300s)
- `employee` fixture in `conftest.py` creates `Employee(organization=org, full_name="Ali Hassan", ...)`
- `auth_client` fixture in `conftest.py` returns `(client, employee)` with Bearer token pre-loaded
- Permission engine formula: `(role_permissions ∪ allowed_overrides) − denied_overrides`
- `EmployeeRole` and `EmployeePermissionOverride` both use `SoftDeleteModel` — filter with `is_deleted=False`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `permissions/rbac.py` | Pure permission engine: `get_effective_permissions`, `has_permission`, `clear_permission_cache` |
| Create | `permissions/decorators.py` | `@require_permission(codename)` decorator for Django Ninja endpoints |
| Create | `permissions/rbac_api.py` | 9 RBAC management endpoints + schemas |
| Create | `permissions/test_rbac_engine.py` | All M2 tests |
| Modify | `core/urls.py` | Mount `rbac_router` at `/api/permissions/rbac` |
| Modify | `conftest.py` | Add `superadmin` and `superadmin_auth_client` fixtures |

---

## Task 1: Permission Engine

**Files:**
- Create: `permissions/rbac.py`
- Create: `permissions/test_rbac_engine.py`

- [ ] **Step 1: Write failing tests for engine**

Create `permissions/test_rbac_engine.py`:

```python
import pytest
from unittest.mock import patch
from django.core.cache import cache
from permissions.models import Permission, Role, EmployeeRole, EmployeePermissionOverride
from permissions.rbac import get_effective_permissions, has_permission, clear_permission_cache


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
class TestGetEffectivePermissions:
    def test_no_roles_no_overrides_returns_empty(self, employee):
        result = get_effective_permissions(str(employee.id))
        assert result == set()

    def test_role_permissions_included(self, employee):
        perm = Permission.objects.create(codename="employee.view", name="View Employees", service="auth")
        role = Role.objects.create(name="Viewer", service="auth")
        role.permissions.add(perm)
        EmployeeRole.objects.create(employee=employee, role=role)

        result = get_effective_permissions(str(employee.id))
        assert "employee.view" in result

    def test_allowed_override_grants_extra_permission(self, employee):
        perm = Permission.objects.create(codename="department.create", name="Create Dept", service="auth")
        EmployeePermissionOverride.objects.create(employee=employee, permission=perm, is_allowed=True)

        result = get_effective_permissions(str(employee.id))
        assert "department.create" in result

    def test_denied_override_blocks_role_permission(self, employee):
        perm = Permission.objects.create(codename="employee.delete", name="Delete Employee", service="auth")
        role = Role.objects.create(name="Admin", service="auth")
        role.permissions.add(perm)
        EmployeeRole.objects.create(employee=employee, role=role)
        EmployeePermissionOverride.objects.create(employee=employee, permission=perm, is_allowed=False)

        result = get_effective_permissions(str(employee.id))
        assert "employee.delete" not in result

    def test_formula_union_minus_denied(self, employee):
        perm_role = Permission.objects.create(codename="branch.view", name="View Branch", service="auth")
        perm_extra = Permission.objects.create(codename="branch.create", name="Create Branch", service="auth")
        perm_blocked = Permission.objects.create(codename="branch.delete", name="Delete Branch", service="auth")

        role = Role.objects.create(name="Branch Manager", service="auth")
        role.permissions.set([perm_role, perm_blocked])
        EmployeeRole.objects.create(employee=employee, role=role)

        EmployeePermissionOverride.objects.create(employee=employee, permission=perm_extra, is_allowed=True)
        EmployeePermissionOverride.objects.create(employee=employee, permission=perm_blocked, is_allowed=False)

        result = get_effective_permissions(str(employee.id))
        assert "branch.view" in result
        assert "branch.create" in result
        assert "branch.delete" not in result

    def test_result_cached_in_redis(self, employee):
        perm = Permission.objects.create(codename="audit.view", name="View Audit", service="auth")
        role = Role.objects.create(name="Auditor", service="auth")
        role.permissions.add(perm)
        EmployeeRole.objects.create(employee=employee, role=role)

        get_effective_permissions(str(employee.id))

        # Second call should hit cache — verify by removing DB role and checking result unchanged
        EmployeeRole.objects.filter(employee=employee).delete()
        result = get_effective_permissions(str(employee.id))
        assert "audit.view" in result  # cache still has it

    def test_cache_cleared_by_clear_permission_cache(self, employee):
        perm = Permission.objects.create(codename="audit.view", name="View Audit", service="auth")
        role = Role.objects.create(name="Auditor", service="auth")
        role.permissions.add(perm)
        EmployeeRole.objects.create(employee=employee, role=role)

        get_effective_permissions(str(employee.id))
        EmployeeRole.objects.filter(employee=employee).delete()
        clear_permission_cache(str(employee.id))

        result = get_effective_permissions(str(employee.id))
        assert "audit.view" not in result


@pytest.mark.django_db
class TestHasPermission:
    def test_employee_without_permission_returns_false(self, employee):
        assert has_permission(employee, "employee.delete") is False

    def test_employee_with_permission_returns_true(self, employee):
        perm = Permission.objects.create(codename="employee.view", name="View Employees", service="auth")
        role = Role.objects.create(name="Viewer", service="auth")
        role.permissions.add(perm)
        EmployeeRole.objects.create(employee=employee, role=role)

        assert has_permission(employee, "employee.view") is True

    def test_superadmin_always_returns_true(self, superadmin):
        assert has_permission(superadmin, "employee.delete") is True
        assert has_permission(superadmin, "nonexistent.permission") is True
```

- [ ] **Step 2: Run tests — expect FAIL (ImportError)**

```bash
docker exec auth_service python -m pytest permissions/test_rbac_engine.py::TestGetEffectivePermissions permissions/test_rbac_engine.py::TestHasPermission -v
```

Expected: `ImportError: cannot import name 'get_effective_permissions' from 'permissions.rbac'`

- [ ] **Step 3: Add `superadmin` fixture to conftest.py**

Append to `conftest.py` (after the `auth_client` fixture):

```python
@pytest.fixture
def superadmin(db):
    from authentication.superadmin_models import SuperAdmin
    return SuperAdmin.objects.create(
        superadmin_code="S-26-0001",
        full_name="Test SuperAdmin",
        email="superadmin@test.com",
        is_active=True,
    )


@pytest.fixture
def superadmin_auth_client(db, superadmin):
    from authentication.jwt_utils import generate_access_token
    token = generate_access_token(superadmin)
    client = Client()
    client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {token}'
    return client, superadmin
```

- [ ] **Step 4: Create `permissions/rbac.py`**

```python
from django.core.cache import cache
from authentication.superadmin_models import SuperAdmin
from permissions.models import Permission, EmployeeRole, EmployeePermissionOverride

CACHE_TTL = 300  # 5 minutes
_CACHE_KEY = "rbac:emp:{}:permissions"


def get_effective_permissions(employee_id: str) -> set:
    """
    Compute effective permissions for an employee.
    Formula: (role_permissions ∪ allowed_overrides) − denied_overrides
    Result cached in Redis for 5 minutes.
    """
    cache_key = _CACHE_KEY.format(employee_id)
    cached = cache.get(cache_key)
    if cached is not None:
        return set(cached)

    role_codenames = set(
        Permission.objects.filter(
            roles__employee_roles__employee_id=employee_id,
            roles__employee_roles__is_deleted=False,
        ).values_list("codename", flat=True)
    )

    allowed_overrides: set = set()
    denied_overrides: set = set()
    for override in EmployeePermissionOverride.objects.filter(
        employee_id=employee_id, is_deleted=False
    ).select_related("permission"):
        if override.is_allowed:
            allowed_overrides.add(override.permission.codename)
        else:
            denied_overrides.add(override.permission.codename)

    effective = (role_codenames | allowed_overrides) - denied_overrides
    cache.set(cache_key, list(effective), CACHE_TTL)
    return effective


def has_permission(user, codename: str) -> bool:
    """SuperAdmin bypasses all checks. Employee checked against effective permissions."""
    if isinstance(user, SuperAdmin):
        return True
    return codename in get_effective_permissions(str(user.id))


def clear_permission_cache(employee_id: str) -> None:
    """Invalidate cached permission set for one employee."""
    cache.delete(_CACHE_KEY.format(employee_id))
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
docker exec auth_service python -m pytest permissions/test_rbac_engine.py::TestGetEffectivePermissions permissions/test_rbac_engine.py::TestHasPermission -v
```

Expected: `9 passed`

- [ ] **Step 6: Commit**

```bash
git add permissions/rbac.py permissions/test_rbac_engine.py Backend/src/conftest.py
git commit -m "feat(rbac): add permission engine with Redis cache and superadmin bypass"
```

---

## Task 2: `@require_permission` Decorator

**Files:**
- Create: `permissions/decorators.py`
- Modify: `permissions/test_rbac_engine.py` (append tests)

- [ ] **Step 1: Append decorator tests to `permissions/test_rbac_engine.py`**

```python
from ninja.testing import TestClient as NinjaTestClient
from ninja import Router as NinjaRouter
from permissions.decorators import require_permission
from authentication.api import AuthBearer


@pytest.mark.django_db
class TestRequirePermissionDecorator:
    def test_passes_when_employee_has_permission(self, employee):
        perm = Permission.objects.create(codename="employee.view", name="View Employees", service="auth")
        role = Role.objects.create(name="Viewer", service="auth")
        role.permissions.add(perm)
        EmployeeRole.objects.create(employee=employee, role=role)

        # Build a tiny in-memory Ninja router to test the decorator
        test_router = NinjaRouter()

        @test_router.get("/guarded", auth=AuthBearer())
        @require_permission("employee.view")
        def guarded_endpoint(request):
            return {"ok": True}

        from authentication.jwt_utils import generate_access_token
        token = generate_access_token(employee)
        client = NinjaTestClient(test_router)
        response = client.get("/guarded", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200

    def test_returns_403_when_employee_lacks_permission(self, employee):
        test_router = NinjaRouter()

        @test_router.get("/guarded", auth=AuthBearer())
        @require_permission("employee.delete")
        def guarded_endpoint(request):
            return {"ok": True}

        from authentication.jwt_utils import generate_access_token
        token = generate_access_token(employee)
        client = NinjaTestClient(test_router)
        response = client.get("/guarded", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 403

    def test_superadmin_bypasses_check(self, superadmin):
        test_router = NinjaRouter()

        @test_router.get("/guarded", auth=AuthBearer())
        @require_permission("employee.delete")
        def guarded_endpoint(request):
            return {"ok": True}

        from authentication.jwt_utils import generate_access_token
        token = generate_access_token(superadmin)
        client = NinjaTestClient(test_router)
        response = client.get("/guarded", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
```

- [ ] **Step 2: Run tests — expect FAIL (ImportError)**

```bash
docker exec auth_service python -m pytest permissions/test_rbac_engine.py::TestRequirePermissionDecorator -v
```

Expected: `ImportError: cannot import name 'require_permission' from 'permissions.decorators'`

- [ ] **Step 3: Create `permissions/decorators.py`**

```python
from functools import wraps
from ninja.errors import HttpError
from permissions.rbac import has_permission


def require_permission(codename: str):
    """
    Decorator for Django Ninja endpoints that enforces RBAC.
    Must be applied AFTER the @router.method() decorator (i.e. closer to the function).
    Requires the endpoint to use auth=AuthBearer() so request.auth is populated.
    SuperAdmin bypasses all checks.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            if not has_permission(request.auth, codename):
                raise HttpError(403, f"Permission denied: requires '{codename}'")
            return func(request, *args, **kwargs)
        return wrapper
    return decorator
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
docker exec auth_service python -m pytest permissions/test_rbac_engine.py::TestRequirePermissionDecorator -v
```

Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add permissions/decorators.py permissions/test_rbac_engine.py
git commit -m "feat(rbac): add require_permission decorator with 403 enforcement and superadmin bypass"
```

---

## Task 3: Roles CRUD API

**Files:**
- Create: `permissions/rbac_api.py`
- Modify: `permissions/test_rbac_engine.py` (append tests)

- [ ] **Step 1: Append Roles API tests to `permissions/test_rbac_engine.py`**

```python
from django.test import Client as DjangoClient


@pytest.fixture
def sa_client(db, superadmin):
    """Django test client with superadmin Bearer token."""
    from authentication.jwt_utils import generate_access_token
    token = generate_access_token(superadmin)
    client = DjangoClient()
    client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {token}'
    return client


@pytest.mark.django_db
class TestRolesAPI:
    def test_list_roles_returns_200(self, sa_client):
        Role.objects.create(name="HR Manager", service="auth")
        response = sa_client.get("/api/permissions/rbac/roles")
        assert response.status_code == 200
        data = response.json()
        assert any(r["name"] == "HR Manager" for r in data["roles"])

    def test_create_role_returns_201(self, sa_client):
        response = sa_client.post(
            "/api/permissions/rbac/roles",
            data='{"name": "Finance Admin", "service": "auth", "description": ""}',
            content_type="application/json",
        )
        assert response.status_code == 201
        assert Role.objects.filter(name="Finance Admin").exists()

    def test_create_role_with_permissions(self, sa_client):
        perm = Permission.objects.create(codename="branch.view", name="View Branch", service="auth")
        response = sa_client.post(
            "/api/permissions/rbac/roles",
            data=f'{{"name": "Branch Viewer", "service": "auth", "description": "", "permission_codenames": ["branch.view"]}}',
            content_type="application/json",
        )
        assert response.status_code == 201
        role = Role.objects.get(name="Branch Viewer")
        assert role.permissions.filter(codename="branch.view").exists()

    def test_update_role_returns_200(self, sa_client):
        role = Role.objects.create(name="Old Name", service="auth")
        response = sa_client.patch(
            f"/api/permissions/rbac/roles/{role.id}",
            data='{"name": "New Name"}',
            content_type="application/json",
        )
        assert response.status_code == 200
        role.refresh_from_db()
        assert role.name == "New Name"

    def test_delete_role_soft_deletes(self, sa_client):
        role = Role.objects.create(name="Temp Role", service="auth")
        response = sa_client.delete(f"/api/permissions/rbac/roles/{role.id}")
        assert response.status_code == 200
        assert Role.objects.filter(pk=role.pk).count() == 0
        assert Role.all_objects.filter(pk=role.pk).count() == 1

    def test_list_roles_requires_auth(self):
        client = DjangoClient()
        response = client.get("/api/permissions/rbac/roles")
        assert response.status_code == 401
```

- [ ] **Step 2: Run tests — expect FAIL (404 — endpoint not found)**

```bash
docker exec auth_service python -m pytest permissions/test_rbac_engine.py::TestRolesAPI -v
```

Expected: All fail with `AssertionError` (404 response — router not mounted yet)

- [ ] **Step 3: Create `permissions/rbac_api.py` with Roles endpoints**

```python
import uuid
from typing import Optional, List
from django.http import HttpRequest
from ninja import Router, Schema
from authentication.api import AuthBearer
from permissions.models import Permission, Role, EmployeeRole, EmployeePermissionOverride
from permissions.rbac import clear_permission_cache

router = Router(tags=["RBAC Management"])


# ── Schemas ──────────────────────────────────────────────────────────────────

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


class MessageOut(Schema):
    message: str


class ErrorOut(Schema):
    error: str


# ── Roles CRUD ────────────────────────────────────────────────────────────────

@router.get("/roles", response={200: RoleListOut, 401: ErrorOut}, auth=AuthBearer())
def list_roles(request: HttpRequest):
    roles = Role.objects.all()
    return 200, RoleListOut(
        roles=[RoleOut.from_role(r) for r in roles],
        count=roles.count(),
    )


@router.post("/roles", response={201: RoleOut, 400: ErrorOut, 401: ErrorOut}, auth=AuthBearer())
def create_role(request: HttpRequest, payload: RoleCreateIn):
    if Role.objects.filter(name=payload.name, service=payload.service).exists():
        return 400, {"error": f"Role '{payload.name}' already exists for service '{payload.service}'"}
    role = Role.objects.create(
        name=payload.name,
        service=payload.service,
        description=payload.description,
    )
    if payload.permission_codenames:
        perms = Permission.objects.filter(codename__in=payload.permission_codenames)
        role.permissions.set(perms)
    return 201, RoleOut.from_role(role)


@router.patch("/roles/{role_id}", response={200: RoleOut, 404: ErrorOut, 401: ErrorOut}, auth=AuthBearer())
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
        perms = Permission.objects.filter(codename__in=payload.permission_codenames)
        role.permissions.set(perms)
        # Invalidate cache for all employees with this role
        for er in EmployeeRole.objects.filter(role=role, is_deleted=False):
            clear_permission_cache(str(er.employee_id))
    return 200, RoleOut.from_role(role)


@router.delete("/roles/{role_id}", response={200: MessageOut, 404: ErrorOut, 401: ErrorOut}, auth=AuthBearer())
def delete_role(request: HttpRequest, role_id: uuid.UUID):
    try:
        role = Role.objects.get(pk=role_id)
    except Role.DoesNotExist:
        return 404, {"error": "Role not found"}
    # Invalidate cache for affected employees before soft delete
    for er in EmployeeRole.objects.filter(role=role, is_deleted=False):
        clear_permission_cache(str(er.employee_id))
    role.soft_delete()
    return 200, {"message": f"Role '{role.name}' deleted"}
```

- [ ] **Step 4: Mount router in `core/urls.py`**

Add after the existing router imports and `api.add_router` calls:

```python
from permissions.rbac_api import router as rbac_router
```

And after `api.add_router("/audit", audit_router)`:

```python
api.add_router("/permissions/rbac", rbac_router)
```

- [ ] **Step 5: Verify system check clean**

```bash
docker exec auth_service python manage.py check
```

Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 6: Run Roles API tests — expect PASS**

```bash
docker exec auth_service python -m pytest permissions/test_rbac_engine.py::TestRolesAPI -v
```

Expected: `6 passed`

- [ ] **Step 7: Commit**

```bash
git add permissions/rbac_api.py core/urls.py permissions/test_rbac_engine.py
git commit -m "feat(rbac): add roles CRUD API endpoints with auth protection"
```

---

## Task 4: Employee Role Assignments + Overrides API

**Files:**
- Modify: `permissions/rbac_api.py` (append new schemas + endpoints)
- Modify: `permissions/test_rbac_engine.py` (append tests)

- [ ] **Step 1: Append assignment + override tests to `permissions/test_rbac_engine.py`**

```python
@pytest.mark.django_db
class TestEmployeeRoleAssignmentAPI:
    def test_assign_role_returns_201(self, sa_client, employee):
        role = Role.objects.create(name="HR Manager", service="auth")
        response = sa_client.post(
            "/api/permissions/rbac/employee-roles",
            data=f'{{"employee_id": "{employee.id}", "role_id": "{role.id}"}}',
            content_type="application/json",
        )
        assert response.status_code == 201
        assert EmployeeRole.objects.filter(employee=employee, role=role).exists()

    def test_assign_role_clears_cache(self, sa_client, employee):
        from django.core.cache import cache
        from permissions.rbac import _CACHE_KEY
        cache.set(_CACHE_KEY.format(str(employee.id)), [], 300)

        role = Role.objects.create(name="HR Manager", service="auth")
        sa_client.post(
            "/api/permissions/rbac/employee-roles",
            data=f'{{"employee_id": "{employee.id}", "role_id": "{role.id}"}}',
            content_type="application/json",
        )
        assert cache.get(_CACHE_KEY.format(str(employee.id))) is None

    def test_remove_role_assignment_returns_200(self, sa_client, employee):
        role = Role.objects.create(name="HR Manager", service="auth")
        er = EmployeeRole.objects.create(employee=employee, role=role)
        response = sa_client.delete(f"/api/permissions/rbac/employee-roles/{er.id}")
        assert response.status_code == 200
        assert EmployeeRole.objects.filter(pk=er.pk).count() == 0

    def test_assign_nonexistent_role_returns_404(self, sa_client, employee):
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = sa_client.post(
            "/api/permissions/rbac/employee-roles",
            data=f'{{"employee_id": "{employee.id}", "role_id": "{fake_id}"}}',
            content_type="application/json",
        )
        assert response.status_code == 404


@pytest.mark.django_db
class TestPermissionOverrideAPI:
    def test_create_allow_override_returns_201(self, sa_client, employee):
        perm = Permission.objects.create(codename="branch.create", name="Create Branch", service="auth")
        response = sa_client.post(
            "/api/permissions/rbac/overrides",
            data=f'{{"employee_id": "{employee.id}", "permission_codename": "branch.create", "is_allowed": true}}',
            content_type="application/json",
        )
        assert response.status_code == 201
        assert EmployeePermissionOverride.objects.filter(
            employee=employee, permission=perm, is_allowed=True
        ).exists()

    def test_create_override_clears_cache(self, sa_client, employee):
        from django.core.cache import cache
        from permissions.rbac import _CACHE_KEY
        cache.set(_CACHE_KEY.format(str(employee.id)), [], 300)

        perm = Permission.objects.create(codename="branch.create", name="Create Branch", service="auth")
        sa_client.post(
            "/api/permissions/rbac/overrides",
            data=f'{{"employee_id": "{employee.id}", "permission_codename": "branch.create", "is_allowed": true}}',
            content_type="application/json",
        )
        assert cache.get(_CACHE_KEY.format(str(employee.id))) is None

    def test_remove_override_returns_200(self, sa_client, employee):
        perm = Permission.objects.create(codename="branch.delete", name="Delete Branch", service="auth")
        override = EmployeePermissionOverride.objects.create(
            employee=employee, permission=perm, is_allowed=False
        )
        response = sa_client.delete(f"/api/permissions/rbac/overrides/{override.id}")
        assert response.status_code == 200
        assert EmployeePermissionOverride.objects.filter(pk=override.pk).count() == 0

    def test_create_override_nonexistent_permission_returns_404(self, sa_client, employee):
        response = sa_client.post(
            "/api/permissions/rbac/overrides",
            data=f'{{"employee_id": "{employee.id}", "permission_codename": "does.not.exist", "is_allowed": true}}',
            content_type="application/json",
        )
        assert response.status_code == 404
```

- [ ] **Step 2: Run tests — expect FAIL (404 — endpoints not yet added)**

```bash
docker exec auth_service python -m pytest permissions/test_rbac_engine.py::TestEmployeeRoleAssignmentAPI permissions/test_rbac_engine.py::TestPermissionOverrideAPI -v
```

Expected: All fail (404 or `AssertionError`)

- [ ] **Step 3: Append assignment + override schemas and endpoints to `permissions/rbac_api.py`**

Append after the existing Roles CRUD endpoints:

```python
# ── Schemas ───────────────────────────────────────────────────────────────────

class EmployeeRoleOut(Schema):
    id: str
    employee_id: str
    role_id: str
    role_name: str
    granted_at: str


class AssignRoleIn(Schema):
    employee_id: uuid.UUID
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


# ── Employee Role Assignments ─────────────────────────────────────────────────

@router.post(
    "/employee-roles",
    response={201: EmployeeRoleOut, 404: ErrorOut, 400: ErrorOut, 401: ErrorOut},
    auth=AuthBearer(),
)
def assign_role(request: HttpRequest, payload: AssignRoleIn):
    from employees.models import Employee
    try:
        employee = Employee.objects.get(pk=payload.employee_id, is_deleted=False)
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


@router.delete(
    "/employee-roles/{er_id}",
    response={200: MessageOut, 404: ErrorOut, 401: ErrorOut},
    auth=AuthBearer(),
)
def remove_role_assignment(request: HttpRequest, er_id: uuid.UUID):
    try:
        er = EmployeeRole.objects.get(pk=er_id)
    except EmployeeRole.DoesNotExist:
        return 404, {"error": "Assignment not found"}
    clear_permission_cache(str(er.employee_id))
    er.soft_delete()
    return 200, {"message": "Role assignment removed"}


# ── Permission Overrides ──────────────────────────────────────────────────────

@router.post(
    "/overrides",
    response={201: OverrideOut, 404: ErrorOut, 400: ErrorOut, 401: ErrorOut},
    auth=AuthBearer(),
)
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
    if EmployeePermissionOverride.objects.filter(
        employee=employee, permission=perm, is_deleted=False
    ).exists():
        return 400, {"error": "Override already exists for this employee + permission"}
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


@router.delete(
    "/overrides/{override_id}",
    response={200: MessageOut, 404: ErrorOut, 401: ErrorOut},
    auth=AuthBearer(),
)
def remove_override(request: HttpRequest, override_id: uuid.UUID):
    try:
        override = EmployeePermissionOverride.objects.get(pk=override_id)
    except EmployeePermissionOverride.DoesNotExist:
        return 404, {"error": "Override not found"}
    clear_permission_cache(str(override.employee_id))
    override.soft_delete()
    return 200, {"message": "Override removed"}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
docker exec auth_service python -m pytest permissions/test_rbac_engine.py::TestEmployeeRoleAssignmentAPI permissions/test_rbac_engine.py::TestPermissionOverrideAPI -v
```

Expected: `8 passed`

- [ ] **Step 5: Commit**

```bash
git add permissions/rbac_api.py permissions/test_rbac_engine.py
git commit -m "feat(rbac): add employee role assignment and permission override API endpoints"
```

---

## Task 5: Effective Permissions Endpoint

**Files:**
- Modify: `permissions/rbac_api.py` (append 1 endpoint)
- Modify: `permissions/test_rbac_engine.py` (append tests)

- [ ] **Step 1: Append effective permissions tests**

```python
@pytest.mark.django_db
class TestEffectivePermissionsAPI:
    def test_returns_effective_permissions_for_employee(self, sa_client, employee):
        perm = Permission.objects.create(codename="employee.view", name="View Employees", service="auth")
        role = Role.objects.create(name="Viewer", service="auth")
        role.permissions.add(perm)
        EmployeeRole.objects.create(employee=employee, role=role)

        response = sa_client.get(f"/api/permissions/rbac/effective-permissions/{employee.id}")
        assert response.status_code == 200
        data = response.json()
        assert "employee.view" in data["permissions"]

    def test_returns_empty_for_employee_without_roles(self, sa_client, employee):
        response = sa_client.get(f"/api/permissions/rbac/effective-permissions/{employee.id}")
        assert response.status_code == 200
        assert response.json()["permissions"] == []

    def test_superadmin_gets_all_permissions(self, sa_client, superadmin):
        Permission.objects.create(codename="employee.view", name="View", service="auth")
        response = sa_client.get(f"/api/permissions/rbac/effective-permissions/{superadmin.id}?is_superadmin=true")
        assert response.status_code == 200
        data = response.json()
        assert data["is_superadmin"] is True
        assert data["has_all_permissions"] is True

    def test_returns_404_for_nonexistent_employee(self, sa_client):
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = sa_client.get(f"/api/permissions/rbac/effective-permissions/{fake_id}")
        assert response.status_code == 404
```

- [ ] **Step 2: Run tests — expect FAIL (404 — endpoint missing)**

```bash
docker exec auth_service python -m pytest permissions/test_rbac_engine.py::TestEffectivePermissionsAPI -v
```

Expected: All fail with 404

- [ ] **Step 3: Append effective permissions endpoint to `permissions/rbac_api.py`**

Append after the override endpoints:

```python
# ── Effective Permissions ─────────────────────────────────────────────────────

class EffectivePermissionsOut(Schema):
    employee_id: str
    permissions: List[str]
    is_superadmin: bool = False
    has_all_permissions: bool = False


@router.get(
    "/effective-permissions/{target_id}",
    response={200: EffectivePermissionsOut, 404: ErrorOut, 401: ErrorOut},
    auth=AuthBearer(),
)
def get_effective_permissions_view(
    request: HttpRequest,
    target_id: uuid.UUID,
    is_superadmin: bool = False,
):
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
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
docker exec auth_service python -m pytest permissions/test_rbac_engine.py::TestEffectivePermissionsAPI -v
```

Expected: `4 passed`

- [ ] **Step 5: Run full M2 test suite**

```bash
docker exec auth_service python -m pytest permissions/test_rbac_engine.py -v
```

Expected: All tests pass (engine + decorator + roles API + assignments + overrides + effective-permissions)

- [ ] **Step 6: Run full permissions test suite (including M1)**

```bash
docker exec auth_service python -m pytest permissions/test_rbac_foundation.py permissions/test_rbac_engine.py -v
```

Expected: All 20 M1 tests + all M2 tests pass. Pre-existing failures in `permissions/tests.py` are unchanged (not our problem).

- [ ] **Step 7: System check**

```bash
docker exec auth_service python manage.py check
```

Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 8: Commit**

```bash
git add permissions/rbac_api.py permissions/test_rbac_engine.py
git commit -m "feat(rbac): add effective-permissions endpoint completing M2 API surface"
```

---

## Verification Checklist (M2 Acceptance Criteria)

```bash
# Full test suite
docker exec auth_service python -m pytest permissions/test_rbac_engine.py -v

# System clean
docker exec auth_service python manage.py check

# All 9 endpoints respond
docker exec auth_service python manage.py show_urls | grep rbac
```

- [ ] A: `has_permission(employee, codename)` uses correct formula: role perms ∪ allowed − denied
- [ ] A: `has_permission(superadmin, any)` always returns True
- [ ] B: `@require_permission` decorator returns 403 for unauthorized, passes through for authorized
- [ ] C: 9 endpoints functional: roles CRUD (4) + employee-roles (2) + overrides (2) + effective-permissions (1)
- [ ] D: SuperAdmin bypasses all permission checks
- [ ] E: Redis cache (5-min TTL) active — second call hits cache, `clear_permission_cache` invalidates it
- [ ] All write operations (assign, remove, override) call `clear_permission_cache` for affected employees
