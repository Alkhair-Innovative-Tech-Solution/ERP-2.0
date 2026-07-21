"""
Optimized query selectors for Notification app.
"""
from .models import Notification


class NotificationSelector:
    """Optimized queries for Notification model."""
    
    @staticmethod
    def get_unread_count(user_id: str) -> int:
        """Get unread notification count for user."""
        return Notification.objects.filter(
            user_id=user_id,
            is_read=False,
            is_deleted=False
        ).count()
    
    @staticmethod
    def get_recent_notifications(user_id: str, limit: int = 10):
        """Get recent notifications for user."""
        return Notification.objects.filter(
            user_id=user_id,
            is_deleted=False
        ).order_by('-created_at')[:limit]


