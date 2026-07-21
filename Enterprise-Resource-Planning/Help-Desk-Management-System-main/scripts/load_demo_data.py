"""
Load demo data for testing.
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.users.models import User, Role
from apps.departments.models import Department


def load_demo_data():
    """Load demo users and data."""
    print("Loading demo data...")
    # Add demo data creation logic here
    print("Demo data loaded successfully!")


if __name__ == '__main__':
    load_demo_data()


