"""Quick check of what's in the database"""
import os
import sys
import django

sys.path.insert(0, 'd:/ERP/auth-service/src')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from authentication.models import SuperAdmin, UserCredentials
from permissions.models import ServiceAccess

print("=== SuperAdmins ===")
superadmins = SuperAdmin.objects.all()
print(f"Total: {superadmins.count()}")
for sa in superadmins:
    print(f"  - {sa.superadmin_code}: {sa.full_name} (ID: {sa.id})")
    creds = UserCredentials.objects.filter(superadmin=sa).first()
    print(f"    Credentials: {'YES' if creds else 'NO'}")
    access = ServiceAccess.objects.filter(superadmin=sa, service='sis').first()
    print(f"    SIS Access: {'YES' if access else 'NO'}")

print("\n=== ServiceAccess for Superadmins ===")
sa_access = ServiceAccess.objects.filter(superadmin__isnull=False)
print(f"Total: {sa_access.count()}")
for sa in sa_access:
    print(f"  - {sa}")

print("\n=== ServiceAccess with NULL employee AND superadmin ===")
null_access = ServiceAccess.objects.filter(employee__isnull=True, superadmin__isnull=True)
print(f"Total: {null_access.count()}")
for sa in null_access:
    print(f"  - Service: {sa.service}, ID: {sa.id}")
