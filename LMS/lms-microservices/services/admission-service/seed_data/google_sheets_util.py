import os.path
import csv
import json
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]


def read_csv_data(filepath):
    """
    Read a CSV file and return list of dicts.
    Same return format as get_sheet_data().
    """
    if not os.path.exists(filepath):
        print(f"   [read_csv_data] File not found: {filepath}")
        return []
    try:
        with open(filepath, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            headers = [h.strip() for h in (reader.fieldnames or [])]
            if not headers:
                return []
            rows = []
            for row in reader:
                cleaned = {k.strip() if k else '': v.strip() if v else '' for k, v in row.items()}
                rows.append(cleaned)
            print(f"   [read_csv_data] {len(rows)} rows loaded from {filepath}")
            return rows
    except Exception as e:
        print(f"   [read_csv_data] Error reading {filepath}: {e}")
        return []


def get_service():
    creds = None
    # Look for token/credentials in current dir or /app root
    token_path = "token.json"
    if not os.path.exists(token_path):
        if os.path.exists("/app/token.json"): token_path = "/app/token.json"
        elif os.path.exists("seed_data/token.json"): token_path = "seed_data/token.json"
        elif os.path.exists("/app/seed_data/token.json"): token_path = "/app/seed_data/token.json"
        elif os.path.exists("../token.json"): token_path = "../token.json"

    creds_path = "credentials.json"
    if not os.path.exists(creds_path):
        if os.path.exists("/app/credentials.json"): creds_path = "/app/credentials.json"
        elif os.path.exists("seed_data/credentials.json"): creds_path = "seed_data/credentials.json"
        elif os.path.exists("/app/seed_data/credentials.json"): creds_path = "/app/seed_data/credentials.json"
        elif os.path.exists("../credentials.json"): creds_path = "../credentials.json"

    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(creds_path):
                raise FileNotFoundError(f"Missing {creds_path}")
            flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(token_path, "w") as token:
            token.write(creds.to_json())
    return build("sheets", "v4", credentials=creds)

def list_sheets(spreadsheet_id):
    try:
        service = get_service()
        spreadsheet = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
        sheets = spreadsheet.get('sheets', [])
        return [sheet.get('properties', {}).get('title') for sheet in sheets]
    except Exception as e:
        print(f"Error listing sheets: {e}")
        return []

def get_sheet_data(spreadsheet_id, range_name):
    try:
        service = get_service()
        result = service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id, range=range_name).execute()
        values = result.get("values", [])
        if not values: return []
        
        headers = [h.strip() for h in values[0]]
        rows = []
        for row in values[1:]:
            if len(row) < len(headers):
                row.extend([''] * (len(headers) - len(row)))
            rows.append(dict(zip(headers, row)))
        return rows
    except Exception as e:
        print(f"Error getting data: {e}")
        return []

if __name__ == "__main__":
    sid = "17wAlHTw5jyvsEmNXlcnOCJvRZo978zIfH4magwSwkBU"
    print("Fetching sheet titles...")
    titles = list_sheets(sid)
    print(f"Tabs found: {titles}")
