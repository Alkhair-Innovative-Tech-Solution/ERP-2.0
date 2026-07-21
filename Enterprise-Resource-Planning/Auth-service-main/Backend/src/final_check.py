"""Final comprehensive verification of Auth Service migration state"""
import os
import sys
import django

sys.path.insert(0, 'd:/ERP/auth-service/src')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from authentication.models import UserCredentials, SuperAdmin
from employees.models import Employee
from permissions.models import ServiceAccess

def check_counts():
    print("=== Database State Verification ===")
    
    emp_total = Employee.objects.count()
    sa_total = SuperAdmin.objects.count()
    creds_total = UserCredentials.objects.count()
    sis_access_total = ServiceAccess.objects.filter(service='sis', is_active=True).count()
    
    print(f"Total Employees in Auth:    {emp_total}")
    print(f"Total SuperAdmins in Auth:  {sa_total}")
    print(f"Total UserCredentials:      {creds_total}")
    print(f"Total SIS ServiceAccess:    {sis_access_total}")
    
    # 215 employees + 3 superadmins = 218 total expected
    expected = 218
    if sis_access_total == expected:
        print(f"✅ COUNT MATCH: {sis_access_total}/{expected} users have active SIS access.")
    else:
        print(f"❌ COUNT MISMATCH: Expected {expected}, found {sis_access_total}.")

    # Check relationships
    sa_creds = UserCredentials.objects.filter(superadmin__isnull=False).count()
    emp_creds = UserCredentials.objects.filter(employee__isnull=False).count()
    print(f"Credentials for SuperAdmins: {sa_creds}")
    print(f"Credentials for Employees:   {emp_creds}")
    
    # Check for orphaned credentials
    orphaned = UserCredentials.objects.filter(employee__isnull=True, superadmin__isnull=True).count()
    if orphaned == 0:
        print("✅ No orphaned credentials found.")
    else:
        print(f"❌ Found {orphaned} orphaned credentials!")

    # Check for missing service access
    # Every credential should ideally have SIS access for the migrated users
    print("\n=== Sampling SuperAdmin S-25-0003 ===")
    try:
        sa = SuperAdmin.objects.get(superadmin_code='S-25-0003')
        creds = UserCredentials.objects.get(superadmin=sa)
        access = ServiceAccess.objects.get(superadmin=sa, service='sis')
        print(f"SA: {sa.full_name} | Creds: OK | SIS Access: {access.is_active}")
    except Exception as e:
        print(f"❌ Sampling failed: {e}")

if __name__ == "__main__":
    check_counts()
