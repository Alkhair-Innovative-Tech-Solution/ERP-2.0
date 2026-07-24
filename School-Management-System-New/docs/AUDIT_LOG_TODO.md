# Audit Log — Cross-Service Implementation (Pending)

## Current State

Audit log system exists in `attendance-service` (`AuditLog` model).  
Frontend displays logs at: `Admin → Notifications/Audit Log page`

Attendance-service correctly logs its **own** events (mark/unmark/update attendance).  
All **cross-service** audit log writes have been removed (they were directly accessing attendance DB — wrong in microservices).

## What Is No Longer Logged

| Service | Events Removed |
|---|---|
| auth-service | password_change, status_change (activate/deactivate user) |
| org-service | password_change, status_change via Django admin |
| staff-service | teacher/coordinator/principal create, update, delete |
| result-service | result replacement during CSV bulk upload |
| timetable-service | student transfer/class change events |
| student-service | student create, update, delete, transfer |

## Plan: HTTP Internal API Approach

### Step 1 — Add internal endpoint in attendance-service

```python
# attendance/urls.py
path('internal/audit-log/', InternalAuditLogCreateView.as_view()),

# attendance/views.py
class InternalAuditLogCreateView(APIView):
    permission_classes = []  # secured by INTERNAL_SERVICE_SECRET header

    def post(self, request):
        secret = request.headers.get('X-Internal-Secret', '')
        if secret != settings.INTERNAL_SERVICE_SECRET:
            return Response(status=403)
        from .models import AuditLog
        AuditLog.objects.create(
            feature=request.data.get('feature'),
            action=request.data.get('action'),
            entity_type=request.data.get('entity_type'),
            entity_id=request.data.get('entity_id'),
            organization_id=request.data.get('organization_id'),
            user_id=request.data.get('user_id'),
            ip_address=request.data.get('ip_address'),
            changes=request.data.get('changes', {}),
            reason=request.data.get('reason', ''),
        )
        return Response({'ok': True}, status=201)
```

### Step 2 — Add helper in each service

```python
# shared helper (add to each service that needs audit logging)
import os, requests

def log_audit(feature, action, entity_type, entity_id, organization=None,
              user=None, ip_address=None, changes=None, reason=''):
    try:
        attendance_url = os.getenv('ATTENDANCE_SERVICE_URL', 'http://attendance-service:8006')
        requests.post(
            f"{attendance_url}/api/attendance/internal/audit-log/",
            json={
                'feature': feature,
                'action': action,
                'entity_type': entity_type,
                'entity_id': entity_id,
                'organization_id': getattr(organization, 'id', None),
                'user_id': getattr(user, 'id', None),
                'ip_address': ip_address,
                'changes': changes or {},
                'reason': reason,
            },
            headers={'X-Internal-Secret': os.getenv('INTERNAL_SERVICE_SECRET', '')},
            timeout=2,
        )
    except Exception:
        pass  # never break business logic for audit logging
```

### Step 3 — Replace removed calls

Each place we removed `AuditLog.objects.create(...)` gets replaced with:
```python
log_audit(feature='teacher', action='delete', entity_type='Teacher',
          entity_id=teacher_id, organization=org, user=user,
          ip_address=request.META.get('REMOTE_ADDR'),
          changes={'name': teacher_name}, reason='...')
```

## Files That Need `log_audit()` Added Back

- `microservices/auth-service/users/views.py` — password_change (4 places), status_change (1 place)
- `microservices/org-service/users/admin.py` — password_change, status_change via admin
- `microservices/auth-service/users/signals.py` — teacher soft-delete on user delete
- `microservices/staff-service/teachers/views.py` — teacher delete
- `microservices/staff-service/teachers/admin.py` — teacher create/update/delete (3 places)
- `microservices/staff-service/coordinator/views.py` — coordinator delete
- `microservices/staff-service/principals/views.py` — principal delete
- `microservices/result-service/result/services/result_csv_import.py` — result replacement
- `microservices/timetable-service/transfers/services.py` — transfer events
- `microservices/student-service/students/views.py` — student events (5 places)
- `microservices/student-service/students/admin.py` — student admin events (4 places)

## Environment Variable Required

```env
# Already exists in docker-compose — just needs to be passed to all services
INTERNAL_SERVICE_SECRET=your_secret_here
ATTENDANCE_SERVICE_URL=http://attendance-service:8006
```
