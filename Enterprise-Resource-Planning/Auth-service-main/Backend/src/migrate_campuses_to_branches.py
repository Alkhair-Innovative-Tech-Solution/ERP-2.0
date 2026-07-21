"""
Campus → Branch Migration Script
=================================
Run this AFTER:
1. Adding Branch model to auth-service
2. Running Django migrations
3. Creating "Al-Khair Schools" institution

Usage:
    python migrate_campuses_to_branches.py --dry-run  # Test first
    python migrate_campuses_to_branches.py            # Actual migration
"""

import os
import sys
import django
from datetime import datetime

# Setup Django
sys.path.insert(0, 'd:/ERP/auth-service/src')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from employees.models import Institution, Branch
import psycopg2
from psycopg2.extras import RealDictCursor

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

INSTITUTION_CODE = 'AKS'  # Al-Khair Schools

# ========================================
# FIELD MAPPING
# ========================================
def map_campus_to_branch(campus_row):
    """
    Map SIS Campus fields to Branch model
    Returns: (common_fields_dict, domain_data_dict)
    """
    
    # Common fields (direct mapping)
    common_fields = {
        'branch_code': campus_row['campus_code'],
        'branch_name': campus_row['campus_name'],
        'address': campus_row['address_full'],
        'city': campus_row['city'],
        'district': campus_row['district'],
        'postal_code': campus_row['postal_code'],
        'contact_number': campus_row['primary_phone'],
        'secondary_contact': campus_row['secondary_phone'],
        'email': campus_row['official_email'],
        'branch_head_name': campus_row['campus_head_name'],
        'branch_head_contact': campus_row['campus_head_phone'],
        'branch_head_email': campus_row['campus_head_email'],
        'established_year': campus_row['established_year'],
        'registration_number': campus_row['registration_number'],
        'status': campus_row['status'],
        'legacy_campus_id': campus_row['id'],
    }
    
    # Domain-specific data (school-specific fields → JSON)
    domain_data = {
        'type': 'school',
        'campus_id': campus_row['campus_id'],
        'campus_type': campus_row['campus_type'],
        'campus_photo': campus_row.get('campus_photo', ''),
        
        # Academic
        'governing_body': campus_row['governing_body'],
        'accreditation': campus_row['accreditation'],
        'instruction_language': campus_row['instruction_language'],
        'academic_year_start': str(campus_row['academic_year_start']) if campus_row['academic_year_start'] else None,
        'academic_year_end': str(campus_row['academic_year_end']) if campus_row['academic_year_end'] else None,
        'academic_year_start_month': campus_row['academic_year_start_month'],
        'academic_year_end_month': campus_row['academic_year_end_month'],
        'shift_available': campus_row['shift_available'],
        'grades_available': campus_row['grades_available'],
        'grades_offered': campus_row['grades_offered'],
        
        # Staff
        'total_staff_members': campus_row['total_staff_members'],
        'total_teachers': campus_row['total_teachers'],
        'male_teachers': campus_row['male_teachers'],
        'female_teachers': campus_row['female_teachers'],
        'total_maids': campus_row['total_maids'],
        'total_coordinators': campus_row['total_coordinators'],
        'total_guards': campus_row['total_guards'],
        'other_staff': campus_row['other_staff'],
        'total_non_teaching_staff': campus_row['total_non_teaching_staff'],
        
        # Students
        'total_students': campus_row['total_students'],
        'male_students': campus_row['male_students'],
        'female_students': campus_row['female_students'],
        'student_capacity': campus_row['student_capacity'],
        'morning_students': campus_row['morning_students'],
        'afternoon_students': campus_row['afternoon_students'],
        'avg_class_size': campus_row['avg_class_size'],
        
        # Shift-wise students
        'morning_male_students': campus_row['morning_male_students'],
        'morning_female_students': campus_row['morning_female_students'],
        'morning_total_students': campus_row['morning_total_students'],
        'afternoon_male_students': campus_row['afternoon_male_students'],
        'afternoon_female_students': campus_row['afternoon_female_students'],
        'afternoon_total_students': campus_row['afternoon_total_students'],
        
        # Shift-wise teachers
        'morning_male_teachers': campus_row['morning_male_teachers'],
        'morning_female_teachers': campus_row['morning_female_teachers'],
        'morning_total_teachers': campus_row['morning_total_teachers'],
        'afternoon_male_teachers': campus_row['afternoon_male_teachers'],
        'afternoon_female_teachers': campus_row['afternoon_female_teachers'],
        'afternoon_total_teachers': campus_row['afternoon_total_teachers'],
        
        # Infrastructure
        'total_rooms': campus_row['total_rooms'],
        'total_classrooms': campus_row['total_classrooms'],
        'total_offices': campus_row['total_offices'],
        'num_computer_labs': campus_row['num_computer_labs'],
        'num_science_labs': campus_row['num_science_labs'],
        'num_biology_labs': campus_row['num_biology_labs'],
        'num_chemistry_labs': campus_row['num_chemistry_labs'],
        'num_physics_labs': campus_row['num_physics_labs'],
        'library_available': campus_row['library_available'],
        'power_backup': campus_row['power_backup'],
        'internet_available': campus_row['internet_available'],
        'teacher_transport': campus_row['teacher_transport'],
        'canteen_facility': campus_row['canteen_facility'],
        'meal_program': campus_row['meal_program'],
        
        # Washrooms
        'total_washrooms': campus_row['total_washrooms'],
        'staff_washrooms': campus_row['staff_washrooms'],
        'student_washrooms': campus_row['student_washrooms'],
        'male_teachers_washrooms': campus_row['male_teachers_washrooms'],
        'female_teachers_washrooms': campus_row['female_teachers_washrooms'],
        'male_student_washrooms': campus_row['male_student_washrooms'],
        'female_student_washrooms': campus_row['female_student_washrooms'],
        
        # Sports
        'sports_available': campus_row['sports_available'],
        
        # System
        'is_draft': campus_row['is_draft'],
        'created_at': str(campus_row['created_at']),
        'updated_at': str(campus_row['updated_at']),
    }
    
    return common_fields, domain_data

