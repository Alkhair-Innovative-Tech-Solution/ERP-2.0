# RBAC M1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 new RBAC models (Permission, Role, EmployeeRole, EmployeePermissionOverride) to the permissions app, generate a clean migration, seed Auth-service permissions via an idempotent management command, and register all models in Django admin.

**Architecture:** 4 new tables added to the existing `permissions` app — no changes to Service, ServiceAccess, HdmsRole, VmsRole, or PermissionAudit. Permission is a plain model (engineering-defined, immutable at runtime). Role, EmployeeRole, EmployeePermissionOverride all extend SoftDeleteModel for audit history. Scope fields (GenericFK pair) are present but always null in MVP — Phase 2 will fill them for branch/institution scoping without a model rewrite.

**Tech Stack:** Django 5, PostgreSQL, pytest + pytest-django, django.contrib.contenttypes (already installed), django-redis (already configured), Django admin.

**Save plan to:** `Auth-service/docs/superpowers/plans/2026-06-12-rbac-m1-foundation.md`

---

## Codebase Context (read before starting)

- All commands run from: `Auth-service/Backend/src/`
- Permissions app: `Auth-service/Backend/src/permissions/`
- SoftDeleteModel in: `Auth-service/Backend/src/employees/utils.py`
  - Fields: `is_deleted`, `deleted_at`, `deleted_by` (UUIDField, NOT FK), `deletion_reason`, `created_at`, `updated_at`
  - Managers: `objects` (excludes deleted), `all_objects` (includes deleted)
  - Methods: `soft_delete(deleted_by=None, reason=None)`, `restore()`, `hard_delete()`
- Existing migrations: 0001–0006. Next will be 0007.
- Test runner: `pytest` (from `src/` directory). Config in `pytest.ini`.
- Existing tests in `permissions/tests.py` — do NOT modify that file.
- `django.contrib.contenttypes` is already in INSTALLED_APPS.
- Employee model imported as: `from employees.models import Employee`

---

## File Map

| Action | Path |
|--------|------|
| Modify | `permissions/models.py` — append 4 new model classes |
| Create | `permissions/tests_rbac_foundation.py` — all M1 tests |
| Create | `permissions/management/__init__.py` |
| Create | `permissions/management/commands/__init__.py` |
| Create | `permissions/management/commands/seed_permissions.py` |
| Modify | `permissions/admin.py` — register 4 new models |
| Auto-generate | `permissions/migrations/0007_rbac_foundation.py` |

---

## Task 1: Permission Model

**Files:**
- Modify: `permissions/models.py`
- Create: `permissions/tests_rbac_foundation.py`

- [ ] **Step 1: Create test file with Permission tests**

Create `permissions/tests_rbac_foundation.py`:

```python
import pytest
from permissions.models import Permission


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
```

- [ ] **Step 2: Run test — expect FAIL (ImportError)**

```bash
pytest permissions/tests_rbac_foundation.py::TestPermissionModel -v
```

Expected: `ImportError: cannot import name 'Permission' from 'permissions.models'`

- [ ] **Step 3: Add Permission model to models.py**

Append to the bottom of `permissions/models.py` (after PermissionAudit class):

```python
class Permission(models.Model):
    """Named action within a service. Defined by engineering via seed_permissions command."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    codename = models.CharField(max_length=100, unique=True, help_text="e.g. 'employee.create'")
    name = models.CharField(max_length=200, help_text="e.g. 'Create Employee'")
    service = models.CharField(max_length=20, help_text="Service code this permission belongs to")
    description = models.TextField(blank=True, default="")

    class Meta:
        db_table = "permissions_rbac_permission"
        ordering = ["service", "codename"]

    def __str__(self):
        return f"{self.service} / {self.codename}"
```

- [ ] **Step 4: Generate migration**

```bash
python manage.py makemigrations permissions --name=rbac_permission
```

Expected output: `Migrations for 'permissions': permissions/migrations/0007_rbac_permission.py`

- [ ] **Step 5: Run test — expect PASS**

```bash
pytest permissions/tests_rbac_foundation.py::TestPermissionModel -v
```

Expected: `3 passed`

- [ ] **Step 6: Commit**

```bash
git add permissions/models.py permissions/migrations/0007_rbac_permission.py permissions/tests_rbac_foundation.py
git commit -m "feat(rbac): add Permission model and tests"
```

---

## Task 2: Role Model

**Files:**
- Modify: `permissions/models.py`
- Modify: `permissions/tests_rbac_foundation.py`

