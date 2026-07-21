import os
import sys
import django

# Setup Django
sys.path.insert(0, 'd:/ERP/auth-service/src')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from employees.models import Employee, EmployeeAssignment, Designation

def verify_migration():
    print("MIGRATION VERIFICATION REPORT")
    print("="*30)
    
    total_employees = Employee.objects.with_deleted().count()
    total_assignments = EmployeeAssignment.objects.with_deleted().count()
    
    print(f"Total Employees in DB (incl deleted):    {total_employees}")
    print(f"Total Assignments in DB (incl deleted):  {total_assignments}")
    
    # Check by Designation
    for d in Designation.objects.all():
        count = EmployeeAssignment.objects.with_deleted().filter(designation=d).count()
        print(f"Designation {d.position_name:12}: {count}")
    
    # Check for Employees without Assignments
    orphans = Employee.objects.with_deleted().filter(assignments__isnull=True).count()
    print(f"Employees w/o assignments: {orphans}")
    
    if orphans > 0:
        print("\nOrphan Employees (First 5):")
        for e in Employee.objects.filter(assignments__isnull=True)[:5]:
            print(f"- {e.full_name} ({e.employee_code})")

if __name__ == '__main__':
    verify_migration()
