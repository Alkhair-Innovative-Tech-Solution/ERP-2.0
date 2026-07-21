import os
import django
from django.conf import settings

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
    tables = cursor.fetchall()
    print("Tables found in DB:")
    for table in tables:
        print(f"- {table[0]}")
