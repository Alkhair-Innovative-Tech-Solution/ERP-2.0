from django.contrib import admin
from django.contrib.auth.models import Group
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from django.contrib import messages
from .models import User

# Unregister Group model
try:
    admin.site.unregister(Group)
except admin.sites.NotRegistered:
    pass

# Organization and SubscriptionPlan are managed via org-service admin (/org-admin/)


def soft_delete_users(modeladmin, request, queryset):
    """Mark selected users as deleted (is_deleted=True, is_active=False). Data is preserved."""
    updated = queryset.update(is_deleted=True, is_active=False)
    messages.success(request, f"{updated} user(s) soft deleted (data preserved, login disabled).")

soft_delete_users.short_description = "Soft Delete selected users (keep data, disable login)"


def _call_internal_delete(service_url, email, username, secret):
    """Call internal/delete-user/ on a downstream service. Returns (ok, message)."""
    import json, urllib.request, urllib.error
    payload = json.dumps({'email': email, 'username': username}).encode()
    try:
        req = urllib.request.Request(
            f'{service_url}/api/internal/delete-user/',
            data=payload,
            headers={'Content-Type': 'application/json', 'X-Internal-Secret': secret},
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            return True, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}: {e.read().decode()[:200]}"
    except Exception as e:
        return False, str(e)


def hard_delete_users(modeladmin, request, queryset):
    """Permanently delete selected users from auth DB and all downstream services."""
    import os
    secret = os.getenv('INTERNAL_SERVICE_SECRET', '')
    services = {
        'staff-service':   os.getenv('STAFF_SERVICE_URL',   'http://staff-service:8004'),
        'student-service': os.getenv('STUDENT_SERVICE_URL', 'http://student-service:8005'),
    }

    total = queryset.count()
    errors = []

    for user in queryset:
        # Notify each downstream service to delete this user + related data
        for svc_name, svc_url in services.items():
            ok, result = _call_internal_delete(svc_url, user.email, user.username, secret)
            if not ok:
                errors.append(f"{user.email} @ {svc_name}: {result}")

    # Hard delete from auth DB (after notifying services)
    queryset.delete()

    if errors:
        messages.warning(request, f"{total} user(s) deleted from auth DB. Some service errors: {'; '.join(errors)}")
    else:
        messages.success(request, f"{total} user(s) permanently deleted from auth DB and all services.")

hard_delete_users.short_description = "Hard Delete selected users (PERMANENT — removes from all services)"


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("email",)
    list_display = (
        "email",
        "username",
        "first_name",
        "last_name",
        "role",
        "is_staff",
        "is_superuser",
        "is_active",
        "is_deleted",
    )
    list_filter = ("role", "is_staff", "is_superuser", "is_active", "is_deleted")
    search_fields = ("email", "username", "first_name", "last_name")
    actions = [soft_delete_users, hard_delete_users]

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (_("Personal info"), {"fields": ("username", "first_name", "last_name", "phone_number")}),
        (
            _("Roles and access"),
            {"fields": ("role", "organization", "campus", "is_active", "is_staff", "is_superuser", "is_verified", "is_deleted")},
        ),
        (_("Important dates"), {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "username",
                    "role",
                    "password1",
                    "password2",
                    "is_staff",
                    "is_superuser",
                    "is_active",
                ),
            },
        ),
    )

    readonly_fields = ("last_login",)


import os as _os
_smod = _os.environ.get("DJANGO_SETTINGS_MODULE", "")
if not (_smod.startswith("auth_service") or _smod.startswith("org_service")):
    try:
        from django.contrib import admin as _admin
        from .models import User as _User
        _admin.site.unregister(_User)
    except Exception:
        pass

