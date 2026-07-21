from django.db import models


class ApprovalRequest(models.Model):
    CONTENT_TYPES = [
        ('expense', 'Expense'),
        ('void', 'Void'),
        ('replenishment', 'Replenishment'),
    ]
    APPROVAL_STATUS = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    content_type = models.CharField(max_length=30, choices=CONTENT_TYPES)
    object_id = models.IntegerField()
    requested_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, related_name='approvals_requested'
    )
    approved_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='approvals_given'
    )
    status = models.CharField(max_length=20, choices=APPROVAL_STATUS, default='pending')
    reason = models.TextField(blank=True)
    response_note = models.TextField(blank=True)
    requested_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = 'approvals'
        db_table = 'approval_requests'
        ordering = ['-requested_at']

    def __str__(self):
        return f"Approval {self.get_content_type_display()}#{self.object_id} - {self.status}"
