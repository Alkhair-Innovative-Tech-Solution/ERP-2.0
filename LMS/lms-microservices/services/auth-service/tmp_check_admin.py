import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings')
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
admin = User.objects.get(email='admin@ait.com')
admin.set_password('admin123')
admin.save()
print(f'Password reset successfully for {admin.email}')
print(f'New password check: {admin.check_password("admin123")}')
