"""
Optimized query selectors for File app.
"""
from .models import Attachment, ScanStatus


class FileSelector:
    """Optimized queries for Attachment model."""
    
    @staticmethod
    def get_ticket_attachments(ticket_id: str):
        """Get attachments for a ticket."""
        return Attachment.objects.filter(
            ticket_id=ticket_id,
            is_deleted=False
        ).order_by('-created_at')
    
    @staticmethod
    def get_pending_scans():
        """Get files pending antivirus scan."""
        return Attachment.objects.filter(
            scan_status=ScanStatus.PENDING,
            is_deleted=False
        )


