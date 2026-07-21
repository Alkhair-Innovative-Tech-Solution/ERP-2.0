from django.db import models


class Notification(models.Model):
    NOTIF_TYPES = [
        ('low_balance', 'Low Balance'),
        ('approval_pending', 'Approval Pending'),
        ('approval_completed', 'Approval Completed'),
        ('void_completed', 'Void Completed'),
        ('replenishment_completed', 'Replenishment Completed'),
        ('replenishment_request', 'Replenishment Request'),
        ('expense_submitted', 'Expense Submitted'),
        ('settings_change', 'Settings Change'),
        ('transfer_completed', 'Transfer Completed'),
        ('transfer_initiated', 'Transfer Initiated'),
    ]
    recipient = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='notifications')
    notif_type = models.CharField(max_length=30, choices=NOTIF_TYPES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    link = models.CharField(max_length=500, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'notifications'
        db_table = 'notifications'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{'Read' if self.is_read else 'Unread'}] {self.title}"
