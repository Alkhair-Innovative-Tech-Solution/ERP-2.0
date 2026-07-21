from django.db import models


class ReportTemplate(models.Model):
    AUDIENCES = [
        ('donor', 'Donor Report'),
        ('management', 'Management Summary'),
        ('audit', 'Audit Trail Report'),
        ('branch', 'Branch Report'),
        ('program', 'Program Report'),
    ]
    name = models.CharField(max_length=200)
    audience = models.CharField(max_length=20, choices=AUDIENCES)
    config = models.JSONField(default=dict)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, related_name='report_templates'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'reports'
        db_table = 'report_templates'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_audience_display()})"
