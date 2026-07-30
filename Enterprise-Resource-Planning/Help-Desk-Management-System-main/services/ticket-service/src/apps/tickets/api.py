"""
Ticket Service API endpoints.
"""
from ninja import Router, File, UploadedFile
from ninja.security import HttpBearer
from ninja.errors import HttpError
from typing import List, Optional
from django.utils import timezone
from django.db.models import Q

from apps.tickets.schemas import (
    TicketOut, TicketIn, TicketUpdateIn, StatusUpdateIn,
    AttachmentOut, AttachmentCreateIn, TicketConfirmReviewIn,
    AssignTicketIn, RejectTicketIn, PostponeTicketIn,
    AuditLogOut, TicketProgressIn, TicketAcknowledgeIn, SLAUpdateIn,
    PaginatedTicketOut,
)
from apps.tickets.models.ticket import Ticket
from apps.tickets.models.sub_ticket import SubTicket
from apps.tickets.models.attachment import Attachment
from apps.audit.models import AuditLog, ActionType, AuditCategory

from central_auth.authentication import CentralAuthAuthentication
from central_auth.permissions import require_permission, require_service_subscribed
from apps.notifications.email import (
    notify_ticket_submitted, notify_ticket_assigned,
    notify_ticket_acknowledged, notify_ticket_in_progress,
    notify_ticket_resolved, notify_ticket_rejected,
    notify_ticket_postponed, notify_ticket_closed,
)

router = Router(tags=["tickets"], auth=CentralAuthAuthentication())

# FSM action -> hdms.* permission for the generic /status transition endpoint.
# Only 'assign' and 'close' have a dedicated catalog permission; every other
# transition (submit/review/start_progress/resolve/reject/postpone/reopen)
# falls back to hdms.ticket.create as the closest "manage my ticket" bucket
# — flagged in AUTH_INTEGRATION.md, the catalog has no per-transition
# permission for these.
STATUS_ACTION_PERMISSIONS = {
    'assign': 'hdms.ticket.assign',
    'close': 'hdms.ticket.close',
}
DEFAULT_STATUS_PERMISSION = 'hdms.ticket.create'


def _notify_on_status(ticket, action: str, reason: str = ''):
    """Map FSM action → email notification."""
    mapping = {
        'submit': notify_ticket_submitted,
        'start_progress': notify_ticket_in_progress,
        'resolve': notify_ticket_resolved,
        'close': notify_ticket_closed,
    }
    if action == 'reject':
        notify_ticket_rejected(ticket, reason=reason)
    elif action == 'postpone':
        notify_ticket_postponed(ticket, reason=reason)
    elif action in mapping:
        mapping[action](ticket)


@router.post("/", response=TicketOut)
@require_permission('hdms.ticket.create')
def create_ticket(request, payload: TicketIn):
    """Create a new ticket.

    Identity/permission now comes from the verified token (central_auth),
    not a per-request HTTP call to auth-service — the old commented-out
    UserClient.validate_user_exists() TODO is retired, not just disabled;
    see AUTH_INTEGRATION.md "What was removed".
    """
    ticket = Ticket.objects.create(
        title=payload.title,
        description=payload.description,
        requestor_id=payload.requestor_id,
        department_id=payload.department_id,
        priority=payload.priority,
        category=payload.category,
        status=payload.status or 'draft',
        tenant_id=request.user.tenant_id,
    )
    if ticket.status == 'submitted':
        notify_ticket_submitted(ticket)
    return ticket


@router.get("/", response=PaginatedTicketOut)
@require_permission('hdms.ticket.view_own')
def list_tickets(
    request,
    status: Optional[str] = None,
    requestor_id: Optional[str] = None,
    assignee_id: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    exclude_drafts: bool = True,
    page: int = 1,
    page_size: int = 20,
):
    """List tickets with optional filters and pagination.

    Tenant-filtered. Callers with only hdms.ticket.view_own (e.g. Assignee)
    see only tickets where they are the requestor or assignee; callers with
    hdms.ticket.view_all (Admin/Moderator) see every ticket in their tenant.
    """
    queryset = Ticket.objects.for_tenant(request.user.tenant_id).order_by('-created_at')
    if not request.user.has_perm('hdms.ticket.view_all'):
        queryset = queryset.filter(Q(requestor_id=request.user.id) | Q(assignee_id=request.user.id))

    if exclude_drafts and not requestor_id and not assignee_id:
        queryset = queryset.exclude(status='draft')

    if status:
        queryset = queryset.filter(status=status)
    if requestor_id:
        queryset = queryset.filter(requestor_id=requestor_id)
    if assignee_id:
        queryset = queryset.filter(assignee_id=assignee_id)
    if priority:
        queryset = queryset.filter(priority=priority)
    if search:
        queryset = queryset.filter(Q(title__icontains=search) | Q(description__icontains=search))

    count = queryset.count()
    page_size = max(1, min(page_size, 100))
    offset = (max(1, page) - 1) * page_size
    tickets = queryset[offset: offset + page_size]

    return {"count": count, "results": [TicketOut.from_orm(t) for t in tickets]}



