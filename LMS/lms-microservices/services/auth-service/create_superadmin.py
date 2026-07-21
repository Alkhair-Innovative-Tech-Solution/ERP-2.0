#!/usr/bin/env python
"""Create superuser for AIT-LMS"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings')
sys.path.insert(0, '/app')
sys.path.insert(0, '/app/shared')

django.setup()

from users.models import User
import uuid

# Check if superuser already exists
if User.objects.filter(email='superadmin@ait.edu').exists():
    print('Superuser already exists: superadmin@ait.edu')
else:
    user = User(
        id=uuid.uuid4(),
        full_name='Super Admin',
        email='superadmin@ait.edu',
        phone='+92-300-1234567',
        role='admin',
        is_staff=True,
        is_admin=True,
        is_superuser=True,
        is_active=True,
    )
    user.set_password('admin123')
    user.save()
    print(f'Superuser created: {user.email}')
    print(f'ID: {user.id}')
    print(f'Password: admin123')
