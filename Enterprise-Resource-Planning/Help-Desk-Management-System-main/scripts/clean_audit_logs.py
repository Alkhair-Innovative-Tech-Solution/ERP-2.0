"""
Clean old audit logs (archive after 7 years).
"""
import os
import django
from datetime import datetime, timedelta

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.audit.models import AuditLog


def archive_old_logs():
    """Archive audit logs older than 7 years."""
    seven_years_ago = datetime.now() - timedelta(days=7*365)
    
    logs_to_archive = AuditLog.objects.filter(
        archived_at__isnull=True,
        timestamp__lt=seven_years_ago
    )
    
    count = logs_to_archive.update(archived_at=datetime.now())
    print(f"Archived {count} audit logs")


if __name__ == '__main__':
    archive_old_logs()


