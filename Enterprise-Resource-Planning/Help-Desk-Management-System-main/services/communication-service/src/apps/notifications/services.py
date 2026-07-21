"""
Business logic services for Notification app.
"""
from typing import Optional, List
from django.db import transaction as db_transaction
from .models import Notification, NotificationType
# Lazy imports to avoid Django settings access at module level


class NotificationService:
    """Service for notification-related business logic."""
    
    @staticmethod
    def get_user_notifications(user_id: str, unread_only: bool = False) -> List[Notification]:
        """Get notifications for a user."""
        queryset = Notification.objects.filter(
            user_id=user_id,
            is_deleted=False
        )
        
        if unread_only:
            queryset = queryset.filter(is_read=False)
        
        return queryset.order_by('-created_at')
    
    @staticmethod
    @db_transaction.atomic
    def create_notification(
        user_id: str,
        notification_type: str,
        title: str,
        message: str,
        ticket_id: str = None,
        metadata: dict = None
    ) -> Notification:
        """Create a new notification."""
        # Lazy import to avoid Django settings access at module level
        from core.clients.user_client import UserClient
        
        # Validate user exists
        if not UserClient.validate_user(user_id):
            raise ValueError("User does not exist")
        
        notification = Notification.objects.create(
            user_id=user_id,
            type=notification_type,
            title=title,
            message=message,
            ticket_id=ticket_id,
            metadata=metadata or {}
        )
        return notification
    
    @staticmethod
    @db_transaction.atomic
    def mark_as_read(notification_id: str):
        """Mark notification as read."""
        notification = Notification.objects.get(id=notification_id)
        notification.mark_as_read()

