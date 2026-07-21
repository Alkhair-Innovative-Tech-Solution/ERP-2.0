import pytest
from django.core.exceptions import ValidationError
from permissions.models import Permission, Role, EmployeeRole, EmployeePermissionOverride


@pytest.mark.django_db
class TestPermissionModel:
    def test_create_permission(self):
        perm = Permission.objects.create(
            codename="employee.create",
            name="Create Employee",
            service="auth",
        )
        assert perm.pk is not None
        assert str(perm) == "auth / employee.create"

    def test_codename_is_unique(self):
        Permission.objects.create(codename="employee.create", name="Create Employee", service="auth")
        with pytest.raises(Exception):
            Permission.objects.create(codename="employee.create", name="Duplicate", service="auth")

    def test_default_description_is_empty(self):
        perm = Permission.objects.create(codename="employee.edit", name="Edit Employee", service="auth")
        assert perm.description == ""


@pytest.mark.django_db
class TestRoleModel:
    def test_create_role(self):
        role = Role.objects.create(name="HR Manager", service="auth")
        assert role.pk is not None
        assert str(role) == "auth / HR Manager"

    def test_role_permissions_m2m(self):
        perm1 = Permission.objects.create(codename="employee.create", name="Create Employee", service="auth")
        perm2 = Permission.objects.create(codename="employee.edit", name="Edit Employee", service="auth")
        role = Role.objects.create(name="HR Manager", service="auth")
        role.permissions.set([perm1, perm2])
        assert role.permissions.count() == 2

    def test_role_unique_per_service(self):
        Role.objects.create(name="HR Manager", service="auth")
        with pytest.raises(Exception):
            Role.objects.create(name="HR Manager", service="auth")

    def test_role_soft_delete(self):
        role = Role.objects.create(name="HR Manager", service="auth")
        role.soft_delete()
        assert Role.objects.filter(pk=role.pk).count() == 0
        assert Role.all_objects.filter(pk=role.pk).count() == 1

    def test_is_default_false_by_default(self):
        role = Role.objects.create(name="Viewer", service="auth")
        assert role.is_default is False


@pytest.mark.django_db
class TestEmployeeRoleModel:
    def test_assign_global_role(self, employee):
        role = Role.objects.create(name="HR Manager", service="auth")
        er = EmployeeRole.objects.create(employee=employee, role=role)
        assert er.pk is not None
        assert er.scope_content_type is None
        assert er.scope_object_id is None

    def test_str_shows_global(self, employee):
        role = Role.objects.create(name="HR Manager", service="auth")
        er = EmployeeRole.objects.create(employee=employee, role=role)
        assert "(global)" in str(er)

    def test_duplicate_role_assignment_raises(self, employee):
        role = Role.objects.create(name="HR Manager", service="auth")
        EmployeeRole.objects.create(employee=employee, role=role)
        with pytest.raises(ValidationError):
            EmployeeRole(employee=employee, role=role).full_clean()

    def test_soft_delete_role_assignment(self, employee):
        role = Role.objects.create(name="HR Manager", service="auth")
        er = EmployeeRole.objects.create(employee=employee, role=role)
        er.soft_delete()
        assert EmployeeRole.objects.filter(pk=er.pk).count() == 0
        assert EmployeeRole.all_objects.filter(pk=er.pk).count() == 1


@pytest.mark.django_db
class TestEmployeePermissionOverrideModel:
    def test_create_allow_override(self, employee):
        perm = Permission.objects.create(
            codename="department.create", name="Create Department", service="auth"
        )
        override = EmployeePermissionOverride.objects.create(
            employee=employee, permission=perm, is_allowed=True
        )
        assert override.is_allowed is True
        assert "ALLOW" in str(override)

    def test_create_deny_override(self, employee):
        perm = Permission.objects.create(
            codename="employee.delete", name="Delete Employee", service="auth"
        )
        override = EmployeePermissionOverride.objects.create(
            employee=employee, permission=perm, is_allowed=False
        )
        assert override.is_allowed is False
        assert "DENY" in str(override)

    def test_duplicate_override_raises(self, employee):
        perm = Permission.objects.create(
            codename="employee.delete", name="Delete Employee", service="auth"
        )
        EmployeePermissionOverride.objects.create(employee=employee, permission=perm, is_allowed=False)
        with pytest.raises(ValidationError):
            EmployeePermissionOverride(employee=employee, permission=perm, is_allowed=True).full_clean()

    def test_scope_fields_null_by_default(self, employee):
        perm = Permission.objects.create(codename="branch.create", name="Create Branch", service="auth")
        override = EmployeePermissionOverride.objects.create(
            employee=employee, permission=perm, is_allowed=True
        )
        assert override.scope_content_type is None
        assert override.scope_object_id is None


@pytest.mark.django_db
class TestSeedPermissionsCommand:
    def test_creates_30_permissions(self):
        from django.core.management import call_command
        call_command("seed_permissions", verbosity=0)
        assert Permission.objects.count() == 30

    def test_idempotent_run_twice(self):
        from django.core.management import call_command
        call_command("seed_permissions", verbosity=0)
        call_command("seed_permissions", verbosity=0)
        assert Permission.objects.count() == 30

    def test_all_expected_codenames_exist(self):
        from django.core.management import call_command
        call_command("seed_permissions", verbosity=0)
        expected = {
            "employee.view", "employee.create", "employee.edit", "employee.delete",
            "assignment.create", "assignment.edit", "assignment.delete",
            "organization.view",
            "institution.view", "institution.create", "institution.edit", "institution.delete",
            "branch.view", "branch.create", "branch.edit", "branch.delete",
            "department.view", "department.create", "department.edit", "department.delete",
            "designation.view", "designation.create", "designation.edit", "designation.delete",
            "service_access.view", "service_access.grant", "service_access.toggle",
            "role.view", "role.manage",
            "audit.view",
        }
        actual = set(Permission.objects.values_list("codename", flat=True))
        assert expected == actual

    def test_all_permissions_have_service_auth(self):
        from django.core.management import call_command
        call_command("seed_permissions", verbosity=0)
        assert Permission.objects.exclude(service="auth").count() == 0
