"""
Combines the shared hdms_core soft-delete queryset with central_auth's
tenant-scoping queryset, so chat models keep their existing soft-delete
behavior (default-filtered to is_deleted=False) while gaining
`.for_tenant(tenant_id)`.

Lives in communication-service, not central_auth or hdms_core — this
composition is specific to this service's own base model choice, not part
of either shared template (mirrors ticket-service's
apps/tickets/models/managers.py, Increment 2b).
"""
from django.db import models

from hdms_core.models import SoftDeleteQuerySet

from central_auth.tenant import TenantQuerySet


class TenantSoftDeleteQuerySet(SoftDeleteQuerySet, TenantQuerySet):
    pass


class TenantSoftDeleteManager(models.Manager.from_queryset(TenantSoftDeleteQuerySet)):
    def get_queryset(self):
        return TenantSoftDeleteQuerySet(self.model, using=self._db).active()
