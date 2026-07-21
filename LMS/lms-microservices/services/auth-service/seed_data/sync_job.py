import json
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings')
django.setup()

from users.models import ReceiptCode, User, Student
from django.utils import timezone

try:
    with open('/app/deposits_sync.json', 'r') as f:
        data = json.load(f)
        
    count = 0
    for entry in data:
        lms_id = entry.get('lms_user_id')
        receipt_no = entry.get('receipt_number')
        
        if lms_id and receipt_no:
            # 1. Look up the user to get their name and email
            user = User.objects.filter(id=lms_id).first()
            if not user:
                continue
                
            # 2. Get or Create ReceiptCode
            # We use email as the linker if code is not yet assigned
            rc, created = ReceiptCode.objects.get_or_create(
                student_email=user.email,
                defaults={
                    'code': f'MIG-{user.email[:5]}-{lms_id[:4]}',
                    'student_name': user.full_name,
                    'lms_user_id': user.id,
                    'verified': True,
                    'lms_account_created': True,
                    'added_to_system_at': timezone.now()
                }
            )
            
            # 3. Force update the receipt number
            rc.receipt_number = receipt_no
            rc.lms_user_id = user.id
            rc.student_name = user.full_name # Sync name too
            rc.save()
            count += 1

    print(f'SUCCESS: Harmonized {count} receipt records in Registry.')
except Exception as e:
    print(f'ERROR: {str(e)}')
