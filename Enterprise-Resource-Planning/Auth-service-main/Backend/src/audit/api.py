from ninja import Router, Schema
from typing import List, Optional
from audit.models import AuditLog
from datetime import datetime
from authentication.api import AuthBearer
from permissions.rbac import require_permission

router = Router(tags=["audit"], auth=AuthBearer())

class AuditLogSchema(Schema):
    id: str
    changed_by: Optional[str] = None
    action: str
    content_type: str
    object_id: str
    timestamp: datetime
    notes: Optional[str] = None

@router.get("/logs", response=List[AuditLogSchema])
@require_permission("audit.view")
def list_audit_logs(request, limit: int = 10):
    """
    Get the most recent system activity logs.
    """
    logs = AuditLog.objects.select_related('changed_by', 'content_type').order_by('-timestamp')[:limit]
    
    results = []
    for log in logs:
        # Determine the action label and target
        action_map = {
            'create': 'Created',
            'update': 'Updated',
            'delete': 'Deleted',
            'restore': 'Restored'
        }
        
        results.append({
            "id": str(log.id),
            "changed_by": log.changed_by.full_name if log.changed_by else "System",
            "action": action_map.get(log.action, log.action),
            "content_type": log.content_type.model.capitalize(),
            "object_id": log.object_id,
            "timestamp": log.timestamp,
            "notes": log.notes
        })
    return results
