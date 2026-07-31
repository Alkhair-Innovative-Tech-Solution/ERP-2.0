from ninja import Router, Schema
from typing import List, Optional
from apps.notifications.schemas import NotificationOut
from apps.notifications.models import Notification
from django.shortcuts import get_object_or_404

from central_auth.authentication import CentralAuthAuthentication
from central_auth.permissions import require_service_subscribed

router = Router(tags=["notifications"], auth=CentralAuthAuthentication())

class NotificationListSchema(Schema):
    results: List[NotificationOut]
    count: int
    unreadCount: int
    next: Optional[str] = None
    previous: Optional[str] = None

# Notifications are a personal inbox (user_id = recipient), not gated by a
# ticket-role permission — the Increment-2a catalog has nothing narrower
# than "can use hdms at all" that fits "read/manage MY OWN notifications".
# Flagged rather than inventing a new permission (catalog lives in
# auth-service, out of scope here). All endpoints: require_service_subscribed
# (authenticated + hdms subscription) and scope strictly to request.auth.id —
# previously these endpoints took an arbitrary `user_id` query param with NO
# auth at all, so any caller could read/mark/delete ANY user's notifications.

@router.get("/", response=NotificationListSchema)
@require_service_subscribed
def list_notifications(request, unread_only: bool = False, page: int = 1, page_size: int = 20):
    """List notifications for the authenticated user, with pagination."""
    queryset = Notification.objects.for_tenant(request.auth.tenant_id).filter(
        user_id=request.auth.id
    )

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
@require_service_subscribed
def get_unread_count(request):
    """Get unread notification count for the authenticated user."""
    count = Notification.objects.for_tenant(request.auth.tenant_id).filter(
        user_id=request.auth.id, is_read=False
    ).count()
    return {"count": count}

@router.post("/{notification_id}/read", response=NotificationOut)
@require_service_subscribed
def mark_as_read(request, notification_id: str):
    """Mark a notification as read — only if it belongs to the caller."""
    notification = get_object_or_404(
        Notification.objects.for_tenant(request.auth.tenant_id),
        id=notification_id, user_id=request.auth.id,
    )
    notification.mark_as_read()
    return NotificationOut.from_orm(notification)

@router.post("/mark-all-read", response=dict)
@require_service_subscribed
def mark_all_as_read(request):
    """Mark all of the authenticated user's notifications as read."""
    from django.utils import timezone
    Notification.objects.for_tenant(request.auth.tenant_id).filter(
        user_id=request.auth.id, is_read=False
    ).update(is_read=True, read_at=timezone.now())
    return {"message": "All notifications marked as read"}

@router.delete("/{notification_id}", response=dict)
@require_service_subscribed
def delete_notification(request, notification_id: str):
    """Soft delete a notification — only if it belongs to the caller."""
    notification = get_object_or_404(
        Notification.objects.for_tenant(request.auth.tenant_id),
        id=notification_id, user_id=request.auth.id,
    )
    notification.soft_delete()
    return {"message": "Notification deleted"}

@router.delete("/delete-all", response=dict)
@require_service_subscribed
def delete_all_notifications(request):
    """Soft delete all of the authenticated user's notifications."""
    Notification.objects.for_tenant(request.auth.tenant_id).filter(
        user_id=request.auth.id
    ).update(is_deleted=True)
    return {"message": "All notifications deleted"}