@router.get("/{ticket_id}", response=TicketOut)
@require_permission('hdms.ticket.view_own')
def get_ticket(request, ticket_id: str):
    """Get ticket by ID."""
    ticket = Ticket.objects.for_tenant(request.user.tenant_id).get(id=ticket_id)
    return TicketOut.from_orm(ticket)


@router.patch("/{ticket_id}", response=TicketOut)
@require_permission('hdms.ticket.create')
def update_ticket(request, ticket_id: str, payload: TicketUpdateIn):
    """Update ticket.

    No dedicated "edit ticket" permission exists in the HDMS catalog
    (hdms.ticket.create/view_own/view_all/assign/close/user.manage) — gated
    under hdms.ticket.create as the closest "manage my ticket" bucket.
    Flagged in AUTH_INTEGRATION.md.
    """
    ticket = Ticket.objects.for_tenant(request.user.tenant_id).get(id=ticket_id)

    for field, value in payload.dict(exclude_unset=True).items():
        setattr(ticket, field, value)

    ticket.save()
    return TicketOut.from_orm(ticket)


@router.post("/{ticket_id}/status", response=TicketOut)
@require_service_subscribed
def update_status(request, ticket_id: str, payload: StatusUpdateIn):
    """Update ticket status using FSM.

    Multi-action endpoint (payload.action selects the FSM transition) — the
    blanket ServiceSubscribed gate applies to all actions, then the specific
    hdms.* permission is checked per-action below (only 'assign' and 'close'
    have a dedicated catalog permission; see STATUS_ACTION_PERMISSIONS).
    """
    required_perm = STATUS_ACTION_PERMISSIONS.get(payload.action, DEFAULT_STATUS_PERMISSION)
    if not request.user.has_perm(required_perm):
        raise HttpError(403, f'Missing required permission: {required_perm}.')

    ticket = Ticket.objects.for_tenant(request.user.tenant_id).get(id=ticket_id)

    # Get transition method
    transition_method = getattr(ticket, payload.action, None)
    if not transition_method:
        raise HttpError(400, f"Invalid action: {payload.action}")
    
    # Execute transition
    try:
        old_status = ticket.status
        # Only reject and postpone accept a reason parameter
        if payload.action in ['reject', 'postpone'] and payload.reason:
            transition_method(payload.reason)
        else:
            transition_method()
        ticket.save()
        
        # Log action
        AuditLog.objects.create(
            action_type=ActionType.UPDATE,
            category=AuditCategory.TICKET,
            model_name='Ticket',
            object_id=ticket.id,
            performed_by_id=request.user.id if hasattr(request, 'user') else ticket.requestor_id,
            old_state={'status': old_status},
            new_state={'status': ticket.status},
            changes={'status': {'old': old_status, 'new': ticket.status}},
            reason=f"Status change: {payload.action.upper()} - {payload.reason or ''}"
        )
        
    except Exception as e:
        if payload.action == 'submit' and ticket.status == 'submitted':
            return TicketOut.from_orm(ticket)
        if payload.action == 'postpone' and ticket.status == 'postponed':
            return TicketOut.from_orm(ticket)
        if payload.action == 'reject' and ticket.status == 'rejected':
            return TicketOut.from_orm(ticket)
        raise HttpError(400, str(e))

    # Fire lifecycle notifications
    _notify_on_status(ticket, payload.action, payload.reason or '')
    return TicketOut.from_orm(ticket)


