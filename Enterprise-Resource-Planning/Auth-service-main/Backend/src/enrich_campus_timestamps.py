"""
Campus Timestamp Enrichment
===========================
Updates Branch created_at/updated_at to match SIS.
"""
import os
import sys
import django
import psycopg2
from psycopg2.extras import RealDictCursor
import logging

# Setup Django
sys.path.insert(0, 'd:/ERP/auth-service/src')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from employees.models import Branch

SIS_DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'sms_iak_db',
    'user': 'erp_admin',
    'password': 'erp_admin_password_change_me_in_prod'
}

def enrich_campuses():
    conn = psycopg2.connect(**SIS_DB_CONFIG)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute("SELECT id, created_at, updated_at FROM campus_campus")
    rows = cursor.fetchall()
    
    for row in rows:
        legacy_id = row['id']
        Branch.objects.filter(legacy_campus_id=legacy_id).update(
            created_at=row['created_at'],
            updated_at=row['updated_at']
        )
        print(f"Updated Branch with legacy_id {legacy_id}")

    conn.close()

if __name__ == '__main__':
    enrich_campuses()
