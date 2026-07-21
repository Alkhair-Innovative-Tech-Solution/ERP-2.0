import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

def fix_schema():
    queries = [
        # Add institution_id to EmployeeAssignment
        "ALTER TABLE employees_employeeassignment ADD COLUMN IF NOT EXISTS institution_id uuid;",
        "ALTER TABLE employees_employeeassignment ADD CONSTRAINT employees_employeeassignment_institution_id_fk FOREIGN KEY (institution_id) REFERENCES employees_institution(id) DEFERRABLE INITIALLY DEFERRED;",
        
        # Add organization_id if it's also missing (checked earlier, it was)
        "ALTER TABLE employees_employeeassignment ADD COLUMN IF NOT EXISTS organization_id uuid;",
        "ALTER TABLE employees_employeeassignment ADD CONSTRAINT employees_employeeassignment_organization_id_fk FOREIGN KEY (organization_id) REFERENCES employees_organization(id) DEFERRABLE INITIALLY DEFERRED;",
    ]
    
    with connection.cursor() as cursor:
        print("Starting Manual Schema FIX...")
        for query in queries:
            try:
                cursor.execute(query)
                print(f"Executed: {query[:70]}...")
            except Exception as e:
                if "already exists" in str(e):
                    print(f"Skipped: {query[:70]}... (Already exists)")
                else:
                    print(f"Error: {query[:70]}... (Reason: {str(e)})")
        print("Schema FIX Complete!")

if __name__ == '__main__':
    fix_schema()
