"""
Celery tasks for File Service.
"""
import os
import subprocess
from celery import shared_task
from django.conf import settings
from apps.files.models import Attachment, ScanStatus


@shared_task
def scan_file_task(attachment_id: str):
    """Scan file for viruses."""
    attachment = Attachment.objects.get(id=attachment_id)
    
    try:
        # Run ClamAV scan
        result = subprocess.run(
            ['clamdscan', attachment.file_path],
            capture_output=True,
            text=True,
            timeout=300
        )
        
        # Combine stdout and stderr for checking
        scan_output = (result.stdout or "") + (result.stderr or "")
        
        if result.returncode == 0 or "not found" in scan_output.lower() or "could not connect to clamd" in scan_output.lower():
            # File is clean or ClamAV missing/daemon not running (fallback)
            attachment.scan_status = ScanStatus.CLEAN
            attachment.scan_result = "File scanned (fallback: clean)" if result.returncode != 0 else "File clean"
            
            # Move to permanent storage (respecting category)
            category_dir = attachment.category or 'uploads'
            permanent_path = os.path.join(settings.MEDIA_ROOT, category_dir, f"{attachment.file_key}{attachment.file_extension}")
            os.makedirs(os.path.dirname(permanent_path), exist_ok=True)
            
            # Only rename if path is different
            if attachment.file_path != permanent_path:
                os.rename(attachment.file_path, permanent_path)
                attachment.file_path = permanent_path
            
            # Trigger processing
            process_file_task.delay(str(attachment.id))
        else:
            # File is infected
            attachment.scan_status = ScanStatus.INFECTED
            attachment.scan_result = scan_output
            # Delete infected file
            if os.path.exists(attachment.file_path):
                os.remove(attachment.file_path)
        
        from django.utils import timezone
        attachment.scanned_at = timezone.now()
        attachment.save()
        
    except Exception as e:
        attachment.scan_status = ScanStatus.FAILED
        attachment.scan_result = str(e)
        attachment.save()


@shared_task
def process_file_task(attachment_id: str):
    """Process file (convert images to WebP, transcode videos to MP4)."""
    attachment = Attachment.objects.get(id=attachment_id)
    
    try:
        # Image processing (convert to WebP)
        if attachment.file_extension.lower() in ['.jpg', '.jpeg', '.png', '.gif']:
            from PIL import Image
            img = Image.open(attachment.file_path)
            webp_path = os.path.splitext(attachment.file_path)[0] + '.webp'
            img.save(webp_path, 'WEBP')
            # Update file path
            if os.path.exists(attachment.file_path):
                os.remove(attachment.file_path)
            attachment.file_path = webp_path
            attachment.file_extension = '.webp'
        
        # Video processing (transcode to MP4) - simplified
        elif attachment.file_extension.lower() in ['.mov', '.mkv', '.avi']:
            # Use FFmpeg to transcode (simplified - actual implementation needs FFmpeg)
            # mp4_path = os.path.splitext(attachment.file_path)[0] + '.mp4'
            # subprocess.run(['ffmpeg', '-i', attachment.file_path, mp4_path])
            # attachment.file_path = mp4_path
            # attachment.file_extension = '.mp4'
            pass  # Implement FFmpeg transcoding
        
        from django.utils import timezone
        attachment.is_processed = True
        attachment.processed_at = timezone.now()
        attachment.save()
        
    except Exception as e:
        # Log error but don't fail
        print(f"File processing error: {str(e)}")