- [ ] **Step 1: Add Role tests to test file**

Append to `permissions/tests_rbac_foundation.py`:

```python
from permissions.models import Permission, Role


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
```

- [ ] **Step 2: Run new tests — expect FAIL (ImportError)**

```bash
pytest permissions/tests_rbac_foundation.py::TestRoleModel -v
```

Expected: `ImportError: cannot import name 'Role' from 'permissions.models'`

- [ ] **Step 3: Add Role model to models.py**

Append after the `Permission` class in `permissions/models.py`:

```python
class Role(SoftDeleteModel):
    """Named bundle of permissions. Created and managed by admins at runtime."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, help_text="e.g. 'HR Manager'")
    service = models.CharField(max_length=20, help_text="Service code this role applies to")
    is_default = models.BooleanField(default=False, help_text="Pre-seeded default role")
    description = models.TextField(blank=True, default="")
    permissions = models.ManyToManyField(
        Permission,
        blank=True,
        related_name="roles",
        help_text="Permissions bundled into this role",
    )

    class Meta:
        db_table = "permissions_rbac_role"
        unique_together = [("name", "service")]
        ordering = ["service", "name"]

    def __str__(self):
        return f"{self.service} / {self.name}"
```

- [ ] **Step 4: Generate migration**

```bash
python manage.py makemigrations permissions --name=rbac_role
```

Expected: `permissions/migrations/0008_rbac_role.py`

- [ ] **Step 5: Run tests — expect PASS**

```bash
pytest permissions/tests_rbac_foundation.py::TestRoleModel -v
```

Expected: `5 passed`

- [ ] **Step 6: Commit**

```bash
git add permissions/models.py permissions/migrations/0008_rbac_role.py permissions/tests_rbac_foundation.py
git commit -m "feat(rbac): add Role model with M2M permissions and tests"
```

---

## Task 3: EmployeeRole + EmployeePermissionOverride Models

**Files:**
- Modify: `permissions/models.py`
- Modify: `permissions/tests_rbac_foundation.py`

- [ ] **Step 1: Add tests for both models**

Append to `permissions/tests_rbac_foundation.py`:

```python
from permissions.models import Permission, Role, EmployeeRole, EmployeePermissionOverride
from django.core.exceptions import ValidationError


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
```

- [ ] **Step 2: Run new tests — expect FAIL (ImportError)**

```bash
pytest permissions/tests_rbac_foundation.py::TestEmployeeRoleModel permissions/tests_rbac_foundation.py::TestEmployeePermissionOverrideModel -v
```

Expected: `ImportError: cannot import name 'EmployeeRole' from 'permissions.models'`

- [ ] **Step 3: Add EmployeeRole model to models.py**

Append after `Role` class in `permissions/models.py`. Add this import at the top of the file if not present:
`from django.contrib.contenttypes.fields import GenericForeignKey` and
`from django.contrib.contenttypes.models import ContentType` and
`from django.core.exceptions import ValidationError`

```python
class EmployeeRole(SoftDeleteModel):
    """Assignment of a role to an employee. scope null = global (applies to all services)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="employee_roles",
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name="employee_roles",
    )
    # Phase 2: fill these to restrict role to a specific Branch or Institution.
    # MVP: always null (global).
    scope_content_type = models.ForeignKey(
        "contenttypes.ContentType",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    scope_object_id = models.UUIDField(null=True, blank=True)
    granted_by = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="granted_employee_roles",
    )
    granted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "permissions_rbac_employee_role"

    def clean(self):
        qs = EmployeeRole.objects.filter(
            employee=self.employee,
            role=self.role,
            scope_content_type=self.scope_content_type,
            scope_object_id=self.scope_object_id,
        )
        if self.pk:
            qs = qs.exclude(pk=self.pk)
        if qs.exists():
            raise ValidationError("Employee already has this role at this scope.")

    def __str__(self):
        scope = f" @ {self.scope_object_id}" if self.scope_object_id else " (global)"
        return f"{self.employee} → {self.role}{scope}"
```

- [ ] **Step 4: Add EmployeePermissionOverride model to models.py**

Append after `EmployeeRole` class:

