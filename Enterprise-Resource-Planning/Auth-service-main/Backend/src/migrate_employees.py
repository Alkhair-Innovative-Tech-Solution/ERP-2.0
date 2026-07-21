"""
Unified Employee Migration Script (Direct Table Version)
=========================================================
Migrates Teachers, Coordinators, and Principals from SIS to Auth Service.

Key Features:
1. Migrates directly from Profile tables (No Users table join needed).
2. Uses existing Employee Codes from SIS tables.
3. Maps Branch via campus_id OR parses from Employee Code (C01, C02, etc.).
4. Categorizes emails: @iak.ngo -> org_email, Others -> personal_email.
5. Handles duplicate CNICs (logs warning, does not block).

Usage:
    python migrate_employees.py --dry-run
    python migrate_employees.py
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

from employees.models import Employee, EmployeeAssignment, Branch, Institution, Department, Designation

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

INSTITUTION_CODE = 'AKS'

# ========================================
# HELPER FUNCTIONS
# ========================================

def get_base_records():
    """Fetch required base records from Auth Service"""
    try:
        inst = Institution.objects.get(inst_code=INSTITUTION_CODE)
        dept_acad = Department.objects.get(institution=inst, dept_code='ACAD')
        dept_admin = Department.objects.get(institution=inst, dept_code='ADMIN')
        
        desig_teacher = Designation.objects.get(department=dept_acad, position_code='T')
        desig_coord = Designation.objects.get(department=dept_acad, position_code='C')
        desig_principal = Designation.objects.get(department=dept_admin, position_code='P')
        
        return {
            'inst': inst,
            'dept_acad': dept_acad,
            'dept_admin': dept_admin,
            'desig_teacher': desig_teacher,
            'desig_coord': desig_coord,
            'desig_principal': desig_principal
        }
    except Exception as e:
        logger.error(f"Required base records (Institution/Dept/Desig) missing: {e}")
        sys.exit(1)

def map_gender(sis_gender):
    if not sis_gender: return 'female'
    g = sis_gender.lower()
    if 'female' in g: return 'female'
    if 'male' in g: return 'male'
    return 'female' # Default to female instead of 'other'

def map_shift(code):
    """Map SIS code character to Auth shift name"""
    mapping = {
        'M': 'morning',
        'A': 'afternoon',
        'B': 'general',
        'G': 'general'
    }
    return mapping.get(code, 'general')

# ========================================
# MIGRATION LOGIC
# ========================================

def migrate_employees(dry_run=False):
    base = get_base_records()
    
    # Branch Map (SIS legacy_campus_id -> Auth Branch object)
    branches = { b.legacy_campus_id: b for b in Branch.objects.filter(legacy_campus_id__isnull=False) }
    # Branch Code Map (C01, C02 -> Auth Branch object)
    branch_codes = { b.branch_code: b for b in Branch.objects.all() }
    
    conn = psycopg2.connect(**SIS_DB_CONFIG)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    jobs = [
        ('teachers_teacher', 'teacher', base['desig_teacher']),
        ('coordinator_coordinator', 'coordinator', base['desig_coord']),
        ('principals_principal', 'principal', base['desig_principal']),
    ]
    
    stats = {'total': 0, 'migrated': 0, 'duplicates': 0, 'errors': 0}

    for table, label, designation in jobs:
        logger.info(f"\n--- Migrating {label.capitalize()}s from {table} ---")
        
        query = f"SELECT * FROM {table} ORDER BY id"
        cursor.execute(query)
        rows = cursor.fetchall()
        
        for row in rows:
            stats['total'] += 1
            full_name = row['full_name']
            emp_code = row.get('employee_code')
            cnic = row.get('cnic', '')
            email = row.get('email', '').lower().strip()
            
            # Determine Branch
            # 1. From Table Column (current_campus_id or campus_id)
            sis_campus_id = row.get('current_campus_id') or row.get('campus_id')
            branch = branches.get(sis_campus_id)
            
            # 2. From Employee Code Parsing (if branch not found)
            if not branch and emp_code:
                parts = emp_code.split('-')
                if len(parts) > 0:
                    code_prefix = parts[0] # e.g. C01
                    branch = branch_codes.get(code_prefix)
            
            if not branch:
                logger.warning(f"  ⚠ Branch not found for {full_name} [{emp_code}]. Defaulting to C01.")
                branch = branch_codes.get('C01')

            logger.info(f"Processing: {full_name} [{emp_code or 'NO CODE'}]")
            
            # Check for existing employee (include soft-deleted)
            existing_by_cnic = Employee.objects.with_deleted().filter(cnic=cnic).first() if cnic else None
            existing_by_code = Employee.objects.with_deleted().filter(employee_code=emp_code).first() if emp_code else None
            
            existing = existing_by_cnic or existing_by_code
            
            if existing:
                # Check if it's the SAME person (same name/email)
                is_same_person = (
                    existing.full_name.lower() == full_name.lower() or 
                    (existing.personal_email and existing.personal_email == email) or 
                    (existing.org_email and existing.org_email == email)
                )

                if is_same_person:
                    if existing.assignments.exists():
                        logger.info(f"  ℹ Employee {full_name} already exists with assignments. Skipping.")
                        stats['duplicates'] += 1
                        continue
                    else:
                        logger.info(f"  ℹ Employee {full_name} exists but no assignments. Completing...")
                        employee = existing
                else:
                    # Collision! CNIC or Code belongs to someone else
                    if existing_by_cnic and not existing_by_code:
                        logger.warning(f"  ⚠ CNIC COLLISION: {full_name} has same CNIC as {existing_by_cnic.full_name}. Using unique CNIC.")
                        cnic = f"MIG-{stats['total']}"
                        existing = None # Proceed to create new
                    elif existing_by_code:
                        logger.error(f"  ✗ CODE COLLISION: {full_name} has same Code {emp_code} as {existing_by_code.full_name}. Skipping!")
                        stats['errors'] += 1
                        continue
            
            if not existing:
                # Email Categorization
                p_email = None
                o_email = None
                if email:
                    if email.endswith('@iak.ngo'):
                        o_email = email
                    else:
                        p_email = email
                
                # Fallback for Org Email if missing
                if not o_email and not p_email:
                    p_email = f"migrated.{stats['total']}@example.com"

                # Prep Employee Data
                is_deleted = row.get('is_deleted', False)
                emp_data = {
                    'full_name': full_name,
                    'cnic': cnic or f"MIG-{stats['total']}", 
                    'dob': row.get('dob') or '1900-01-01',
                    'gender': map_gender(row.get('gender')),
                    'personal_phone': row.get('contact_number'),
                    'personal_email': p_email,
                    'org_email': o_email,
                    'permanent_address': row.get('permanent_address'),
                    'residential_address': row.get('current_address') or row.get('residential_address'),
                    'organization': base['inst'].organization,
                    'is_active': not is_deleted,
                    'is_deleted': is_deleted,
                    'deleted_at': row.get('deleted_at')
                }
                
                if dry_run:
                    logger.info(f"  ✓ Would create Employee: {full_name} in {branch.branch_code} (Deleted: {is_deleted})")
                    stats['migrated'] += 1
                    continue

                # 1. Create Employee
                employee = Employee(**emp_data)
                if emp_code:
                    employee.employee_code = emp_code
                employee.save()
                
                # Override Timestamps with SIS data
                sis_created = row.get('date_created') or row.get('created_at')
                sis_updated = row.get('date_updated') or row.get('updated_at')
                Employee.objects.filter(id=employee.id).update(
                    created_at=sis_created,
                    updated_at=sis_updated
                )

            try:
                # 2. Create Assignment
                # ... (shift logic) ...
                shift_val = row.get('shift', 'morning')
                if isinstance(shift_val, str):
                    shift_name = shift_val.lower()
                    if shift_name == 'both': shift_name = 'general'
                else:
                    shift_name = 'morning'

                assignment = EmployeeAssignment.objects.create(
                    employee=employee,
                    branch=branch,
                    institution=base['inst'],
                    department=designation.department,
                    designation=designation,
                    joining_date=row.get('joining_date') or datetime.now().date(),
                    shift=shift_name,
                    is_primary=True,
                    is_active=not employee.is_deleted,
                    is_deleted=employee.is_deleted,
                    deleted_at=employee.deleted_at
                )

                # Override Assignment Timestamps
                EmployeeAssignment.objects.filter(id=assignment.id).update(
                    created_at=sis_created,
                    updated_at=sis_updated
                )
                
                # Force SIS code again
                if emp_code and employee.employee_code != emp_code:
                    employee.employee_code = emp_code
                    employee.save(update_fields=['employee_code'])

                logger.info(f"  ✓ SUCCESS: {employee.employee_code} (Deleted: {employee.is_deleted})")
                stats['migrated'] += 1
                
            except Exception as e:
                logger.error(f"  ✗ ERROR creating {full_name}: {e}")
                stats['errors'] += 1

    cursor.close()
    conn.close()
    
    logger.info("\n" + "="*50)
    logger.info("FINAL MIGRATION SUMMARY")
    logger.info("="*50)
    logger.info(f"Total processed: {stats['total']}")
    logger.info(f"Successful:      {stats['migrated']}")
    logger.info(f"Duplicates:      {stats['duplicates']}")
    logger.info(f"Errors:          {stats['errors']}")
    logger.info("="*50)

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Migrate SIS employees to Auth Service')
    parser.add_argument('--dry-run', action='store_true', help='Test without making changes')
    args = parser.parse_args()
    
    migrate_employees(dry_run=args.dry_run)
