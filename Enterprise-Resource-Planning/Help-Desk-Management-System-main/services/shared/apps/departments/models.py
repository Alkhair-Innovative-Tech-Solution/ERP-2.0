"""
Department model for User Service.
"""
from django.db import models
from hdms_core.models import BaseModel


class Department(BaseModel):
    """
    Department model.
    """
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=10, unique=True)
    head_id = models.UUIDField(null=True, blank=True, db_index=True)  # Reference to User
    active_tickets = models.IntegerField(default=0)
    total_capacity = models.IntegerField(default=100)
    queue_enabled = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'departments'
        verbose_name = 'Department'
        verbose_name_plural = 'Departments'
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['code']),
            models.Index(fields=['head_id']),
            models.Index(fields=['is_deleted']),
        ]
    
    def __str__(self):
        return self.name
