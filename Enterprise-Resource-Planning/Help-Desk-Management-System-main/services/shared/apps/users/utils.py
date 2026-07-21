"""
Utility functions for User app.
"""
from typing import Optional
from django.contrib.auth import get_user_model

User = get_user_model()


def format_user_name(user: User) -> str:
    """Format user's full name."""
    return user.get_full_name() or user.employee_code


def get_user_role_display(user: User) -> str:
    """Get user role display name."""
    return user.get_role_display() if hasattr(user, 'get_role_display') else user.role


