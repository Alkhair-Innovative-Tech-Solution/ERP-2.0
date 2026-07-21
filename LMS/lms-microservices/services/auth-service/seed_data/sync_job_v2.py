import json
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings')
django.setup()

from users.models import ReceiptCode, User
from django.utils import timezone

try:
    with open('/app/deposits_sync_v2.json', 'r') as f:
        data = json.load(f)
        
    count = 0
    for entry in data:
        lms_id = entry.get('lms_user_id')
        receipt_no = entry.get('receipt_number')
        course_id = entry.get('course_id')
        amount = entry.get('deposit_amount', 3000)
        bag = entry.get('bag_taken', True)
        card = entry.get('id_card_taken', True)
        
        if lms_id and receipt_no:
            # 1. Look up the user
            user = User.objects.filter(id=lms_id).first()
            if not user:
                continue
                
            # 2. Update or Create ReceiptCode
            rc, created = ReceiptCode.objects.update_or_create(
                student_email=user.email,
                defaults={
                    'code': f'MIG-{user.email[:5]}-{lms_id[:4]}',
                    'student_name': user.full_name,
                    'lms_user_id': user.id,
                    'receipt_number': receipt_no,
                    'course_id': course_id,
                    'deposit_amount': amount,
                    'bag_taken': bag,
                    'id_card_taken': card,
                    'verified': True,
                    'lms_account_created': True,
                    'added_to_system_at': timezone.now()
                }
            )
            count += 1

    print(f'SUCCESS: Harmonized {count} ENRICHED receipt records (Courses & Amounts).')
except Exception as e:
    print(f'ERROR: {str(e)}')
