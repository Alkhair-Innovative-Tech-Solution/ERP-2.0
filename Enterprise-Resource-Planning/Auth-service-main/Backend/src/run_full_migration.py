"""
Unified SIS → Auth Service Migration Script
===========================================
This script handles the FULL migration process in one go:
1. Setup Base HRMS Data (Institution, Depts, Designations)
2. Migrate Campuses to Branches (with Timestamps)
3. Migrate Employees (with History, SMS Data, and Timestamps)

Usage:
    python run_full_migration.py --dry-run  # Test first
    python run_full_migration.py            # Live migration
"""

import os
import sys
import django
import psycopg2
from psycopg2.extras import RealDictCursor
import logging
from datetime import datetime

# --- DJANGO SETUP ---
sys.path.insert(0, 'd:/ERP/auth-service/src')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from employees.models import (
    Organization, Institution, Branch, Department, 
    Designation, Employee, EmployeeAssignment
)

# --- LOGGING SETUP ---
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# --- CONFIGURATION ---
SIS_DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'sms_iak_db',
    'user': 'erp_admin',
    'password': 'erp_admin_password_change_me_in_prod'
}
INSTITUTION_CODE = 'AKS'

# ==============================================================================
# STEP 1: BASE DATA SETUP (HRMS HIERARCHY)
# ==============================================================================
def setup_base_data():
    logger.info("\n" + "="*60)
    logger.info("STEP 1: SETTING UP BASE HRMS DATA")
    logger.info("="*60)
    
    org = Organization.objects.first()
    if not org:
        logger.error("  ✗ CRITICAL: No Organization found! Please create one in Admin first.")
        sys.exit(1)

    # 1. Institution
    inst, created = Institution.objects.get_or_create(
        inst_code=INSTITUTION_CODE,
        defaults={
            'name': 'Al-Khair Secondary Schools', 
            'organization': org, 
            'inst_type': 'educational'
        }
    )
    if created: logger.info(f"  ✓ Created Institution: {inst.name} ({INSTITUTION_CODE})")
    else: logger.info(f"  ℹ Institution {INSTITUTION_CODE} already exists.")

    # 2. Departments
    dept_acad, c_acad = Department.objects.get_or_create(
        institution=inst, dept_code='ACAD',
        defaults={'dept_name': 'Academic Department'}
    )
    dept_admin, c_admin = Department.objects.get_or_create(
        institution=inst, dept_code='ADMIN',
        defaults={'dept_name': 'Administration Department'}
    )
    if c_acad: logger.info("  ✓ Created Academic Department")
    if c_admin: logger.info("  ✓ Created Administration Department")

    # 3. Designations
    Designation.objects.get_or_create(department=dept_acad, position_code='T', defaults={'position_name': 'Teacher'})
    Designation.objects.get_or_create(department=dept_acad, position_code='C', defaults={'position_name': 'Coordinator'})
    Designation.objects.get_or_create(department=dept_admin, position_code='P', defaults={'position_name': 'Principal'})
    
    logger.info("✓ Base HRMS hierarchy is ready.")
    return inst

