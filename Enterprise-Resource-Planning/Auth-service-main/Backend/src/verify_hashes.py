"""Verify migration integrity"""
import os
import sys
import django
import psycopg2
from psycopg2.extras import RealDictCursor

sys.path.insert(0, 'd:/ERP/auth-service/src')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from authentication.models import UserCredentials, SuperAdmin
from employees.models import Employee

SIS_DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 5432,
    'database': 'sms_iak_db',
    'user': 'erp_admin',
    'password': 'erp_admin_password_change_me_in_prod'
}

def verify_user(username, is_superadmin=False):
    print(f"\nVerifying {username} ({'SuperAdmin' if is_superadmin else 'Employee'})...")
    
    # Get from SIS
    conn = psycopg2.connect(**SIS_DB_CONFIG)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT password FROM users_user WHERE username = %s", (username,))
    sis_user = cur.fetchone()
    conn.close()
    
    if not sis_user:
        print(f"❌ User not found in SIS")
        return

    sis_hash = sis_user['password']
    print(f"SIS Hash: {sis_hash[:20]}...")
    
    # Get from Auth Service
    creds = None
    if is_superadmin:
        try:
            sa = SuperAdmin.objects.get(superadmin_code=username)
            creds = UserCredentials.objects.get(superadmin=sa)
        except Exception as e:
            print(f"❌ Error fetching from Auth: {e}")
            return
    else:
        try:
            emp = Employee.objects.get(employee_code=username)
            creds = UserCredentials.objects.get(employee=emp)
        except Exception as e:
            print(f"❌ Error fetching from Auth: {e}")
            return

    auth_hash = creds.password_hash
    print(f"Auth Hash: {auth_hash[:20]}...")
    
    if sis_hash == auth_hash:
        print("✅ MATCH! Password hash preserved correctly.")
    else:
        print("❌ MISMATCH! Hashes do not match.")

# Test
verify_user('S-25-0003', is_superadmin=True)
verify_user('C01-M-25-T-0218', is_superadmin=False)
