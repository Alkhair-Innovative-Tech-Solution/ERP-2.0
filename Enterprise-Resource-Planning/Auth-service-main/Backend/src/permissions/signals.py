from django.db.models.signals import m2m_changed
from django.dispatch import receiver


@receiver(m2m_changed, sender="permissions.Role_permissions")
def clear_cache_on_role_permission_change(sender, instance, action, **kwargs):
    """
    Fires whenever Role.permissions M2M changes (add, remove, clear).
    Clears Redis permission cache for every employee assigned to that role.
    Covers Django admin edits, API changes, and any direct ORM calls.
    """
    if action not in ("post_add", "post_remove", "post_clear"):
        return

    from permissions.models import EmployeeRole
    from permissions.rbac import clear_permission_cache

    for er in EmployeeRole.objects.filter(role=instance, is_deleted=False):
        clear_permission_cache(str(er.employee_id))
