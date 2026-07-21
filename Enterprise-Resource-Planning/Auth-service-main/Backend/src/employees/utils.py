"""
Utility classes and functions for the employees app.
Provides soft delete functionality for all models.
"""
from django.db import models
from django.utils import timezone


class SoftDeleteManager(models.Manager):
    """
    Manager that excludes soft-deleted objects by default.
    
    Usage:
        Employee.objects.all()  # Returns only active employees
        Employee.all_objects.all()  # Returns all including deleted
        Employee.objects.deleted_only()  # Returns only deleted
    """
    
    def get_queryset(self):
        """Exclude soft-deleted objects by default"""
        return super().get_queryset().filter(is_deleted=False)
    
    def with_deleted(self):
        """Include soft-deleted objects in query"""
        return super().get_queryset()
    
    def deleted_only(self):
        """Return only soft-deleted objects"""
        return super().get_queryset().filter(is_deleted=True)


class SoftDeleteModel(models.Model):
    """
    Abstract base model providing soft delete functionality.
    
    All models that inherit this will have:
    - is_deleted: Boolean flag
    - deleted_at: Timestamp of deletion
    - deleted_by: UUID of user who deleted
    - deletion_reason: Optional reason for deletion
    - created_at, updated_at: Automatic timestamps
    
    Methods:
    - soft_delete(): Mark as deleted
    - restore(): Undelete
    - hard_delete(): Permanently delete (use with caution!)
    
    Example:
        class Employee(SoftDeleteModel):
            name = models.CharField(max_length=200)
        
        # Usage
        emp = Employee.objects.get(id=1)
        emp.soft_delete(deleted_by='uuid-here', reason='Resigned')
        emp.restore()
    """
    
    # Soft delete fields
    is_deleted = models.BooleanField(
        default=False, 
        db_index=True,
        help_text="Indicates if this record is soft-deleted"
    )
    deleted_at = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="Timestamp when record was deleted"
    )
    deleted_by = models.UUIDField(
        null=True, 
        blank=True,
        help_text="UUID of employee who deleted this record"
    )
    deletion_reason = models.TextField(
        blank=True, 
        null=True,
        help_text="Optional reason for deletion"
    )
    
    # Automatic timestamps
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when record was created"
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Timestamp when record was last updated"
    )
    
    # Managers
    objects = SoftDeleteManager()  # Default manager (excludes deleted)
    all_objects = models.Manager()  # Includes all objects
    
    class Meta:
        abstract = True  # This is a base class, not a real table
        ordering = ['-created_at']  # Newest first by default
    
    def soft_delete(self, deleted_by=None, reason=None):
        """
        Soft delete this instance.
        
        Args:
            deleted_by (UUID, optional): UUID of employee performing deletion
            reason (str, optional): Reason for deletion
        
        Returns:
            None
        
        Example:
            employee.soft_delete(
                deleted_by='uuid-of-admin',
                reason='Employee resigned'
            )
        """
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.deleted_by = deleted_by
        self.deletion_reason = reason
        self.save(update_fields=[
            'is_deleted', 
            'deleted_at', 
            'deleted_by', 
            'deletion_reason'
        ])
    
    def restore(self):
        """
        Restore a soft-deleted instance.
        
        Returns:
            None
        
        Example:
            employee.restore()  # Employee is now active again
        """
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.deletion_reason = None
        self.save(update_fields=[
            'is_deleted', 
            'deleted_at', 
            'deleted_by', 
            'deletion_reason'
        ])
    
    def hard_delete(self):
        """
        Permanently delete this instance from database.
        
        ⚠️ WARNING: This action cannot be undone!
        Use with extreme caution. Soft delete is preferred.
        
        Returns:
            Tuple of (number of objects deleted, dict with deletion counts)
        
        Example:
            # Only use in exceptional cases!
            employee.hard_delete()
        """
        return super().delete()
