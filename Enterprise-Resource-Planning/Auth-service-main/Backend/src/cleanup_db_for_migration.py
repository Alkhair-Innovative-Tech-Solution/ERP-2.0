import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

def cleanup_db():
    queries = [
        # Drop unique constraint if exists on department
        "ALTER TABLE employees_department DROP CONSTRAINT IF EXISTS employees_department_institution_id_dept_code_a7c7c34b_uniq;",
        "ALTER TABLE employees_department DROP CONSTRAINT IF EXISTS employees_department_organization_id_dept_code_5c37ca8d_uniq;",
        "ALTER TABLE employees_department DROP CONSTRAINT IF EXISTS employees_department_branch_id_dept_code_key;",
        
        # Drop columns added by previous failed/manual migrations
        "ALTER TABLE employees_department DROP COLUMN IF EXISTS branch_id CASCADE;",
        "ALTER TABLE employees_employeeassignment DROP COLUMN IF EXISTS branch_id CASCADE;",
        
        # Drop the branch table
        "DROP TABLE IF EXISTS employees_branch CASCADE;"
    ]
    
    with connection.cursor() as cursor:
        print("Starting Database Cleanup...")
        for query in queries:
            try:
                cursor.execute(query)
                print(f"Executed: {query[:50]}...")
            except Exception as e:
                print(f"Skipped: {query[:50]}... (Reason: {str(e)})")
        print("Cleanup Complete!")

if __name__ == '__main__':
    cleanup_db()