@router.get("/{ticket_id}/sub-tickets", response=List[TicketOut])
@require_permission('hdms.ticket.view_own')
def list_sub_tickets(request, ticket_id: str):
    """List sub-tickets for a ticket."""
    sub_tickets = SubTicket.objects.for_tenant(request.user.tenant_id).filter(parent_ticket_id=ticket_id)
    return [TicketOut.from_orm(st) for st in sub_tickets]

@router.post("/{ticket_id}/attachments", response=AttachmentOut)
@require_permission('hdms.ticket.create')
def add_attachment(request, ticket_id: str, payload: AttachmentCreateIn):
    """Add an attachment reference to a ticket."""
    try:
        ticket = Ticket.objects.for_tenant(request.user.tenant_id).get(id=ticket_id)
    except Ticket.DoesNotExist:
        raise HttpError(404, "Ticket not found")

    attachment = Attachment.objects.create(
        ticket=ticket,
        file_id=payload.file_id,
        filename=payload.filename,
        file_size=payload.file_size,
        content_type=payload.content_type,
        tenant_id=request.user.tenant_id,
    )
    return attachment

@router.post("/{ticket_id}/assign", response=TicketOut)
@require_permission('hdms.ticket.assign')
def assign_ticket(request, ticket_id: str, payload: AssignTicketIn):
    """Assign ticket to an assignee."""
    try:
        ticket = Ticket.objects.for_tenant(request.user.tenant_id).get(id=ticket_id)
    except Ticket.DoesNotExist:
        raise HttpError(404, "Ticket not found")
    
    # Set assignee
    ticket.assignee_id = payload.assignee_id
    if payload.department_id:
        ticket.department_id = payload.department_id
    
    # Handle FSM transitions based on current status
    try:
        if ticket.status == 'draft':
            ticket.submit()  # draft -> submitted
            ticket.review()  # submitted -> under_review
            ticket.assign()  # under_review -> assigned
        elif ticket.status == 'submitted':
            ticket.review()
            ticket.assign()
        elif ticket.status in ['pending', 'under_review']:
            ticket.assign()
        # If already assigned or in_progress, just update assignee without transition
    except Exception as e:
        raise HttpError(400, f"Cannot assign ticket: {str(e)}")
    
    ticket.save()

    notify_ticket_assigned(ticket)

    # Log assignment
    AuditLog.objects.create(
        action_type=ActionType.UPDATE,
        category=AuditCategory.TICKET,
        model_name='Ticket',
        object_id=ticket.id,
        performed_by_id=request.user.id if hasattr(request, 'user') else ticket.requestor_id,
        new_state={'assignee_id': str(payload.assignee_id), 'department_id': str(payload.department_id) if payload.department_id else None},
        changes={'assignee_id': str(payload.assignee_id)},
        reason="Ticket assigned via API"
    )

    return ticket

    
@router.post("/{ticket_id}/reject", response=TicketOut)
@require_permission('hdms.ticket.create')
def reject_ticket(request, ticket_id: str, payload: RejectTicketIn):
    """Reject a ticket with reason.

    No dedicated catalog permission — bucketed under hdms.ticket.create,
    same reasoning as update_ticket. Flagged in AUTH_INTEGRATION.md.
    """
    try:
        ticket = Ticket.objects.for_tenant(request.user.tenant_id).get(id=ticket_id)
    except Ticket.DoesNotExist:
        raise HttpError(404, "Ticket not found")
    
    try:
        ticket.reject(payload.reason)
        ticket.save()
    except Exception as e:
        raise HttpError(400, f"Cannot reject ticket: {str(e)}")

    AuditLog.objects.create(
        action_type=ActionType.UPDATE,
        category=AuditCategory.TICKET,
        model_name='Ticket',
        object_id=ticket.id,
        performed_by_id=request.user.id if hasattr(request, 'user') else ticket.requestor_id,
        changes={'status': 'rejected'},
        reason=f"Rejected: {payload.reason}"
    )

    notify_ticket_rejected(ticket, reason=payload.reason)
    return ticket


