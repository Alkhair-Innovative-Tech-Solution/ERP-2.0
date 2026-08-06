"""
Shared tenant-scoping base for models that belong to a tenant.

Reusable template: entirely generic — filters/stamps by a `tenant_id`
column. To onboard another service: copy this file unchanged, then on
each tenant-owned model add `tenant_id = models.UUIDField(null=True,
blank=True, db_index=True)` and `objects = TenantManager()`.

Views scope reads with `Model.objects.for_tenant(request.user.tenant_id)`
instead of `Model.objects.all()/.filter()`, and stamp `tenant_id=request.user.tenant_id`
on every `.objects.create(...)` — the filtering *logic* lives here once,
not reimplemented per view.
"""
from django.db import models


class TenantQuerySet(models.QuerySet):
    def for_tenant(self, tenant_id):
        """
        Scope to one tenant. A missing/None caller tenant_id yields an empty
        queryset — never fall through to all-tenant data.

        Rows with tenant_id IS NULL (no tenant signal at creation time — e.g.
        the public/kiosk QR self-check-in endpoint, which has no token to
        derive a tenant from) are included alongside the caller's own rows.
        This mirrors the precedent set in Increment 0 (Organization.tenant /
        ServiceAccess: null tenant = legacy/unscoped, treated permissively
        rather than hidden). See AUTH_INTEGRATION.md "Tenant filtering —
        public endpoints" for the tradeoff this implies once a second tenant
        exists.
        """
        if not tenant_id:
            return self.none()
        return self.filter(models.Q(tenant_id=tenant_id) | models.Q(tenant_id__isnull=True))


class TenantManager(models.Manager):
    def get_queryset(self):
        return TenantQuerySet(self.model, using=self._db)

    def for_tenant(self, tenant_id):
        return self.get_queryset().for_tenant(tenant_id)
