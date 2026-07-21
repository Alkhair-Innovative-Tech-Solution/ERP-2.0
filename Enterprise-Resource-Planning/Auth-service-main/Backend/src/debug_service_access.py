"""Debug ServiceAccess creation for SuperAdmin"""
import os
import sys
import django
from datetime import datetime

sys.path.insert(0, 'd:/ERP/auth-service/src')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from authentication.models import SuperAdmin
from permissions.models import ServiceAccess

print("Fetching SuperAdmin S-25-0003...")
try:
    sa = SuperAdmin.objects.get(superadmin_code='S-25-0003')
    print(f"Found: {sa.full_name} (ID: {sa.id})")
    
    print("Checking existing ServiceAccess...")
    access = ServiceAccess.objects.filter(superadmin=sa, service='sis').first()
    if access:
        print(f"Access exists: {access}")
    else:
        print("Creating ServiceAccess...")
        try:
            new_access = ServiceAccess.objects.create(
                superadmin=sa,
                service='sis',
                is_active=True,
                granted_by=None,
                notes=f'Debug creation on {datetime.now().date()}'
            )
            print(f"Created successfully: {new_access}")
        except Exception as e:
            print(f"ERROR: {e}")
            import traceback
            traceback.print_exc()

except SuperAdmin.DoesNotExist:
    print("SuperAdmin S-25-0003 not found!")
except Exception as e:
    print(f"Unexpected error: {e}")