@router.post("/{ticket_id}/postpone", response=TicketOut)
@require_permission('hdms.ticket.create')
def postpone_ticket(request, ticket_id: str, payload: PostponeTicketIn):
    """Postpone a ticket with reason.

    No dedicated catalog permission — bucketed under hdms.ticket.create.
    Flagged in AUTH_INTEGRATION.md.
    """
    try:
        ticket = Ticket.objects.for_tenant(request.user.tenant_id).get(id=ticket_id)
    except Ticket.DoesNotExist:
        raise HttpError(404, "Ticket not found")
    
    ticket.postpone(payload.reason)
    ticket.save()

    notify_ticket_postponed(ticket, reason=payload.reason)

    # Log postponement
    AuditLog.objects.create(
        action_type=ActionType.UPDATE,
        category=AuditCategory.TICKET,
        model_name='Ticket',
        object_id=ticket.id,
        performed_by_id=request.user.id if hasattr(request, 'user') else ticket.requestor_id,
        changes={'status': 'postponed'},
        reason=f"Postponed: {payload.reason}"
    )
    
    return ticket

@router.patch("/{ticket_id}/acknowledge", response=TicketOut)
@require_permission('hdms.ticket.close')
def acknowledge_ticket(request, ticket_id: str, payload: TicketAcknowledgeIn):
    """Acknowledge ticket assignment.

    Assignee-tier action (acknowledging one's own assignment) — no
    dedicated catalog permission, bucketed under hdms.ticket.close since
    that's the assignee-tier permission that exists. Flagged in
    AUTH_INTEGRATION.md.
    """
    try:
        ticket = Ticket.objects.for_tenant(request.user.tenant_id).get(id=ticket_id)
    except Ticket.DoesNotExist:
        raise HttpError(404, "Ticket not found")
        
    if ticket.acknowledged_at:
        # Idempotency: return existing ticket if already acknowledged
        return ticket

    try:
        # Capture old state for logging
        old_state = {
            'acknowledged_at': str(ticket.acknowledged_at),
            'status': ticket.status
        }
        
        ticket.acknowledge()
        ticket.save()
        
        # Capture new state
        new_state = {
            'acknowledged_at': str(ticket.acknowledged_at),
            'status': ticket.status
        }
        
        AuditLog.objects.create(
            action_type=ActionType.UPDATE,
            category=AuditCategory.TICKET,
            model_name='Ticket',
            object_id=ticket.id,
            performed_by_id=request.user.id if hasattr(request, 'user') else ticket.requestor_id,
            old_state=old_state,
            new_state=new_state,
            changes={'acknowledged_at': {'old': None, 'new': str(ticket.acknowledged_at)}},
            reason=f"Ticket acknowledged: {payload.notes or ''}"
        )
    except Exception as e:
        raise HttpError(400, f"Cannot acknowledge ticket: {str(e)}")

    notify_ticket_acknowledged(ticket)
    return ticket

@router.patch("/{ticket_id}/progress", response=TicketOut)
@require_permission('hdms.ticket.close')
def update_progress(request, ticket_id: str, payload: TicketProgressIn):
    """Update ticket progress.

    Assignee-tier action, same reasoning as acknowledge_ticket — bucketed
    under hdms.ticket.close. Flagged in AUTH_INTEGRATION.md.
    """
    try:
        ticket = Ticket.objects.for_tenant(request.user.tenant_id).get(id=ticket_id)
    except Ticket.DoesNotExist:
        raise HttpError(404, "Ticket not found")
        
    old_progress = ticket.progress_percent
    ticket.progress_percent = payload.progress_percent
    ticket.save()
    
    AuditLog.objects.create(
        action_type=ActionType.UPDATE,
        category=AuditCategory.TICKET,
        model_name='Ticket',
        object_id=ticket.id,
        performed_by_id=request.user.id if hasattr(request, 'user') else ticket.requestor_id,
        old_state={'progress_percent': old_progress},
        new_state={'progress_percent': payload.progress_percent},
        changes={'progress_percent': {'old': old_progress, 'new': payload.progress_percent}},
        reason="Progress update"
    )
    return ticket

