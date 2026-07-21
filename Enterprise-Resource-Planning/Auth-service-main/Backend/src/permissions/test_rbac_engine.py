import pytest
from django.core.cache import cache
from permissions.models import Permission, Role, EmployeeRole, EmployeePermissionOverride
from permissions.rbac import get_effective_permissions, has_permission, clear_permission_cache, _CACHE_KEY


@pytest.fixture(autouse=True)
def clear_cache_before_each():
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
class TestGetEffectivePermissions:
    def test_no_roles_no_overrides_returns_empty(self, employee):
        assert get_effective_permissions(str(employee.id)) == set()

    def test_role_permissions_included(self, employee):
        perm = Permission.objects.create(codename="employee.view", name="View Employees", service="auth")
        role = Role.objects.create(name="Viewer", service="auth")
        role.permissions.add(perm)
        EmployeeRole.objects.create(employee=employee, role=role)
        assert "employee.view" in get_effective_permissions(str(employee.id))

    def test_allowed_override_grants_extra_permission(self, employee):
        perm = Permission.objects.create(codename="department.create", name="Create Dept", service="auth")
        EmployeePermissionOverride.objects.create(employee=employee, permission=perm, is_allowed=True)
        assert "department.create" in get_effective_permissions(str(employee.id))

    def test_denied_override_blocks_role_permission(self, employee):
        perm = Permission.objects.create(codename="employee.delete", name="Delete Employee", service="auth")
        role = Role.objects.create(name="Admin", service="auth")
        role.permissions.add(perm)
        EmployeeRole.objects.create(employee=employee, role=role)
        EmployeePermissionOverride.objects.create(employee=employee, permission=perm, is_allowed=False)
        assert "employee.delete" not in get_effective_permissions(str(employee.id))

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
        # Remove DB role — cache should still return it
        EmployeeRole.objects.filter(employee=employee).delete()
        assert "audit.view" in get_effective_permissions(str(employee.id))

    def test_clear_permission_cache_forces_recompute(self, employee):
        perm = Permission.objects.create(codename="audit.view", name="View Audit", service="auth")
        role = Role.objects.create(name="Auditor", service="auth")
        role.permissions.add(perm)
        EmployeeRole.objects.create(employee=employee, role=role)
        get_effective_permissions(str(employee.id))
        EmployeeRole.objects.filter(employee=employee).delete()
        clear_permission_cache(str(employee.id))
        assert "audit.view" not in get_effective_permissions(str(employee.id))


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


