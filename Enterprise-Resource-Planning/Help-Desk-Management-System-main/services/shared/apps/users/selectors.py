"""
Optimized query selectors for User app.
"""
from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()


class UserSelector:
    """Optimized queries for User model."""
    
    @staticmethod
    def get_active_users():
        """Get all active users."""
        return User.objects.filter(is_deleted=False, is_active=True).select_related()
    
    @staticmethod
    def get_users_by_role(role: str):
        """Get users by role."""
        return User.objects.filter(role=role, is_deleted=False, is_active=True)
    
    @staticmethod
    def get_users_by_department(department_id: str):
        """Get users by department."""
        return User.objects.filter(
            department_id=department_id,
            is_deleted=False,
            is_active=True
        )
    
    @staticmethod
    def search_users(query: str):
        """Search users by name or employee code."""
        return User.objects.filter(
            Q(first_name__icontains=query) |
            Q(last_name__icontains=query) |
            Q(employee_code__icontains=query),
            is_deleted=False,
            is_active=True
        )


