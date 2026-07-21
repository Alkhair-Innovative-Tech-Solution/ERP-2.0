"""
User import service for bulk user creation.
"""
import pandas as pd
import base64
from io import BytesIO
from django.db import transaction
from apps.users.models import User


class ImportService:
    """Service for importing users from CSV/Excel."""
    
    def import_users(self, file_data: str) -> dict:
        """
        Import users from base64 encoded CSV/Excel file.
        
        Returns:
            dict: {
                'success': int,
                'failed': int,
                'errors': List[str]
            }
        """
        try:
            # Decode base64 file data
            file_bytes = base64.b64decode(file_data)
            file_io = BytesIO(file_bytes)
            
            # Read file (supports both CSV and Excel)
            try:
                df = pd.read_excel(file_io)
            except:
                file_io.seek(0)
                df = pd.read_csv(file_io)
            
            success_count = 0
            failed_count = 0
            errors = []
            
            with transaction.atomic():
                for index, row in df.iterrows():
                    try:
                        # Validate required fields
                        if pd.isna(row.get('employee_code')):
                            errors.append(f"Row {index + 2}: Missing employee_code")
                            failed_count += 1
                            continue
                        
                        # Create user
                        user = User.objects.create_user(
                            employee_code=str(row['employee_code']),
                            email=row.get('email') if not pd.isna(row.get('email')) else None,
                            first_name=row.get('first_name', ''),
                            last_name=row.get('last_name', ''),
                            password=row.get('password', 'defaultpassword123'),  # Should be changed on first login
                            role=row.get('role', 'requestor'),
                        )
                        
                        if not pd.isna(row.get('department_id')):
                            user.department_id = str(row['department_id'])
                            user.save()
                        
                        success_count += 1
                    except Exception as e:
                        errors.append(f"Row {index + 2}: {str(e)}")
                        failed_count += 1
            
            return {
                'success': success_count,
                'failed': failed_count,
                'errors': errors[:10]  # Limit errors to first 10
            }
        except Exception as e:
            return {
                'success': 0,
                'failed': 0,
                'errors': [f"Import failed: {str(e)}"]
            }


