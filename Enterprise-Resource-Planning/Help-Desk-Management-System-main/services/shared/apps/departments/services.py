"""
Business logic services for Department app.
"""
from typing import Optional
from .models import Department


class DepartmentService:
    """Service for department-related business logic."""
    
    @staticmethod
    def get_department_by_id(department_id: str) -> Optional[Department]:
        """Get department by ID."""
        try:
            return Department.objects.get(id=department_id, is_deleted=False)
        except Department.DoesNotExist:
            return None
    
    @staticmethod
    def increment_active_tickets(department_id: str):
        """Increment active tickets count for department."""
        from django.db.models import F
        Department.objects.filter(id=department_id).update(
            active_tickets=F('active_tickets') + 1
        )
    
    @staticmethod
    def decrement_active_tickets(department_id: str):
        """Decrement active tickets count for department."""
        from django.db.models import F
        Department.objects.filter(id=department_id).update(
            active_tickets=F('active_tickets') - 1
        )

