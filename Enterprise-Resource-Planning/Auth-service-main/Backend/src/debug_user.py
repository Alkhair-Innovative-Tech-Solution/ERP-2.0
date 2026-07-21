import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from employees.models import Employee
from authentication.models import UserCredentials
from permissions.models import ServiceAccess

def check_user(code):
    print(f"--- Checking user: {code} ---")
    try:
        emp = Employee.objects.get(employee_code=code)
        print(f"[+] Employee found: {emp.full_name} (ID: {emp.id})")
        
        try:
            creds = UserCredentials.objects.get(employee=emp)
            print(f"[+] Credentials found: Yes (Locked: {creds.is_locked()})")
        except UserCredentials.DoesNotExist:
            print(f"[-] Credentials found: NO")
            
        try:
            access = ServiceAccess.objects.get(employee=emp, service='sis')
            print(f"[+] SIS Access: {access.is_active} (Deleted: {access.is_deleted})")
        except ServiceAccess.DoesNotExist:
            print(f"[-] SIS Access: NOT ASSIGNED")
            
    except Employee.DoesNotExist:
        print(f"[-] Employee NOT FOUND in Auth Service")

if __name__ == "__main__":
    check_user("C06-B-15-0015")