@router.patch("/{ticket_id}/sla", response=TicketOut)
@require_permission('hdms.ticket.assign')
def update_sla(request, ticket_id: str, payload: SLAUpdateIn):
    """Update ticket SLA (Due Date).

    Moderator/Admin-tier action (ticket routing/scheduling) — no dedicated
    catalog permission, bucketed under hdms.ticket.assign since that's the
    moderator-tier permission that exists. Flagged in AUTH_INTEGRATION.md.
    """
    try:
        ticket = Ticket.objects.for_tenant(request.user.tenant_id).get(id=ticket_id)
    except Ticket.DoesNotExist:
        raise HttpError(404, "Ticket not found")

    old_due_at = ticket.due_at
    ticket.due_at = payload.due_at
    ticket.save()
    
    AuditLog.objects.create(
        action_type=ActionType.UPDATE,
        category=AuditCategory.TICKET,
        model_name='Ticket',
        object_id=ticket.id,
        performed_by_id=request.user.id if hasattr(request, 'user') else ticket.requestor_id,
        old_state={'due_at': str(old_due_at) if old_due_at else None},
        new_state={'due_at': str(payload.due_at)},
        changes={'due_at': {'old': str(old_due_at) if old_due_at else None, 'new': str(payload.due_at)}},
        reason=f"SLA Change: {payload.reason}"
    )
    return ticket

@router.get("/{ticket_id}/history", response=List[AuditLogOut])
@require_permission('hdms.ticket.view_own')
def get_ticket_history(request, ticket_id: str):
    """Get ticket audit log history.

    AuditLog itself has no tenant_id (audit app is shared infra, not a
    ticket-owned model — out of scope per the prompt). Tenant isolation is
    enforced by resolving the ticket through the tenant-scoped manager
    first: a caller can only pull history for a ticket in their own
    tenant. (This also closes a pre-existing gap — the old code returned
    history for any object_id with no ticket-ownership check at all.)
    """
    ticket = Ticket.objects.for_tenant(request.user.tenant_id).filter(id=ticket_id).first()
    if not ticket:
        raise HttpError(404, "Ticket not found")
    return AuditLog.objects.filter(
        model_name='Ticket',
        object_id=ticket_id
    ).order_by('-timestamp')

@router.post("/{ticket_id}/confirm-review", response=TicketOut)
@require_permission('hdms.ticket.assign')
def confirm_review_ticket(request, ticket_id: str, payload: TicketConfirmReviewIn):
    """Initial moderator review: update fields and assign."""
    from datetime import timedelta
    try:
        ticket = Ticket.objects.for_tenant(request.user.tenant_id).get(id=ticket_id)
    except Ticket.DoesNotExist:
        raise HttpError(404, "Ticket not found")
        
    old_status = ticket.status
    old_values = {
        'title': ticket.title,
        'description': ticket.description,
        'priority': ticket.priority,
        'category': ticket.category,
        'department_id': str(ticket.department_id) if ticket.department_id else None,
        'assignee_id': str(ticket.assignee_id) if ticket.assignee_id else None
    }
    
    # 1. Update fields
    ticket.title = payload.title
    ticket.description = payload.description
    ticket.priority = payload.priority
    ticket.category = payload.category
    if payload.department_id:
        ticket.department_id = payload.department_id
    ticket.assignee_id = payload.assignee_id
    
    # 2. Transitions: submitted -> under_review -> assigned
    try:
        if ticket.status == 'submitted':
            ticket.review()
            ticket.assign()
        elif ticket.status == 'under_review':
            ticket.assign()
        # if already assigned, status stays assigned
    except Exception as e:
        raise HttpError(400, f"Status transition failed: {str(e)}")
        
    # 3. Calculate SLA (Due Date)
    sla_hours = {
        'urgent': 8,
        'high': 24,
        'medium': 48,
        'low': 72
    }.get(payload.priority.lower(), 48)
    
    ticket.due_at = timezone.now() + timedelta(hours=sla_hours)
    
    ticket.save()
    
    # 4. Log changes
    changes = {}
    for key, val in old_values.items():
        new_val = str(getattr(ticket, key)) if getattr(ticket, key) else None
        if new_val != val:
            changes[key] = {'old': val, 'new': new_val}
            
    if ticket.status != old_status:
        changes['status'] = {'old': old_status, 'new': ticket.status}

    AuditLog.objects.create(
        action_type=ActionType.UPDATE,
        category=AuditCategory.TICKET,
        model_name='Ticket',
        object_id=ticket.id,
        performed_by_id=request.user.id if hasattr(request, 'user') else ticket.requestor_id,
        old_state=old_values,
        new_state={k: str(getattr(ticket, k)) for k in old_values.keys()},
        changes=changes,
        reason="Moderator confirmed review and assigned ticket"
    )
    
    return ticket