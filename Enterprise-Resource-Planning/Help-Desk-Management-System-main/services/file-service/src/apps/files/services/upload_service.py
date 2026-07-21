"""
File upload service.
"""
import os
import uuid
from django.core.files.uploadedfile import UploadedFile
from django.conf import settings
from apps.files.models import Attachment, ScanStatus
from apps.files.tasks import scan_file_task, process_file_task


class UploadService:
    """Service for handling file uploads."""
    
    MAX_FILE_SIZE = 524288000  # 500MB
    ALLOWED_EXTENSIONS = {
        'documents': ['.pdf', '.txt', '.docx', '.xlsx'],
        'images': ['.jpg', '.jpeg', '.png', '.gif'],
        'videos': ['.mp4', '.mov', '.mkv', '.avi']
    }
    
    def upload_file(self, file: UploadedFile, ticket_id: str = None, chat_message_id: str = None, uploaded_by_id: str = None, category: str = 'general') -> dict:
        """
        Upload file to temporary storage and trigger scan.
        
        Returns:
            dict: {
                'file_key': str,
                'message': str,
                'scan_status': str
            }
        """
        # Validate file size
        if file.size > self.MAX_FILE_SIZE:
            raise ValueError(f"File size exceeds maximum limit of {self.MAX_FILE_SIZE} bytes")
        
        # Validate file extension
        file_ext = os.path.splitext(file.name)[1].lower()
        allowed = []
        for ext_list in self.ALLOWED_EXTENSIONS.values():
            allowed.extend(ext_list)
        
        if file_ext not in allowed:
            raise ValueError(f"File type not allowed. Allowed: {allowed}")
        
        # Generate unique file key
        file_key = uuid.uuid4()
        
        # Save to storage (categorized folder)
        folder = category if category else 'general'
        temp_path = os.path.join(settings.MEDIA_ROOT, folder, f"{file_key}{file_ext}")
        os.makedirs(os.path.dirname(temp_path), exist_ok=True)
        
        with open(temp_path, 'wb+') as destination:
            for chunk in file.chunks():
                destination.write(chunk)
        
        # Create attachment record
        attachment = Attachment.objects.create(
            file_key=file_key,
            category=category,
            original_filename=file.name,
            file_size=file.size,
            mime_type=file.content_type,
            file_extension=file_ext,
            file_path=temp_path,
            scan_status=ScanStatus.PENDING,
            ticket_id=ticket_id,
            chat_message_id=chat_message_id,
            uploaded_by_id=uploaded_by_id
        )
        
        # Trigger background scan
        scan_file_task.delay(str(attachment.id))
        
        return {
            'id': str(attachment.id),
            'file_key': str(file_key),
            'message': 'File uploaded successfully. Scan in progress.',
            'scan_status': 'pending',
            'filename': attachment.original_filename,
            'size': attachment.file_size,
            'content_type': attachment.mime_type
        }


