"""Check for syntax errors in admin files"""
import os
import sys
import django

sys.path.insert(0, 'd:/ERP/auth-service/src')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib import admin
print("Admin files imported successfully.")
print("SuperAdmin registered:", admin.site.is_registered(django.apps.apps.get_model('authentication', 'SuperAdmin')))
print("Checks passed.")