# ========================================
# MIGRATION LOGIC
# ========================================
def migrate_campuses(dry_run=False):
    """
    Migrate all SIS campuses to auth-service branches
    """
    print("=" * 60)
    print("CAMPUS → BRANCH MIGRATION")
    print("=" * 60)
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE MIGRATION'}")
    print()
    
    # Get institution
    try:
        institution = Institution.objects.get(inst_code=INSTITUTION_CODE)
        print(f"✓ Found institution: {institution.name} ({institution.inst_code})")
    except Institution.DoesNotExist:
        print(f"✗ ERROR: Institution with code '{INSTITUTION_CODE}' not found!")
        print("  Please create it first:")
        print(f"  Institution.objects.create(")
        print(f"      organization=Organization.objects.first(),")
        print(f"      inst_code='AKS',")
        print(f"      name='Al-Khair Secondary Schools',")
        print(f"      inst_type='educational'")
        print(f"  )")
        return
    
    # Connect to SIS database
    print(f"\n✓ Connecting to SIS database: {SIS_DB_CONFIG['database']}")
    conn = psycopg2.connect(**SIS_DB_CONFIG)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Fetch all campuses (including drafts, all statuses)
    cursor.execute("SELECT * FROM campus_campus ORDER BY id")
    campuses = cursor.fetchall()
    
    print(f"✓ Found {len(campuses)} campuses in SIS")
    print()
    
    # Migration stats
    stats = {
        'total': len(campuses),
        'created': 0,
        'skipped': 0,
        'errors': []
    }
    
    # Migrate each campus
    for campus in campuses:
        campus_id = campus['id']
        campus_code = campus['campus_code']
        campus_name = campus['campus_name']
        
        print(f"Processing: {campus_name} ({campus_code}) [ID: {campus_id}]")
        
        try:
            # Check if already migrated
            if Branch.objects.filter(legacy_campus_id=campus_id).exists():
                print(f"  ⊙ SKIPPED: Already migrated")
                stats['skipped'] += 1
                continue
            
            # Map fields
            common_fields, domain_data = map_campus_to_branch(campus)
            
            if dry_run:
                print(f"  ✓ Would create branch:")
                print(f"     Code: {common_fields['branch_code']}")
                print(f"     Name: {common_fields['branch_name']}")
                print(f"     City: {common_fields['city']}")
                print(f"     Status: {common_fields['status']}")
                print(f"     Domain fields: {len(domain_data)} fields")
                stats['created'] += 1
            else:
                # Create branch
                branch = Branch.objects.create(
                    institution=institution,
                    domain_data=domain_data,
                    **common_fields
                )
                
                # Override Timestamps with SIS data
                Branch.objects.filter(id=branch.id).update(
                    created_at=campus['created_at'],
                    updated_at=campus['updated_at']
                )
                
                print(f"  ✓ CREATED: {branch.branch_id}")
                stats['created'] += 1
        
        except Exception as e:
            print(f"  ✗ ERROR: {str(e)}")
            stats['errors'].append({
                'campus_id': campus_id,
                'campus_code': campus_code,
                'error': str(e)
            })
    
    cursor.close()
    conn.close()
    
    # Print summary
    print()
    print("=" * 60)
    print("MIGRATION SUMMARY")
    print("=" * 60)
    print(f"Total campuses: {stats['total']}")
    print(f"Created: {stats['created']}")
    print(f"Skipped (already migrated): {stats['skipped']}")
    print(f"Errors: {len(stats['errors'])}")
    
    if stats['errors']:
        print("\nERRORS:")
        for err in stats['errors']:
            print(f"  - Campus {err['campus_code']} (ID: {err['campus_id']}): {err['error']}")
    
    # Verification
    if not dry_run:
        print("\n" + "=" * 60)
        print("VERIFICATION")
        print("=" * 60)
        
        sis_count = stats['total']
        branch_count = Branch.objects.filter(legacy_campus_id__isnull=False).count()
        
        print(f"SIS Campuses: {sis_count}")
        print(f"Auth Branches: {branch_count}")
        
        if sis_count == branch_count:
            print("✓ COUNTS MATCH - Migration successful!")
        else:
            print(f"✗ MISMATCH - {sis_count - branch_count} campuses not migrated")

# ========================================
# MAIN
# ========================================
if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Migrate SIS campuses to auth-service branches')
    parser.add_argument('--dry-run', action='store_true', help='Test migration without making changes')
    args = parser.parse_args()
    
    migrate_campuses(dry_run=args.dry_run)
