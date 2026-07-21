"""
Shared BaseModel for all microservices.
All services can use this or duplicate it in each service.
"""
import uuid
from django.db import models
from django.utils import timezone


class SoftDeleteQuerySet(models.QuerySet):
    """Custom QuerySet for soft delete functionality."""
    
    def active(self):
        """Return only non-deleted records."""
        return self.filter(is_deleted=False)
    
    def deleted(self):
        """Return only deleted records."""
        return self.filter(is_deleted=True)
    
    def with_deleted(self):
        """Return all records including deleted."""
        return self.all()


class SoftDeleteManager(models.Manager):
    """Custom Manager for soft delete functionality."""
    
    def get_queryset(self):
        """Return queryset filtered to active records by default."""
        return SoftDeleteQuerySet(self.model, using=self._db).active()
    
    def deleted(self):
        """Return queryset of deleted records."""
        return SoftDeleteQuerySet(self.model, using=self._db).deleted()
    
    def with_deleted(self):
        """Return queryset of all records including deleted."""
        return SoftDeleteQuerySet(self.model, using=self._db).with_deleted()


class BaseModel(models.Model):
    """
    Abstract base model with UUID, soft delete, and timestamps.
    All models should inherit from this.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    objects = SoftDeleteManager()
    
    class Meta:
        abstract = True
    
    def soft_delete(self):
        """Soft delete the record."""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=['is_deleted', 'deleted_at'])
    
    def restore(self):
        """Restore a soft-deleted record."""
        self.is_deleted = False
        self.deleted_at = None
        self.save(update_fields=['is_deleted', 'deleted_at'])