# ==============================================================================
# STEP 2: CAMPUS MIGRATION (100% FIELD PARITY - 85+ FIELDS)
# ==============================================================================
def migrate_campuses(inst, dry_run=False):
    logger.info("\n" + "="*60)
    logger.info("STEP 2: CAMPUS → BRANCH MIGRATION")
    logger.info("="*60)
    
    conn = psycopg2.connect(**SIS_DB_CONFIG)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute("SELECT * FROM campus_campus ORDER BY id")
    campuses = cursor.fetchall()
    logger.info(f"✓ Found {len(campuses)} campuses in SIS.")
    
    stats = {'total': len(campuses), 'created': 0, 'skipped': 0, 'errors': 0}
    
    for c in campuses:
        campus_id = c['id']
        campus_name = c['campus_name']
        
        if Branch.objects.filter(legacy_campus_id=campus_id).exists():
            logger.info(f"  ⊙ SKIPPED: {campus_name} (Already migrated)")
            stats['skipped'] += 1
            continue
            
        logger.info(f"  Processing: {campus_name} ({c['campus_code']})")
        
        # 1. Direct Model Fields
        common_fields = {
            'branch_code': c['campus_code'],
            'branch_name': c['campus_name'],
            'address': c['address_full'],
            'city': c['city'],
            'district': c['district'],
            'postal_code': c['postal_code'],
            'contact_number': c['primary_phone'],
            'secondary_contact': c['secondary_phone'],
            'email': c['official_email'],
            'branch_head_name': c['campus_head_name'],
            'branch_head_contact': c['campus_head_phone'],
            'branch_head_email': c['campus_head_email'],
            'established_year': c['established_year'],
            'registration_number': c['registration_number'],
            'status': c['status'],
            'legacy_campus_id': campus_id,
        }

        # 2. Exhaustive Domain Data (School Metrics) - 100% Parity
        domain_data = {
            'type': 'school',
            'campus_id': c['campus_id'],
            'campus_type': c['campus_type'],
            'campus_photo': c.get('campus_photo', ''),
            'governing_body': c['governing_body'],
            'accreditation': c['accreditation'],
            'instruction_language': c['instruction_language'],
            'academic_year_start': str(c['academic_year_start']) if c['academic_year_start'] else None,
            'academic_year_end': str(c['academic_year_end']) if c['academic_year_end'] else None,
            'academic_year_start_month': c['academic_year_start_month'],
            'academic_year_end_month': c['academic_year_end_month'],
            'shift_available': c['shift_available'],
            'grades_available': c['grades_available'],
            'grades_offered': c['grades_offered'],
            # Staff Counts
            'total_staff_members': c['total_staff_members'],
            'total_teachers': c['total_teachers'],
            'male_teachers': c['male_teachers'],
            'female_teachers': c['female_teachers'],
            'total_maids': c['total_maids'],
            'total_coordinators': c['total_coordinators'],
            'total_guards': c['total_guards'],
            'other_staff': c['other_staff'],
            'total_non_teaching_staff': c['total_non_teaching_staff'],
            # Student Counts
            'total_students': c['total_students'],
            'male_students': c['male_students'],
            'female_students': c['female_students'],
            'student_capacity': c['student_capacity'],
            'morning_students': c['morning_students'],
            'afternoon_students': c['afternoon_students'],
            'avg_class_size': c['avg_class_size'],
            # Shift detailed stats
            'morning_male_students': c['morning_male_students'],
            'morning_female_students': c['morning_female_students'],
            'morning_total_students': c['morning_total_students'],
            'afternoon_male_students': c['afternoon_male_students'],
            'afternoon_female_students': c['afternoon_female_students'],
            'afternoon_total_students': c['afternoon_total_students'],
            # Infrastructure
            'total_rooms': c.get('total_rooms', 0),
            'total_classrooms': c.get('total_classrooms', 0),
            'total_offices': c.get('total_offices', 0),
            'num_computer_labs': c.get('num_computer_labs', 0),
            'num_science_labs': c.get('num_science_labs', 0),
            'num_biology_labs': c.get('num_biology_labs', 0),
            'num_chemistry_labs': c.get('num_chemistry_labs', 0),
            'num_physics_labs': c.get('num_physics_labs', 0),
            'library_available': c.get('library_available', False),
            'power_backup': c.get('power_backup', False),
            'internet_available': c.get('internet_available', False),
            'canteen_facility': c.get('canteen_facility', False),
            'meal_program': c.get('meal_program', False),
            'teacher_transport': c.get('teacher_transport', False),
            # Washrooms
            'total_washrooms': c.get('total_washrooms', 0),
            'staff_washrooms': c.get('staff_washrooms', 0),
            'student_washrooms': c.get('student_washrooms', 0),
            'male_teachers_washrooms': c.get('male_teachers_washrooms', 0),
            'female_teachers_washrooms': c.get('female_teachers_washrooms', 0),
            'male_student_washrooms': c.get('male_student_washrooms', 0),
            'female_student_washrooms': c.get('female_student_washrooms', 0),
            'sports_available': c.get('sports_available', ''),
            'is_draft': c.get('is_draft', False),
        }

        if dry_run:
            logger.info(f"  ✓ Would create branch: {campus_name} ({len(domain_data)} fields)")
            stats['created'] += 1
            continue

        try:
            branch = Branch.objects.create(institution=inst, domain_data=domain_data, **common_fields)
            Branch.objects.filter(id=branch.id).update(created_at=c['created_at'], updated_at=c['updated_at'])
            logger.info(f"  ✓ CREATED: {branch.branch_id}")
            stats['created'] += 1
        except Exception as e:
            logger.error(f"  ✗ ERROR: {e}")
            stats['errors'] += 1

    conn.close()
    logger.info(f"\nCAMPUS SUMMARY: Total: {stats['total']}, Created: {stats['created']}, Skipped: {stats['skipped']}, Errors: {stats['errors']}")

