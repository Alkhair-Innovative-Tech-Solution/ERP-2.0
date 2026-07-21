import os
from ninja import Router
from ninja.errors import HttpError
from typing import List, Optional
from django.core.files.uploadedfile import UploadedFile
from apps.files.schemas import AttachmentOut, FileUploadResponse
from apps.files.models import Attachment
from apps.files.services.upload_service import UploadService
from hdms_core.clients.user_client import UserClient
from hdms_core.clients.ticket_client import TicketClient
from hdms_core.authentication import RemoteJWTAuthentication

router = Router(tags=["files"])


@router.post("/upload", response=FileUploadResponse, auth=RemoteJWTAuthentication())
def upload_file(request, ticket_id: Optional[str] = None, chat_message_id: Optional[str] = None, category: Optional[str] = None, purpose: Optional[str] = None, uploaded_by_id: Optional[str] = None):
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
    
    # Identify uploader
    # If uploaded_by_id is provided (e.g. from proxy), use it. 
    # Otherwise fallback to authenticated user.
    final_uploader_id = uploaded_by_id or (request.user.id if hasattr(request, 'user') else None)
    
    if not final_uploader_id:
        raise HttpError(401, "User not authenticated")
    
    # Upload file
    upload_service = UploadService()
    result = upload_service.upload_file(
        file=file,
        ticket_id=ticket_id,
        chat_message_id=chat_message_id,
        uploaded_by_id=str(final_uploader_id),
        category=final_category
    )
    
    # Construct URL for response
    gateway_url = os.environ.get('PUBLIC_GATEWAY_URL', 'http://localhost')
    result['url'] = f"{gateway_url}/api/v1/files/{result['file_key']}/download"
    
    return result


@router.get("/{file_id_or_key}/status", response=AttachmentOut)
def get_file_status(request, file_id_or_key: str):
    """Get file scan/processing status."""
    print(f"DEBUG: get_file_status for {file_id_or_key}", flush=True)
    try:
        # Try finding by ID first
        try:
            attachment = Attachment.objects.get(id=file_id_or_key)
        except (Attachment.DoesNotExist, ValueError):
            # Fallback to file_key
            attachment = Attachment.objects.get(file_key=file_id_or_key)
            
        print(f"DEBUG: Found attachment: {attachment.id} (Status: {attachment.scan_status})", flush=True)
        return AttachmentOut.from_orm(attachment)
    except Exception as e:
        print(f"DEBUG: Error in get_file_status: {str(e)}", flush=True)
        raise HttpError(404, f"Attachment {file_id_or_key} not found: {str(e)}")


@router.get("/{file_id_or_key}/download")
def download_file(request, file_id_or_key: str):
    """Download file."""
    print(f"DEBUG: download_file for {file_id_or_key}", flush=True)
    try:
        try:
            attachment = Attachment.objects.get(id=file_id_or_key)
        except (Attachment.DoesNotExist, ValueError):
            attachment = Attachment.objects.get(file_key=file_id_or_key)
    except (Attachment.DoesNotExist, ValueError):
        raise HttpError(404, f"Attachment {file_id_or_key} not found")
    
    if attachment.scan_status != 'clean':
        raise HttpError(400, f"File {file_id_or_key} not available for download (Status: {attachment.scan_status})")

    from django.http import FileResponse
    return FileResponse(
        open(attachment.file_path, 'rb'),
        as_attachment=True,
        filename=attachment.original_filename
    )


@router.get("/{file_id_or_key}", response=AttachmentOut)
def get_file(request, file_id_or_key: str):
    """Get file details by id or file_key."""
    print(f"DEBUG: get_file for {file_id_or_key}", flush=True)
    try:
        try:
            attachment = Attachment.objects.get(id=file_id_or_key)
        except (Attachment.DoesNotExist, ValueError):
            attachment = Attachment.objects.get(file_key=file_id_or_key)
            
        return AttachmentOut.from_orm(attachment)
    except Exception as e:
        print(f"DEBUG: Error in get_file: {str(e)}", flush=True)
        raise HttpError(404, f"Attachment {file_id_or_key} not found: {str(e)}")


