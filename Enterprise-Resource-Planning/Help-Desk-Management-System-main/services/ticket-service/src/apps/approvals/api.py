"""
Approval API endpoints.
"""
from ninja import Router
from typing import List
from apps.approvals.schemas import ApprovalOut, ApprovalIn, ApprovalDecisionIn
from apps.approvals.models import Approval

router = Router(tags=["approvals"])


@router.post("/", response=ApprovalOut)
def create_approval(request, payload: ApprovalIn):
    """Create approval request."""
    approval = Approval.objects.create(
        ticket_id=payload.ticket_id,
        approver_id=payload.approver_id,
        reason=payload.reason,
        documents=payload.documents or {},
    )
    return ApprovalOut.from_orm(approval)


@router.get("/ticket/{ticket_id}", response=List[ApprovalOut])
def list_approvals(request, ticket_id: str):
    """List approvals for a ticket."""
    approvals = Approval.objects.filter(ticket_id=ticket_id, is_deleted=False)
    return [ApprovalOut.from_orm(approval) for approval in approvals]


@router.post("/{approval_id}/decision", response=ApprovalOut)
def make_decision(request, approval_id: str, payload: ApprovalDecisionIn):
    """Make approval decision (approve/reject)."""
    approval = Approval.objects.get(id=approval_id, is_deleted=False)
    approval.status = payload.status
    approval.reason = payload.reason or approval.reason
    approval.save()
    return ApprovalOut.from_orm(approval)


