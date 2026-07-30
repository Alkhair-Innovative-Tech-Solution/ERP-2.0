"""
Approval API endpoints.

Discovered mid-Increment-2b: this router had `auth=` unset entirely — fully
open, no authentication at all (worse than the ticket router's retired
RemoteJWTAuthentication). In scope ("touch ONLY ticket-service" — approvals
is a ticket-service-local app, not a separate microservice), so wired up
here too rather than flagged-and-left. See AUTH_INTEGRATION.md.
"""
from ninja import Router
from typing import List
from apps.approvals.schemas import ApprovalOut, ApprovalIn, ApprovalDecisionIn
from apps.approvals.models import Approval

from central_auth.authentication import CentralAuthAuthentication
from central_auth.permissions import require_permission

router = Router(tags=["approvals"], auth=CentralAuthAuthentication())


@router.post("/", response=ApprovalOut)
@require_permission('hdms.ticket.create')
def create_approval(request, payload: ApprovalIn):
    """Create approval request."""
    approval = Approval.objects.create(
        ticket_id=payload.ticket_id,
        approver_id=payload.approver_id,
        reason=payload.reason,
        documents=payload.documents or {},
        tenant_id=request.user.tenant_id,
    )
    return ApprovalOut.from_orm(approval)


@router.get("/ticket/{ticket_id}", response=List[ApprovalOut])
@require_permission('hdms.ticket.view_own')
def list_approvals(request, ticket_id: str):
    """List approvals for a ticket."""
    approvals = Approval.objects.for_tenant(request.user.tenant_id).filter(ticket_id=ticket_id)
    return [ApprovalOut.from_orm(approval) for approval in approvals]


@router.post("/{approval_id}/decision", response=ApprovalOut)
@require_permission('hdms.ticket.assign')
def make_decision(request, approval_id: str, payload: ApprovalDecisionIn):
    """Make approval decision (approve/reject).

    Moderator/Admin-tier action — bucketed under hdms.ticket.assign, same
    reasoning as update_sla in the tickets router (no dedicated "approve"
    permission in the catalog).
    """
    approval = Approval.objects.for_tenant(request.user.tenant_id).get(id=approval_id)
    approval.status = payload.status
    approval.reason = payload.reason or approval.reason
    approval.save()
    return ApprovalOut.from_orm(approval)


