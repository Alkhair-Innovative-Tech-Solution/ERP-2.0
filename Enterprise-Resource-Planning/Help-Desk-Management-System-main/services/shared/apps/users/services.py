"""
Business logic services for User app.
"""
from typing import Optional
from django.contrib.auth import get_user_model
from hdms_core.clients.user_client import UserClient

User = get_user_model()


class UserService:
    """Service for user-related business logic."""
    
    @staticmethod
    def get_user_by_id(user_id: str) -> Optional[User]:
        """Get user by ID."""
        try:
            return User.objects.get(id=user_id, is_deleted=False)
        except User.DoesNotExist:
            return None
    
    @staticmethod
    def get_user_by_employee_code(employee_code: str) -> Optional[User]:
        """Get user by employee code."""
        try:
            return User.objects.get(employee_code=employee_code, is_deleted=False)
        except User.DoesNotExist:
            return None
    
    @staticmethod
    def validate_user_exists(user_id: str) -> bool:
        """Validate if user exists and is active."""
        return User.objects.filter(id=user_id, is_deleted=False, is_active=True).exists()


