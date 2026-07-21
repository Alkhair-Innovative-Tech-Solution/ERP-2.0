"""
SIS User Credentials Migration Script (WITH SUPERADMIN SUPPORT)
================================================================
Migrates user credentials from SIS to Auth Service for centralized single sign-on.

Key Features:
1. Matches SIS users to Auth Service employees by employee_code
2. Creates SuperAdmin records for superadmin users  
3. Copies password hashes directly (PBKDF2 compatible)
4. Grants ServiceAccess for 'sis'
5. Dry-run mode for safe testing

Usage:
    python migrate_credentials.py --dry-run
    python migrate_credentials.py
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

from employees.models import Employee, Organization
from authentication.models import UserCredentials, SuperAdmin
from permissions.models import ServiceAccess

# ========================================
# CONFIGURATION
# ========================================
SIS_DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 5432,
    'database': 'sms_iak_db',
    'user': 'erp_admin',
    'password': 'erp_admin_password_change_me_in_prod'
}

# ========================================
# MIGRATION LOGIC
# ========================================

def migrate_credentials(dry_run=False):
    """
    Migrate SIS user credentials to Auth Service.
    
    Flow:
    1. Fetch all users from SIS users_user table
    2. For employees: Match to Employee by employee_code
    3. For superadmins: Create SuperAdmin record
    4. Create UserCredentials with copied password hash
    5. Grant ServiceAccess for 'sis'
    """
    
    # Connect to SIS
    logger.info("Connecting to SIS database...")
    sis_conn = psycopg2.connect(**SIS_DB_CONFIG)
    sis_cursor = sis_conn.cursor(cursor_factory=RealDictCursor)
    
    # Fetch all SIS users
    logger.info("Fetching SIS users...")
    sis_cursor.execute("""
        SELECT id, username, password, email, role, is_active, last_login, 
               first_name, last_name, phone_number
        FROM users_user
        ORDER BY id
    """)
    sis_users = sis_cursor.fetchall()
    logger.info(f"Found {len(sis_users)} users in SIS")
    
    # Statistics
    stats = {
        'total': len(sis_users),
        'employees_matched': 0,
        'superadmins_found': 0,
        'superadmins_created': 0,
        'not_found': 0,
        'already_exists': 0,
        'migrated': 0,
        'errors': 0
    }
    
    logger.info("\n" + "="*60)
    logger.info("STARTING CREDENTIAL MIGRATION")
    logger.info("="*60)
    
    # Get default organization for superadmins
    default_org = Organization.objects.first()
    
    for sis_user in sis_users:
        username = sis_user['username']
        password_hash = sis_user['password']
        email = sis_user.get('email', '')
        role = sis_user.get('role', 'unknown')
        is_active = sis_user.get('is_active', True)
        first_name = sis_user.get('first_name', '')
        last_name = sis_user.get('last_name', '')
        phone = sis_user.get('phone_number', '')
        
        logger.info(f"\nProcessing: {username} ({role})")
        
        # Handle SUPERADMIN separately
        if role == 'superadmin':
            stats['superadmins_found'] += 1
            
            # Check if SuperAdmin already exists
            superadmin = SuperAdmin.objects.filter(superadmin_code=username).first()
            
            if not superadmin:
                if dry_run:
                    logger.info(f"  ✓ Would create SuperAdmin: {username}")
                    stats['superadmins_created'] += 1
                else:
                    # Create SuperAdmin
                    full_name = f"{first_name} {last_name}".strip() or username
                    superadmin = SuperAdmin.objects.create(
                        superadmin_code=username,
                        full_name=full_name,
                        email=email or f"{username}@iak.ngo",
                        phone=phone,
                        is_active=is_active,
                        organization=default_org
                    )
                    logger.info(f"  ✓ Created SuperAdmin: {full_name}")
                    stats['superadmins_created'] += 1
            else:
                logger.info(f"  ℹ SuperAdmin {username} already exists")
            
            # Check if credentials exist
            if superadmin:
                existing_credentials = UserCredentials.objects.filter(superadmin=superadmin).first()
                
                if existing_credentials:
                    stats['already_exists'] += 1
                    if dry_run:
                        logger.info(f"  ℹ Credentials exist - would UPDATE password")
                        stats['migrated'] += 1
                        continue
                    else:
                        # Update credentials
                        existing_credentials.password_hash = password_hash
                        existing_credentials.last_login = sis_user.get('last_login')
                        existing_credentials.save()
                        logger.info(f"  ✓ Updated UserCredentials")
                        
                        # Ensure ServiceAccess exists for SuperAdmin  
                        existing_access = ServiceAccess.objects.filter(
                            superadmin=superadmin,
                            service='sis'
                        ).first()
                        
                        if existing_access:
                            logger.info(f"  ℹ SIS ServiceAccess already exists")
                        else:
                            try:
                                ServiceAccess.objects.create(
                                    superadmin=superadmin,
                                    service='sis',
                                    is_active=is_active,
                                    granted_by=None,
                                    notes=f'Migrated from SIS on {datetime.now().date()}'
                                )
                                logger.info(f"  ✓ Granted SIS ServiceAccess")
                            except Exception as e:
                                logger.error(f"  ✗ Error creating ServiceAccess: {e}")
                                stats['errors'] += 1
                        
                        stats['migrated'] += 1
                        logger.info(f"  ✓ SUCCESS: {username}")
                        continue
                
                if dry_run:
                    logger.info(f"  ✓ Would create UserCredentials for SuperAdmin")
                    logger.info(f"  ✓ Would grant SIS ServiceAccess")
                    stats['migrated'] += 1
                    continue
                
                # Create credentials
                try:
                    UserCredentials.objects.create(
                        superadmin=superadmin,
                        password_hash=password_hash,
                        last_login=sis_user.get('last_login'),
                        failed_login_attempts=0
                    )
                    logger.info(f"  ✓ Created UserCredentials")
                    
                    # Grant SIS ServiceAccess for SuperAdmin
                    existing_access = ServiceAccess.objects.filter(
                        superadmin=superadmin,
                        service='sis'
                    ).first()
                    
                    if existing_access:
                        logger.info(f"  ℹ SIS ServiceAccess already exists")
                    else:
                        try:
                            ServiceAccess.objects.create(
                                superadmin=superadmin,
                                service='sis',
                                is_active=is_active,
                                granted_by=None,
                                notes=f'Migrated from SIS on {datetime.now().date()}'
                            )
                            logger.info(f"  ✓ Granted SIS ServiceAccess")
                        except Exception as e:
                            logger.error(f"  ✗ Error creating ServiceAccess: {e}")
                            stats['errors'] += 1
                    
                    stats['migrated'] += 1
                    logger.info(f"  ✓ SUCCESS: {username}")
                except Exception as e:
                    stats['errors'] += 1
                    logger.error(f"  ✗ ERROR: {e}")
            
            continue
        
        # Handle EMPLOYEES (teachers, coordinators, principals)
        try:
            employee = Employee.objects.get(employee_code=username)
            stats['employees_matched'] += 1
            logger.info(f"  ✓ Matched to Employee: {employee.full_name} (ID: {employee.id})")
        except Employee.DoesNotExist:
            stats['not_found'] += 1
            logger.warning(f"  ⚠ Employee not found with code: {username}. Skipping.")
            continue
        except Employee.MultipleObjectsReturned:
            stats['errors'] += 1
            logger.error(f"  ✗ Multiple employees found with code: {username}. Skipping.")
            continue
        
        # Check if credentials already exist
        existing_credentials = UserCredentials.objects.filter(employee=employee).first()
        
        if existing_credentials:
            stats['already_exists'] += 1
            if dry_run:
                logger.info(f"  ℹ Credentials exist - would UPDATE password for {employee.full_name}")
                stats['migrated'] += 1
                continue
            else:
                # Update existing credentials
                logger.info(f"  ℹ Updating existing credentials for {employee.full_name}")
                existing_credentials.password_hash = password_hash
                existing_credentials.last_login = sis_user.get('last_login')
                existing_credentials.save()
                logger.info(f"  ✓ Updated UserCredentials")
                
                # Ensure ServiceAccess exists
                service_access, created = ServiceAccess.objects.get_or_create(
                    employee=employee,
                    service='sis',
                    defaults={
                        'is_active': is_active,
                        'granted_by': None,
                        'notes': f'Migrated from SIS on {datetime.now().date()}'
                    }
                )
                
                if created:
                    logger.info(f"  ✓ Granted SIS ServiceAccess")
                else:
                    logger.info(f"  ℹ SIS ServiceAccess already exists")
                
                stats['migrated'] += 1
                logger.info(f"  ✓ SUCCESS: {employee.employee_code}")
                continue

        
        if dry_run:
            logger.info(f"  ✓ Would create UserCredentials for {employee.full_name}")
            logger.info(f"  ✓ Would grant SIS ServiceAccess")
            stats['migrated'] += 1
            continue
        
        try:
            # Create UserCredentials
            credentials = UserCredentials.objects.create(
                employee=employee,
                password_hash=password_hash,  # Direct copy from SIS
                last_login=sis_user.get('last_login'),
                failed_login_attempts=0,
                locked_until=None
            )
            logger.info(f"  ✓ Created UserCredentials")
            
            # Grant SIS ServiceAccess
            service_access, created = ServiceAccess.objects.get_or_create(
                employee=employee,
                service='sis',
                defaults={
                    'is_active': is_active,
                    'granted_by': None,  # Migration, no specific admin
                    'notes': f'Migrated from SIS on {datetime.now().date()}'
                }
            )
            
            if created:
                logger.info(f"  ✓ Granted SIS ServiceAccess")
            else:
                logger.info(f"  ℹ SIS ServiceAccess already exists")
            
            stats['migrated'] += 1
            logger.info(f"  ✓ SUCCESS: {employee.employee_code}")
            
        except Exception as e:
            stats['errors'] += 1
            logger.error(f"  ✗ ERROR migrating {username}: {e}")
    
    # Close SIS connection
    sis_cursor.close()
    sis_conn.close()
    
    # Final Summary
    logger.info("\n" + "="*60)
    logger.info("MIGRATION SUMMARY")
    logger.info("="*60)
    logger.info(f"Total SIS users:        {stats['total']}")
    logger.info(f"Employees matched:      {stats['employees_matched']}")
    logger.info(f"SuperAdmins found:      {stats['superadmins_found']}")
    logger.info(f"SuperAdmins created:    {stats['superadmins_created']}")
    logger.info(f"Not found in Auth:      {stats['not_found']}")
    logger.info(f"Already had credentials: {stats['already_exists']}")
    logger.info(f"Successfully migrated:  {stats['migrated']}")
    logger.info(f"Errors:                 {stats['errors']}")
    logger.info("="*60)
    
    if dry_run:
        logger.info("\n*** DRY RUN MODE - NO CHANGES MADE ***")


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Migrate SIS user credentials to Auth Service')
    parser.add_argument('--dry-run', action='store_true', help='Test without making changes')
    args = parser.parse_args()
    
    migrate_credentials(dry_run=args.dry_run)