@pytest.mark.django_db
class TestRequirePermissionDecorator:
    def test_passes_when_employee_has_permission(self, employee):
        from ninja import Router as NinjaRouter
        from ninja.testing import TestClient as NinjaTestClient
        from permissions.decorators import require_permission
        from authentication.api import AuthBearer
        from authentication.jwt_utils import generate_access_token

        perm = Permission.objects.create(codename="employee.view", name="View Employees", service="auth")
        role = Role.objects.create(name="Viewer", service="auth")
        role.permissions.add(perm)
        EmployeeRole.objects.create(employee=employee, role=role)

        test_router = NinjaRouter()

        @test_router.get("/guarded", auth=AuthBearer())
        @require_permission("employee.view")
        def guarded(request):
            return {"ok": True}

        token = generate_access_token(employee)
        client = NinjaTestClient(test_router)
        response = client.get("/guarded", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200

    def test_returns_403_when_employee_lacks_permission(self, employee):
        from ninja import Router as NinjaRouter
        from ninja.testing import TestClient as NinjaTestClient
        from permissions.decorators import require_permission
        from authentication.api import AuthBearer
        from authentication.jwt_utils import generate_access_token

        test_router = NinjaRouter()

        @test_router.get("/guarded", auth=AuthBearer())
        @require_permission("employee.delete")
        def guarded(request):
            return {"ok": True}

        token = generate_access_token(employee)
        client = NinjaTestClient(test_router)
        response = client.get("/guarded", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 403

    def test_superadmin_bypasses_check(self, superadmin):
        from ninja import Router as NinjaRouter
        from ninja.testing import TestClient as NinjaTestClient
        from permissions.decorators import require_permission
        from authentication.api import AuthBearer
        from authentication.jwt_utils import generate_access_token

        test_router = NinjaRouter()

        @test_router.get("/guarded", auth=AuthBearer())
        @require_permission("employee.delete")
        def guarded(request):
            return {"ok": True}

        token = generate_access_token(superadmin)
        client = NinjaTestClient(test_router)
        response = client.get("/guarded", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200


@pytest.fixture
def sa_client(db, superadmin):
    from authentication.jwt_utils import generate_access_token
    from django.test import Client as DjangoClient
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
        assert any(r["name"] == "HR Manager" for r in response.json()["roles"])

    def test_create_role_returns_201(self, sa_client):
        response = sa_client.post(
            "/api/permissions/rbac/roles",
            data='{"name": "Finance Admin", "service": "auth", "description": ""}',
            content_type="application/json",
        )
        assert response.status_code == 201
        assert Role.objects.filter(name="Finance Admin").exists()

    def test_create_role_with_permissions(self, sa_client):
        Permission.objects.create(codename="branch.view", name="View Branch", service="auth")
        response = sa_client.post(
            "/api/permissions/rbac/roles",
            data='{"name": "Branch Viewer", "service": "auth", "description": "", "permission_codenames": ["branch.view"]}',
            content_type="application/json",
        )
        assert response.status_code == 201
        assert Role.objects.get(name="Branch Viewer").permissions.filter(codename="branch.view").exists()

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
        from django.test import Client as DjangoClient
        response = DjangoClient().get("/api/permissions/rbac/roles")
        assert response.status_code == 401


@pytest.mark.django_db
class TestEmployeeRoleAssignmentAPI:
    def test_assign_role_returns_201(self, sa_client, employee):
        role = Role.objects.create(name="HR Manager", service="auth")
        response = sa_client.post(
            "/api/permissions/rbac/employee-roles",
            data=f'{{"employee_id": "{employee.employee_id}", "role_id": "{role.id}"}}',
            content_type="application/json",
        )
        assert response.status_code == 201
        assert EmployeeRole.objects.filter(employee=employee, role=role).exists()

    def test_assign_role_clears_cache(self, sa_client, employee):
        from django.core.cache import cache
        cache.set(_CACHE_KEY.format(str(employee.id)), [], 300)
        role = Role.objects.create(name="HR Manager", service="auth")
        sa_client.post(
            "/api/permissions/rbac/employee-roles",
            data=f'{{"employee_id": "{employee.employee_id}", "role_id": "{role.id}"}}',
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
            data=f'{{"employee_id": "{employee.employee_id}", "role_id": "{fake_id}"}}',
            content_type="application/json",
        )
        assert response.status_code == 404


@pytest.mark.django_db
class TestPermissionOverrideAPI:
    def test_create_allow_override_returns_201(self, sa_client, employee):
        Permission.objects.create(codename="branch.create", name="Create Branch", service="auth")
        response = sa_client.post(
            "/api/permissions/rbac/overrides",
            data=f'{{"employee_id": "{employee.id}", "permission_codename": "branch.create", "is_allowed": true}}',
            content_type="application/json",
        )
        assert response.status_code == 201

    def test_create_override_clears_cache(self, sa_client, employee):
        from django.core.cache import cache
        cache.set(_CACHE_KEY.format(str(employee.id)), [], 300)
        Permission.objects.create(codename="branch.create", name="Create Branch", service="auth")
        sa_client.post(
            "/api/permissions/rbac/overrides",
            data=f'{{"employee_id": "{employee.id}", "permission_codename": "branch.create", "is_allowed": true}}',
            content_type="application/json",
        )
        assert cache.get(_CACHE_KEY.format(str(employee.id))) is None

    def test_remove_override_returns_200(self, sa_client, employee):
        perm = Permission.objects.create(codename="branch.delete", name="Delete Branch", service="auth")
        override = EmployeePermissionOverride.objects.create(employee=employee, permission=perm, is_allowed=False)
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


@pytest.mark.django_db
class TestEffectivePermissionsAPI:
    def test_returns_permissions_for_employee(self, sa_client, employee):
        perm = Permission.objects.create(codename="employee.view", name="View Employees", service="auth")
        role = Role.objects.create(name="Viewer", service="auth")
        role.permissions.add(perm)
        EmployeeRole.objects.create(employee=employee, role=role)
        response = sa_client.get(f"/api/permissions/rbac/effective-permissions/{employee.id}")
        assert response.status_code == 200
        assert "employee.view" in response.json()["permissions"]

    def test_returns_empty_for_employee_without_roles(self, sa_client, employee):
        response = sa_client.get(f"/api/permissions/rbac/effective-permissions/{employee.id}")
        assert response.status_code == 200
        assert response.json()["permissions"] == []

    def test_superadmin_flag_returns_all_permissions(self, sa_client, superadmin):
        Permission.objects.create(codename="employee.view", name="View", service="auth")
        response = sa_client.get(
            f"/api/permissions/rbac/effective-permissions/{superadmin.id}?is_superadmin=true"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_superadmin"] is True
        assert data["has_all_permissions"] is True

    def test_returns_404_for_nonexistent_employee(self, sa_client):
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = sa_client.get(f"/api/permissions/rbac/effective-permissions/{fake_id}")
        assert response.status_code == 404


@pytest.mark.django_db
class TestPermissionsListAPI:
    def test_list_permissions_returns_all(self, sa_client):
        Permission.objects.create(codename="employee.view", name="View Employees", service="auth")
        Permission.objects.create(codename="branch.view", name="View Branches", service="auth")
        response = sa_client.get("/api/permissions/rbac/permissions")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] >= 2
        codenames = [p["codename"] for p in data["permissions"]]
        assert "employee.view" in codenames

    def test_list_permissions_filter_by_service(self, sa_client):
        Permission.objects.create(codename="employee.view", name="View Employees", service="auth")
        Permission.objects.create(codename="ticket.view", name="View Tickets", service="hdms")
        response = sa_client.get("/api/permissions/rbac/permissions?service=auth")
        assert response.status_code == 200
        for p in response.json()["permissions"]:
            assert p["service"] == "auth"


@pytest.mark.django_db
class TestRoleDetailAPI:
    def test_get_role_detail_returns_permission_codenames(self, sa_client):
        perm = Permission.objects.create(codename="branch.view", name="View Branch", service="auth")
        role = Role.objects.create(name="Viewer", service="auth")
        role.permissions.add(perm)
        response = sa_client.get(f"/api/permissions/rbac/roles/{role.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Viewer"
        assert "branch.view" in data["permission_codenames"]

    def test_get_role_detail_404_on_missing(self, sa_client):
        response = sa_client.get("/api/permissions/rbac/roles/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 404


@pytest.mark.django_db
class TestEmployeeRolesListAPI:
    def test_list_all_employee_roles(self, sa_client, employee):
        role = Role.objects.create(name="HR Manager", service="auth")
        EmployeeRole.objects.create(employee=employee, role=role)
        response = sa_client.get("/api/permissions/rbac/employee-roles")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] >= 1

    def test_filter_by_employee_id(self, sa_client, employee):
        role = Role.objects.create(name="HR Manager", service="auth")
        EmployeeRole.objects.create(employee=employee, role=role)
        response = sa_client.get(f"/api/permissions/rbac/employee-roles?employee_id={employee.id}")
        assert response.status_code == 200
        results = response.json()["assignments"]
        assert all(r["employee_id"] == str(employee.id) for r in results)

    def test_list_roles_service_filter(self, sa_client):
        Role.objects.create(name="Auth Role", service="auth")
        Role.objects.create(name="HDMS Role", service="hdms")
        response = sa_client.get("/api/permissions/rbac/roles?service=auth")
        assert response.status_code == 200
        for r in response.json()["roles"]:
            assert r["service"] == "auth"


@pytest.mark.django_db
class TestRBACAuthorizationGuard:
    """Regular employees must not access any RBAC management endpoint."""

    def test_employee_cannot_list_roles(self, auth_client):
        client, _ = auth_client
        assert client.get("/api/permissions/rbac/roles").status_code == 401

    def test_employee_cannot_create_role(self, auth_client):
        client, _ = auth_client
        response = client.post(
            "/api/permissions/rbac/roles",
            data='{"name": "Evil Role", "service": "auth", "description": ""}',
            content_type="application/json",
        )
        assert response.status_code == 401

    def test_employee_cannot_assign_role(self, auth_client, employee):
        client, _ = auth_client
        role = Role.objects.create(name="HR Manager", service="auth")
        response = client.post(
            "/api/permissions/rbac/employee-roles",
            data=f'{{"employee_id": "{employee.employee_id}", "role_id": "{role.id}"}}',
            content_type="application/json",
        )
        assert response.status_code == 401

    def test_employee_cannot_create_override(self, auth_client, employee):
        client, _ = auth_client
        Permission.objects.create(codename="branch.create", name="Create Branch", service="auth")
        response = client.post(
            "/api/permissions/rbac/overrides",
            data=f'{{"employee_id": "{employee.id}", "permission_codename": "branch.create", "is_allowed": true}}',
            content_type="application/json",
        )
        assert response.status_code == 401

    def test_unauthenticated_cannot_access(self):
        from django.test import Client as DjangoClient
        c = DjangoClient()
        assert c.get("/api/permissions/rbac/roles").status_code == 401
        assert c.get("/api/permissions/rbac/permissions").status_code == 401
        assert c.get("/api/permissions/rbac/employee-roles").status_code == 401
