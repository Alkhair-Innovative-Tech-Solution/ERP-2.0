"""
Comment model for Ticket Service.
"""
from django.db import models
from .ticket import Ticket
from hdms_core.models import BaseModel

class Comment(BaseModel):
    """
    Comment on a ticket.
    """
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='comments')
    author_id = models.UUIDField(db_index=True)
    author_name = models.CharField(max_length=255, default='Unknown')
    content = models.TextField()
    is_internal = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'comments'
        ordering = ['created_at']
        
    def __str__(self):
        return f"Comment on {self.ticket} by {self.author_name}"