# ==============================================================================
# STEP 3: EMPLOYEE MIGRATION (100% LOGIC PARITY)
# ==============================================================================
def migrate_employees(inst, dry_run=False):
    logger.info("\n" + "="*60)
    logger.info("STEP 3: EMPLOYEE MIGRATION (PROFILE + DATA ENRICHMENT)")
    logger.info("="*60)
    
    conn = psycopg2.connect(**SIS_DB_CONFIG)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    desig_map = {
        'teachers_teacher': Designation.objects.get(department__dept_code='ACAD', position_code='T'),
        'coordinator_coordinator': Designation.objects.get(department__dept_code='ACAD', position_code='C'),
        'principals_principal': Designation.objects.get(department__dept_code='ADMIN', position_code='P'),
    }
    
    branches = { b.legacy_campus_id: b for b in Branch.objects.filter(legacy_campus_id__isnull=False) }
    branch_codes = { b.branch_code: b for b in Branch.objects.all() }
    
    stats = {'total': 0, 'migrated': 0, 'duplicates': 0, 'errors': 0}

    for table, designation in desig_map.items():
        logger.info(f"\n--- Migrating {table} ---")
        cursor.execute(f"SELECT * FROM {table} ORDER BY id")
        rows = cursor.fetchall()
        
        for row in rows:
            stats['total'] += 1
            full_name = row['full_name']
            emp_code = row.get('employee_code')
            cnic = row.get('cnic', '')
            email = (row.get('email') or '').lower().strip()
            
            logger.info(f"Processing: {full_name} [{emp_code or 'NO CODE'}]")

            # 1. Identity & Collision Logic
            existing_by_cnic = Employee.objects.with_deleted().filter(cnic=cnic).first() if cnic else None
            existing_by_code = Employee.objects.with_deleted().filter(employee_code=emp_code).first() if emp_code else None
            existing = existing_by_cnic or existing_by_code
            
            if existing:
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
                        employee = existing
                        logger.info(f"  ℹ Employee exists with no assignments. Completing profile...")
                else:
                    if existing_by_cnic and not existing_by_code:
                        logger.warning(f"  ⚠ CNIC COLLISION: {full_name} has same CNIC as {existing_by_cnic.full_name}. Using unique CNIC.")
                        cnic = f"MIG-{stats['total']}"
                        existing = None # Create new
                    elif existing_by_code:
                        logger.error(f"  ✗ CODE COLLISION: {full_name} has same Code {emp_code} as {existing_by_code.full_name}. Skipping!")
                        stats['errors'] += 1
                        continue

            if not existing:
                # 2. Field Mapping (Gender fallback, Email sync)
                p_email = email if not email.endswith('@iak.ngo') else None
                o_email = email if email.endswith('@iak.ngo') else None
                if not o_email and not p_email: p_email = f"migrated.{stats['total']}@example.com"
                
                gender = 'female' if 'female' in (row.get('gender') or '').lower() else 'male'
                
                marital = (row.get('marital_status') or '').lower()
                if 'single' in marital: marital = 'single'
                elif 'married' in marital: marital = 'married'
                elif 'divorce' in marital: marital = 'divorce'
                elif 'widow' in marital: marital = 'widowed'
                else: marital = 'single'

                # 3. Education & Work JSON
                edu_history = []
                if row.get('education_level'):
                    edu_history.append({
                        "degree": row['education_level'],
                        "institute": row.get('institution_name', 'N/A'),
                        "passingYear": str(row.get('year_of_passing', '')),
                        "grade": row.get('education_grade', 'N/A'),
                        "subjects": row.get('education_subjects', 'N/A')
                    })
                
                work_exp = []
                if row.get('previous_institution_name') or row.get('total_experience_years'):
                    work_exp.append({
                        "employer": row.get('previous_institution_name', 'Previous'),
                        "jobTitle": row.get('previous_position', 'Previous Position'),
                        "totalYears": str(row.get('total_experience_years', '0')),
                    })

                if dry_run:
                    logger.info(f"  ✓ Would create Employee: {full_name}")
                    stats['migrated'] += 1
                    continue

                is_deleted = row.get('is_deleted', False)
                employee = Employee.objects.create(
                    full_name=full_name,
                    employee_code=emp_code,
                    cnic=cnic or f"MIG-{stats['total']}",
                    dob=row.get('dob') or '1900-01-01',
                    gender=gender,
                    marital_status=marital,
                    personal_phone=row.get('contact_number'),
                    personal_email=p_email,
                    org_email=o_email,
                    permanent_address=row.get('permanent_address'),
                    residential_address=row.get('current_address') or row.get('residential_address'),
                    education_history=edu_history,
                    work_experience=work_exp,
                    organization=inst.organization,
                    is_active=not is_deleted,
                    is_deleted=is_deleted,
                    deleted_at=row.get('deleted_at')
                )
                sis_ts = row.get('date_created') or row.get('created_at') or datetime.now()
                Employee.objects.filter(id=employee.id).update(created_at=sis_ts, updated_at=sis_ts)

            # 4. Assignment & SMS Role Data
            branch = branches.get(row.get('campus_id') or row.get('current_campus_id'))
            if not branch and emp_code: branch = branch_codes.get(emp_code.split('-')[0])
            
            role_data = {
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
                    assignment = EmployeeAssignment.objects.create(
                        employee=employee,
                        branch=branch or branch_codes.get('C01'),
                        institution=inst,
                        department=designation.department,
                        designation=designation,
                        joining_date=row.get('joining_date') or datetime.now().date(),
                        shift=row.get('shift', 'morning').lower() if isinstance(row.get('shift'), str) else 'morning',
                        role_data=role_data,
                        is_active=not employee.is_deleted,
                        is_deleted=employee.is_deleted,
                        deleted_at=employee.deleted_at
                    )
                    EmployeeAssignment.objects.filter(id=assignment.id).update(created_at=sis_ts, updated_at=sis_ts)
                    logger.info(f"  ✓ SUCCESS: {employee.employee_code} (Deleted: {employee.is_deleted})")
                    stats['migrated'] += 1
                except Exception as e:
                    logger.error(f"  ✗ ERROR creating assignment for {full_name}: {e}")
                    stats['errors'] += 1

    conn.close()
    logger.info("\n" + "="*50)
    logger.info("FINAL EMPLOYEE SUMMARY")
    logger.info("="*50)
    logger.info(f"Total processed: {stats['total']}")
    logger.info(f"Successful:      {stats['migrated']}")
    logger.info(f"Duplicates:      {stats['duplicates']}")
    logger.info(f"Errors:          {stats['errors']}")
    logger.info("="*50)

    conn.close()

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================
if __name__ == '__main__':
    dry = '--dry-run' in sys.argv
    logger.info("=" * 60)
    logger.info("STARTING CONSOLIDATED SIS MIGRATION")
    logger.info("=" * 60)
    
    inst = setup_base_data()
    migrate_campuses(inst, dry_run=dry)
    migrate_employees(inst, dry_run=dry)
    
    logger.info("\n" + "=" * 60)
    logger.info("MIGRATION COMPLETE!")
    logger.info("=" * 60)
