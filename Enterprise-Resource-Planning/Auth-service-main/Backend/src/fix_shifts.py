"""
Fix Shift Data Utility
======================
Updates existing EmployeeAssignment records to restore 'both' shift 
where it was previously mapped to 'general'.
"""

import os
import sys
import django
import psycopg2
from psycopg2.extras import RealDictCursor
import logging

# Setup Django
sys.path.insert(0, 'd:/ERP/auth-service/src')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from employees.models import EmployeeAssignment, Employee

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

SIS_DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'sms_iak_db',
    'user': 'erp_admin',
    'password': 'erp_admin_password_change_me_in_prod'
}

def fix_shifts():
    conn = psycopg2.connect(**SIS_DB_CONFIG)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    tables = ['teachers_teacher', 'coordinator_coordinator', 'principals_principal']
    
    updated_count = 0
    
    for t in tables:
        logger.info(f"Checking shifts in {t}...")
        cursor.execute(f"SELECT employee_code, shift FROM {t} WHERE lower(shift) = 'both'")
        rows = cursor.fetchall()
        
        for row in rows:
            emp_code = row['employee_code']
            # Find assignment
            assignment = EmployeeAssignment.objects.with_deleted().filter(employee__employee_code=emp_code).first()
            
            if assignment and assignment.shift != 'both':
                old_shift = assignment.shift
                assignment.shift = 'both'
                assignment.save()
                logger.info(f"  ✓ Fixed {emp_code}: {old_shift} -> both")
                updated_count += 1
                
    conn.close()
    logger.info(f"Done. Updated {updated_count} records.")

if __name__ == '__main__':
    fix_shifts()
