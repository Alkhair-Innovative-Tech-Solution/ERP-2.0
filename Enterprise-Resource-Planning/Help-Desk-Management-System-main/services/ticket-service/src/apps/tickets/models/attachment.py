from django.db import models
from .ticket import Ticket
from hdms_core.models import BaseModel

from .managers import TenantSoftDeleteManager


class Attachment(BaseModel):
    """
    Attachment model for tickets.
    Stores reference to file in file-service.
    """
    tenant_id = models.UUIDField(null=True, blank=True, db_index=True)

    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='attachments')
    file_id = models.UUIDField(
        help_text="Reference ID from file-service",
        null=True,
        blank=True
    )
    filename = models.CharField(max_length=255)
    file_size = models.IntegerField()
    content_type = models.CharField(max_length=100)

    # Deprecated: file = models.FileField(upload_to='attachments/%Y/%m/%d/')

    objects = TenantSoftDeleteManager()

    class Meta:
        db_table = 'ticket_attachments'
        verbose_name = 'Attachment'
        verbose_name_plural = 'Attachments'

    def __str__(self):
        return self.filename
