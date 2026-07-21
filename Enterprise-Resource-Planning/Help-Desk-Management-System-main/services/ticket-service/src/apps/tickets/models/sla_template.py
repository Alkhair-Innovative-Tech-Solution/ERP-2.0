"""
SLATemplate model for Ticket Service.
"""
import sys
from pathlib import Path

# Add shared directory to path
project_root = Path(__file__).resolve().parent.parent.parent.parent.parent.parent
shared_path = project_root / 'shared' / 'core'
if str(shared_path) not in sys.path:
    sys.path.insert(0, str(shared_path))

from django.db import models

# Import BaseModel from shared
try:
    from hdms_core.models import BaseModel
except ImportError:
    # Fallback - create minimal BaseModel
    import uuid
    from django.db import models as django_models
    class BaseModel(django_models.Model):
        id = django_models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
        is_deleted = django_models.BooleanField(default=False, db_index=True)
        deleted_at = django_models.DateTimeField(null=True, blank=True)
        created_at = django_models.DateTimeField(auto_now_add=True)
        updated_at = django_models.DateTimeField(auto_now=True)
        class Meta:
            abstract = True


class SLATemplate(BaseModel):
    """
    SLA Template model for defining service level agreements.
    """
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    
    # SLA Timeframes (in hours)
    response_time = models.IntegerField(help_text="Response time in hours")
    resolution_time = models.IntegerField(help_text="Resolution time in hours")
    
    # Priority-based SLAs
    high_priority_response = models.IntegerField(default=2, help_text="High priority response time in hours")
    high_priority_resolution = models.IntegerField(default=24, help_text="High priority resolution time in hours")
    
    medium_priority_response = models.IntegerField(default=4, help_text="Medium priority response time in hours")
    medium_priority_resolution = models.IntegerField(default=48, help_text="Medium priority resolution time in hours")
    
    low_priority_response = models.IntegerField(default=8, help_text="Low priority response time in hours")
    low_priority_resolution = models.IntegerField(default=72, help_text="Low priority resolution time in hours")
    
    # Department association
    department_id = models.UUIDField(null=True, blank=True, db_index=True, help_text="Specific department, null for global")
    
    # Active status
    is_active = models.BooleanField(default=True, db_index=True)
    
    class Meta:
        db_table = 'sla_templates'
        verbose_name = 'SLA Template'
        verbose_name_plural = 'SLA Templates'
        indexes = [
            models.Index(fields=['department_id']),
            models.Index(fields=['is_active']),
        ]
        ordering = ['name']
    
    def __str__(self):
        return f"{self.name} - {self.response_time}h/{self.resolution_time}h"


