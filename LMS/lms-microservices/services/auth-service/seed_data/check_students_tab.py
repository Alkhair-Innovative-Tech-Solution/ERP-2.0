import sys; sys.path.append('/app')
from google_sheets_util import get_sheet_data
rows = get_sheet_data('17wAlHTw5jyvsEmNXlcnOCJvRZo978zIfH4magwSwkBU', "Students!A1:AQ10")
if rows:
    print('Headers:', list(rows[0].keys()))
    print('Row 1:', rows[0])
