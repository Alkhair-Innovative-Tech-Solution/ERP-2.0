"""
Initialize database with initial data.
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.users.models import User, Role
from apps.departments.models import Department


def create_initial_data():
    """Create initial admin user and departments."""
    # Create admin user
    if not User.objects.filter(employee_code='admin').exists():
        admin = User.objects.create_superuser(
            employee_code='admin',
            password='admin123',
            role=Role.ADMIN,
            helpdesk_authorized=True
        )
        print(f"Created admin user: {admin.employee_code}")
    
    # Create sample departments
    departments = [
        {'name': 'IT Department', 'code': 'IT'},
        {'name': 'Finance Department', 'code': 'FIN'},
        {'name': 'HR Department', 'code': 'HR'},
    ]
    
    for dept_data in departments:
        dept, created = Department.objects.get_or_create(
            code=dept_data['code'],
            defaults=dept_data
        )
        if created:
            print(f"Created department: {dept.name}")


if __name__ == '__main__':
    create_initial_data()


