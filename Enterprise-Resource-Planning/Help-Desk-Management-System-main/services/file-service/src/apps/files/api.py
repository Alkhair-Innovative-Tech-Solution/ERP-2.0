import os
from ninja import Router
from ninja.errors import HttpError
from typing import List, Optional
from django.core.files.uploadedfile import UploadedFile
from apps.files.schemas import AttachmentOut, FileUploadResponse
from apps.files.models import Attachment
from apps.files.services.upload_service import UploadService
from hdms_core.clients.ticket_client import TicketClient

from central_auth.authentication import CentralAuthAuthentication
from central_auth.permissions import require_permission

router = Router(tags=["files"], auth=CentralAuthAuthentication())


def _get_attachment_for_tenant(request, file_id_or_key: str) -> Attachment:
    """Resolve by id or file_key, scoped to the caller's tenant. Never falls
    through to cross-tenant data — a wrong/missing tenant_id yields 404, same
    as a genuinely missing attachment (no existence leak across tenants)."""
    qs = Attachment.objects.for_tenant(request.auth.tenant_id)
    try:
        return qs.get(id=file_id_or_key)
    except (Attachment.DoesNotExist, ValueError):
        try:
            return qs.get(file_key=file_id_or_key)
        except (Attachment.DoesNotExist, ValueError):
            raise HttpError(404, f"Attachment {file_id_or_key} not found")


@router.post("/upload", response=FileUploadResponse)
@require_permission("hdms.ticket.create")
def upload_file(request, ticket_id: Optional[str] = None, chat_message_id: Optional[str] = None, category: Optional[str] = None, purpose: Optional[str] = None):
    """Upload a file."""
    # Get file from request.FILES
    if 'file' not in request.FILES:
        raise HttpError(400, "No file provided")

    file = request.FILES['file']

    # Handle category vs purpose alias
    final_category = category or purpose or 'general'

    # Validate context
    if ticket_id:
        ticket_client = TicketClient()
        if not ticket_client.validate_ticket(ticket_id):
            raise HttpError(404, "Ticket not found")

    # Uploader identity comes from the verified token only — no client-supplied
    # override (the old `uploaded_by_id` param let any caller attribute an
    # upload to an arbitrary user id; removed, not just left unauthenticated).
    upload_service = UploadService()
    result = upload_service.upload_file(
        file=file,
        ticket_id=ticket_id,
        chat_message_id=chat_message_id,
        uploaded_by_id=str(request.auth.id),
        category=final_category,
        tenant_id=request.auth.tenant_id,
    )

    # Construct URL for response
    gateway_url = os.environ.get('PUBLIC_GATEWAY_URL', 'http://localhost')
    result['url'] = f"{gateway_url}/api/v1/files/{result['file_key']}/download"

    return result


@router.get("/{file_id_or_key}/status", response=AttachmentOut)
@require_permission("hdms.ticket.view_own")
def get_file_status(request, file_id_or_key: str):
    """Get file scan/processing status."""
    attachment = _get_attachment_for_tenant(request, file_id_or_key)
    return AttachmentOut.from_orm(attachment)


@router.get("/{file_id_or_key}/download")
@require_permission("hdms.ticket.view_own")
def download_file(request, file_id_or_key: str):
    """Download file."""
    attachment = _get_attachment_for_tenant(request, file_id_or_key)

    if attachment.scan_status != 'clean':
        raise HttpError(400, f"File {file_id_or_key} not available for download (Status: {attachment.scan_status})")

    from django.http import FileResponse
    return FileResponse(
        open(attachment.file_path, 'rb'),
        as_attachment=True,
        filename=attachment.original_filename
    )


@router.get("/{file_id_or_key}", response=AttachmentOut)
@require_permission("hdms.ticket.view_own")
def get_file(request, file_id_or_key: str):
    """Get file details by id or file_key."""
    attachment = _get_attachment_for_tenant(request, file_id_or_key)
    return AttachmentOut.from_orm(attachment)


