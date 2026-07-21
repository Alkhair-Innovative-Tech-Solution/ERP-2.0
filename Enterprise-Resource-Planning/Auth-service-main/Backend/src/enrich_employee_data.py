"""
Employee Enrichment Script
==========================
Enriches existing Employee records in Auth Service with:
1. SIS Timestamps (created_at, updated_at).
2. Missing HR fields: marital_status, education_history, work_experience.
3. Cleanup: Change 'other' gender to 'female'.

Run after: migrate_employees.py
"""

import os
import sys
import django
import psycopg2
from psycopg2.extras import RealDictCursor
import logging
from datetime import datetime

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# Setup Django
sys.path.insert(0, 'd:/ERP/auth-service/src')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from employees.models import Employee, EmployeeAssignment

# ========================================
# CONFIGURATION
# ========================================
SIS_DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'sms_iak_db',
    'user': 'erp_admin',
    'password': 'erp_admin_password_change_me_in_prod'
}

def enrich_employees(dry_run=False):
    conn = psycopg2.connect(**SIS_DB_CONFIG)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    tables = ['teachers_teacher', 'coordinator_coordinator', 'principals_principal']
    
    stats = {'total': 0, 'updated': 0, 'skipped': 0, 'errors': 0}
    
    for t in tables:
        logger.info(f"\n--- Fetching enrichment data from {t} ---")
        cursor.execute(f"SELECT * FROM {t}")
        rows = cursor.fetchall()
        
        for row in rows:
            emp_code = row.get('employee_code')
            if not emp_code: continue
            
            stats['total'] += 1
            
            # Find existing employee
            employee = Employee.objects.with_deleted().filter(employee_code=emp_code).first()
            if not employee:
                logger.warning(f"  ⚠ Employee {emp_code} not found in Auth Service. Skipping.")
                stats['skipped'] += 1
                continue

            # 1. Timestamps
            created_at = row.get('date_created') or row.get('created_at')
            updated_at = row.get('date_updated') or row.get('updated_at')
            
            # 2. Gender Cleanup
            gender = employee.gender
            if gender == 'other':
                gender = 'female'
            
            # 3. Marital Status (Standardize)
            marital = row.get('marital_status', '').lower() if row.get('marital_status') else None
            if marital:
                if 'single' in marital: marital = 'single'
                elif 'married' in marital: marital = 'married'
                elif 'divorce' in marital: marital = 'divorce'
                elif 'widow' in marital: marital = 'widowed'
            # 4. Education History
            edu_history = []
            if row.get('education_level'):
                edu_history.append({
                    "degree": row['education_level'],
                    "institute": row.get('institution_name', 'N/A'),
                    "passingYear": str(row.get('year_of_passing', '')),
                    "grade": row.get('education_grade', 'N/A'),
                    "subjects": row.get('education_subjects', 'N/A')
                })
            
            # 5. Work Experience
            work_exp = []
            if row.get('previous_institution_name') or row.get('total_experience_years'):
                work_exp.append({
                    "employer": row.get('previous_institution_name', 'Previous Employer'),
                    "jobTitle": row.get('previous_position', 'Previous Position'),
                    "totalYears": str(row.get('total_experience_years', '0')),
                })

            # 6. Domain Specific Data (SMS)
            academic_role_data = {
                "sms_data": {
                    "current_subjects": row.get('current_subjects'),
                    "classes_taught": row.get('current_classes_taught'),
                    "is_class_teacher": row.get('is_class_teacher', False),
                    "classroom_id": row.get('assigned_classroom_id'),
                },
                "capabilities": {
                    "can_assign_class_teachers": row.get('can_assign_class_teachers', False)
                }
            }

            if not dry_run:
                try:
                    # Update core fields
                    employee.gender = gender
                    employee.marital_status = marital
                    employee.education_history = edu_history
                    employee.work_experience = work_exp
                    employee.save()
                    
                    # Update timestamps via Update (to avoid auto_now overrides)
                    Employee.objects.filter(id=employee.id).update(
                        created_at=created_at,
                        updated_at=updated_at
                    )
                    
                    # Update Assignments for this employee too
                    # Also set the role_data here
                    EmployeeAssignment.objects.with_deleted().filter(employee=employee).update(
                        created_at=created_at,
                        updated_at=updated_at,
                        role_data=academic_role_data
                    )
                    
                    logger.info(f"  ✓ Updated {emp_code} (Gender: {gender}, SMS History included)")
                    stats['updated'] += 1
                except Exception as e:
                    logger.error(f"  ✗ Error updating {emp_code}: {e}")
                    stats['errors'] += 1
            else:
                logger.info(f"  ✓ Would update {emp_code}: Gender -> {gender}, Marital -> {marital}")
                stats['updated'] += 1

    cursor.close()
    conn.close()
    
    logger.info(f"\nSummary: Total: {stats['total']}, Updated: {stats['updated']}, Skipped: {stats['skipped']}, Errors: {stats['errors']}")

if __name__ == '__main__':
    dry = '--dry-run' in sys.argv
    enrich_employees(dry_run=dry)
