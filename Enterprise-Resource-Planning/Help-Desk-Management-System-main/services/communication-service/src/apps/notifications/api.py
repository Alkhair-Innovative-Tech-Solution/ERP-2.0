from ninja import Router, Schema
from typing import List, Optional
from apps.notifications.schemas import NotificationOut
from apps.notifications.models import Notification
from django.shortcuts import get_object_or_404
from django.db.models import Count

router = Router(tags=["notifications"])

class NotificationListSchema(Schema):
    results: List[NotificationOut]
    count: int
    unreadCount: int
    next: Optional[str] = None
    previous: Optional[str] = None

@router.get("/", response=NotificationListSchema)
def list_notifications(request, user_id: str, unread_only: bool = False, page: int = 1, page_size: int = 20):
    """List notifications for a user with pagination."""
    queryset = Notification.objects.filter(user_id=user_id, is_deleted=False)
    
    unread_count = queryset.filter(is_read=False).count()
    
    if unread_only:
        queryset = queryset.filter(is_read=False)
    
    total_count = queryset.count()
    
    # Simple pagination
    offset = (page - 1) * page_size
    queryset = queryset[offset : offset + page_size]
    
    return {
        "results": list(queryset),
        "count": total_count,
        "unreadCount": unread_count,
        "next": None,
        "previous": None
    }

@router.get("/unread-count", response=dict)
def get_unread_count(request, user_id: str):
    """Get unread notification count for a user."""
    count = Notification.objects.filter(user_id=user_id, is_read=False, is_deleted=False).count()
    return {"count": count}

@router.post("/{notification_id}/read", response=NotificationOut)
def mark_as_read(request, notification_id: str):
    """Mark notification as read."""
    notification = get_object_or_404(Notification, id=notification_id, is_deleted=False)
    notification.mark_as_read()
    return NotificationOut.from_orm(notification)

@router.post("/mark-all-read", response=dict)
def mark_all_as_read(request, user_id: str):
    """Mark all notifications as read for a user."""
    from django.utils import timezone
    Notification.objects.filter(user_id=user_id, is_read=False, is_deleted=False).update(
        is_read=True, 
        read_at=timezone.now()
    )
    return {"message": "All notifications marked as read"}

@router.delete("/{notification_id}", response=dict)
def delete_notification(request, notification_id: str):
    """Soft delete a notification."""
    notification = get_object_or_404(Notification, id=notification_id)
    notification.soft_delete()
    return {"message": "Notification deleted"}

@router.delete("/delete-all", response=dict)
def delete_all_notifications(request, user_id: str):
    """Soft delete all notifications for a user."""
    Notification.objects.filter(user_id=user_id).update(is_deleted=True)
    return {"message": "All notifications deleted"}


