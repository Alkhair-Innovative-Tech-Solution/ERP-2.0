import os.path
import json
import logging
import uuid
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from django.conf import settings

logger = logging.getLogger(__name__)

# Scopes for Synchronizing (matching existing admission token)
SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

def get_sheets_service():
    """Returns a Google Sheets API service instance."""
    creds = None
    # Paths for credentials - checking both local and absolute (Docker)
    token_path = "token.json"
    creds_path = "credentials.json"
    
    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception as e:
                logger.error(f"Error refreshing token: {e}")
                creds = None
        
        if not creds:
            if not os.path.exists(creds_path):
                logger.error(f"Credentials file not found at {creds_path}")
                return None
            # On a server, this might fail as it requires interactive browser.
            # Usually, you'd use a Service Account for this.
            # But we are reusing the existing flow pattern.
            flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES)
            creds = flow.run_local_server(port=0)
        
        with open(token_path, "w") as token:
            token.write(creds.to_json())
            
    return build("sheets", "v4", credentials=creds)

def sync_scheduled_class_to_sheets(instance):
    """
    Syncs a ScheduledClass instance to Google Sheets.
    Maps fields to the column structure requested by the user.
    """
    try:
        service = get_sheets_service()
        if not service:
            logger.error("Could not obtain Google Sheets service.")
            return False
        
        # Spreadsheet ID and Tab name
        spreadsheet_id = "17wAlHTw5jyvsEmNXlcnOCJvRZo978zIfH4magwSwkBU"
        tab_name = "Specializations and TimeTable"
        range_name = f"'{tab_name}'!A2"
        
        # Prepare the row data based on the user's table structure:
        # Specialization | Course | Code | Section | Duration | Days | Time | Strength | Status | Students | Lab | Teacher | ...
        
        days_str = ", ".join(instance.days)
        start_time_str = instance.start_time.strftime("%I:%M %p").lower() if instance.start_time else ""
        end_time_str = instance.end_time.strftime("%I:%M %p").lower() if instance.end_time else ""
        time_range = f"{start_time_str} - {end_time_str}"
        
        row_values = [
            instance.course.specialization.name,
            instance.course.name,
            instance.course.course_code or "",
            instance.section or "",
            f"{instance.course.duration} Months",
            days_str,
            time_range,
            instance.get_strength_status_display(),
            "Active" if instance.active else "Inactive",
            instance.total_students,
            instance.lab_room or "",
            instance.teacher_name or "TBD",
            str(instance.admission_open_date) if instance.admission_open_date else "",
            str(instance.course_start_date) if instance.course_start_date else "",
            str(instance.course_end_date) if instance.course_end_date else "",
            str(instance.exam_date) if instance.exam_date else "",
            instance.exam_status or "",
            str(instance.certificate_date) if instance.certificate_date else "",
            instance.certificate_status or "",
            instance.total_applications,
            instance.whatsapp_group_link_boys or "",
            instance.whatsapp_group_link_girls or ""
        ]
        
        body = {"values": [row_values]}
        
        # Append as a new row
        service.spreadsheets().values().append(
            spreadsheetId=spreadsheet_id,
            range=range_name,
            valueInputOption="USER_ENTERED",
            body=body
        ).execute()
        
        logger.info(f"Successfully synced class {instance.id} to Google Sheets tab '{tab_name}'.")
        return True
        
    except Exception as e:
        logger.error(f"Error syncing to Google Sheets: {e}")
        return False