```python
class EmployeePermissionOverride(SoftDeleteModel):
    """Per-employee permission grant or block that overrides their role defaults."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="permission_overrides",
    )
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        related_name="employee_overrides",
    )
    is_allowed = models.BooleanField(
        help_text="True = grant extra permission. False = block permission from role."
    )
    # Phase 2: scope restricts this override to a Branch or Institution.
    # MVP: always null (global).
    scope_content_type = models.ForeignKey(
        "contenttypes.ContentType",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    scope_object_id = models.UUIDField(null=True, blank=True)
    granted_by = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="granted_permission_overrides",
    )
    granted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "permissions_rbac_employee_permission_override"

    def clean(self):
        qs = EmployeePermissionOverride.objects.filter(
            employee=self.employee,
            permission=self.permission,
            scope_content_type=self.scope_content_type,
            scope_object_id=self.scope_object_id,
        )
        if self.pk:
            qs = qs.exclude(pk=self.pk)
        if qs.exists():
            raise ValidationError("Employee already has an override for this permission at this scope.")

    def __str__(self):
        action = "ALLOW" if self.is_allowed else "DENY"
        return f"{action}: {self.employee} → {self.permission}"
```

- [ ] **Step 5: Generate migration for both new models**

```bash
python manage.py makemigrations permissions --name=rbac_employee_role_and_override
```

Expected: `permissions/migrations/0009_rbac_employee_role_and_override.py`

- [ ] **Step 6: Run all model tests — expect PASS**

```bash
pytest permissions/tests_rbac_foundation.py -v
```

Expected: all tests in TestPermissionModel, TestRoleModel, TestEmployeeRoleModel, TestEmployeePermissionOverrideModel pass.

- [ ] **Step 7: Verify existing tests still pass**

```bash
pytest permissions/tests.py -v
```

Expected: all 11 pre-existing tests still pass.

- [ ] **Step 8: Commit**

```bash
git add permissions/models.py permissions/migrations/0009_rbac_employee_role_and_override.py permissions/tests_rbac_foundation.py
git commit -m "feat(rbac): add EmployeeRole and EmployeePermissionOverride models with tests"
```

---

## Task 4: seed_permissions Management Command

**Files:**
- Create: `permissions/management/__init__.py`
- Create: `permissions/management/commands/__init__.py`
- Create: `permissions/management/commands/seed_permissions.py`
- Modify: `permissions/tests_rbac_foundation.py`

- [ ] **Step 1: Add seed command tests**

Append to `permissions/tests_rbac_foundation.py`:

```python
from django.core.management import call_command
from permissions.models import Permission


@pytest.mark.django_db
class TestSeedPermissionsCommand:
    def test_creates_12_permissions(self):
        call_command("seed_permissions", verbosity=0)
        assert Permission.objects.count() == 12

    def test_idempotent_run_twice(self):
        call_command("seed_permissions", verbosity=0)
        call_command("seed_permissions", verbosity=0)
        assert Permission.objects.count() == 12

    def test_all_expected_codenames_exist(self):
        call_command("seed_permissions", verbosity=0)
        expected = {
            "employee.create", "employee.edit", "employee.delete",
            "department.create", "department.edit", "branch.create",
            "institution.create", "service_access.grant", "service_access.revoke",
            "role.manage", "designation.create", "organization.manage",
        }
        actual = set(Permission.objects.values_list("codename", flat=True))
        assert expected == actual

    def test_all_permissions_have_service_auth(self):
        call_command("seed_permissions", verbosity=0)
        non_auth = Permission.objects.exclude(service="auth").count()
        assert non_auth == 0
```

- [ ] **Step 2: Run tests — expect FAIL (no management command)**

```bash
pytest permissions/tests_rbac_foundation.py::TestSeedPermissionsCommand -v
```

Expected: `CommandError` or `django.core.management.base.SystemCheckError` — command not found.

- [ ] **Step 3: Create management command directory structure**

```bash
touch permissions/management/__init__.py
mkdir -p permissions/management/commands
touch permissions/management/commands/__init__.py
```

- [ ] **Step 4: Create the seed command**

Create `permissions/management/commands/seed_permissions.py`:

```python
from django.core.management.base import BaseCommand
from permissions.models import Permission

AUTH_PERMISSIONS = [
    {"codename": "employee.create",       "name": "Create Employee"},
    {"codename": "employee.edit",         "name": "Edit Employee"},
    {"codename": "employee.delete",       "name": "Delete Employee"},
    {"codename": "department.create",     "name": "Create Department"},
    {"codename": "department.edit",       "name": "Edit Department"},
    {"codename": "branch.create",         "name": "Create Branch"},
    {"codename": "institution.create",    "name": "Create Institution"},
    {"codename": "service_access.grant",  "name": "Grant Service Access"},
    {"codename": "service_access.revoke", "name": "Revoke Service Access"},
    {"codename": "role.manage",           "name": "Manage Roles"},
    {"codename": "designation.create",    "name": "Create Designation"},
    {"codename": "organization.manage",   "name": "Manage Organization"},
]


class Command(BaseCommand):
    help = "Seed Auth-service permissions. Idempotent — safe to run multiple times."

    def handle(self, *args, **options):
        created_count = 0
        for entry in AUTH_PERMISSIONS:
            _, created = Permission.objects.get_or_create(
                codename=entry["codename"],
                defaults={"name": entry["name"], "service": "auth"},
            )
            if created:
                created_count += 1
                self.stdout.write(f"  Created: {entry['codename']}")
            else:
                self.stdout.write(f"  Exists:  {entry['codename']}")

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone. {created_count} new, {len(AUTH_PERMISSIONS) - created_count} already existed."
            )
        )
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
pytest permissions/tests_rbac_foundation.py::TestSeedPermissionsCommand -v
```

Expected: `4 passed`

- [ ] **Step 6: Verify command runs interactively**

```bash
python manage.py seed_permissions
```

Expected output:
```
  Created: employee.create
  Created: employee.edit
  ...
Done. 12 new, 0 already existed.
```

Run again:
```bash
python manage.py seed_permissions
```

Expected output:
```
  Exists:  employee.create
  ...
Done. 0 new, 12 already existed.
```

- [ ] **Step 7: Commit**

```bash
git add permissions/management/ permissions/tests_rbac_foundation.py
git commit -m "feat(rbac): add seed_permissions management command with idempotency tests"
```

---

## Task 5: Admin Registration

**Files:**
- Modify: `permissions/admin.py`

- [ ] **Step 1: Add imports to admin.py**

Add to the imports at the top of `permissions/admin.py`:

```python
from permissions.models import (
    Service, ServiceAccess, HdmsRole, VmsRole, PermissionAudit,
    Permission, Role, EmployeeRole, EmployeePermissionOverride,
)
```

- [ ] **Step 2: Append 4 new admin classes to admin.py**

```python
@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ["codename", "name", "service"]
    list_filter = ["service"]
    search_fields = ["codename", "name"]
    ordering = ["service", "codename"]
    readonly_fields = ["codename", "service"]


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ["name", "service", "is_default", "permission_count"]
    list_filter = ["service", "is_default"]
    search_fields = ["name"]
    filter_horizontal = ["permissions"]

    def permission_count(self, obj):
        return obj.permissions.count()
    permission_count.short_description = "# Permissions"


@admin.register(EmployeeRole)
class EmployeeRoleAdmin(admin.ModelAdmin):
    list_display = ["employee", "role", "granted_by", "granted_at"]
    list_filter = ["role__service"]
    search_fields = ["employee__full_name", "role__name"]
    raw_id_fields = ["employee", "role", "granted_by"]
    readonly_fields = ["granted_at"]


@admin.register(EmployeePermissionOverride)
class EmployeePermissionOverrideAdmin(admin.ModelAdmin):
    list_display = ["employee", "permission", "is_allowed", "granted_by", "granted_at"]
    list_filter = ["is_allowed", "permission__service"]
    search_fields = ["employee__full_name", "permission__codename"]
    raw_id_fields = ["employee", "permission", "granted_by"]
    readonly_fields = ["granted_at"]
```

- [ ] **Step 3: Verify admin loads without errors**

```bash
python manage.py check
```

Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 4: Run full test suite**

```bash
pytest permissions/ -v
```

Expected: all tests in `tests.py` (11 pre-existing) + all tests in `tests_rbac_foundation.py` pass.

- [ ] **Step 5: Commit**

```bash
git add permissions/admin.py
git commit -m "feat(rbac): register Permission, Role, EmployeeRole, EmployeePermissionOverride in admin"
```

---

## Verification Checklist (M1 Acceptance Criteria)

Run after all tasks complete:

```bash
# All tests pass
pytest permissions/ -v

# Migrations are clean
python manage.py migrate --check

# System check clean
python manage.py check

# Seed command idempotent
python manage.py seed_permissions
python manage.py seed_permissions
```

Expected state:
- [ ] 4 new models exist with correct fields and `__str__`
- [ ] 3 new migration files (0007, 0008, 0009) apply cleanly
- [ ] `seed_permissions` run twice → exactly 12 Permission rows, no duplicates
- [ ] All 11 pre-existing `permissions/tests.py` tests still pass
- [ ] `python manage.py check` → 0 issues
