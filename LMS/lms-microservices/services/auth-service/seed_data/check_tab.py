import os
import django
import sys
import json

sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings')
django.setup()

from google_sheets_util import get_sheet_data
print("--- CF0 TAB SAMPLE ---")
data = get_sheet_data('17wAlHTw5jyvsEmNXlcnOCJvRZo978zIfH4magwSwkBU', "'CF0'!A1:F5")
for row in data:
    print(row)
