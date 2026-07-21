import os
import sys
import django
import psycopg2
from psycopg2.extras import RealDictCursor

# Setup Django
sys.path.insert(0, 'd:/ERP/auth-service/src')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from employees.models import Employee, EmployeeAssignment

def identify_missing():
    SIS_DB_CONFIG = {
        'host': 'localhost',
        'port': 5432,
        'database': 'sms_iak_db',
        'user': 'erp_admin',
        'password': 'erp_admin_password_change_me_in_prod'
    }
    
    conn = psycopg2.connect(**SIS_DB_CONFIG)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    print("Checking Coordinators...")
    cursor.execute("SELECT full_name, email FROM coordinator_coordinator")
    sis_coords = cursor.fetchall()
    
    auth_coords = EmployeeAssignment.objects.filter(designation__position_code='C')
    auth_emails = []
    for ac in auth_coords:
        e = ac.employee
        if e.org_email: auth_emails.append(e.org_email.lower())
        if e.personal_email: auth_emails.append(e.personal_email.lower())

    print(f"SIS Coords: {len(sis_coords)}")
    print(f"Auth Coords: {auth_coords.count()}")
    
    missing = []
    for sc in sis_coords:
        email = sc['email'].lower().strip()
        if email not in auth_emails:
            missing.append(sc)
            
    if missing:
        print("\nMissing Coordinators in Auth Service:")
        for m in missing:
            print(f"- {m['full_name']} ({m['email']})")
    else:
        print("\nNo coordinators missing by email. Checking by name...")
        auth_names = [ac.employee.full_name for ac in auth_coords]
        for sc in sis_coords:
            if sc['full_name'] not in auth_names:
                print(f"- {sc['full_name']} ({sc['email']})")

    conn.close()

if __name__ == '__main__':
    identify_missing()
