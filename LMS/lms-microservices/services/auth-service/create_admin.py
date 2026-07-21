import os, sys, django
sys.path.insert(0,'/app')
os.environ['DJANGO_SETTINGS_MODULE']='users.settings'
django.setup()
from users.models import User

if not User.objects.filter(email='admin@ait.edu.pk').exists():
    user = User.objects.create_superuser(
        full_name='Super Admin',
        email='admin@ait.edu.pk',
        password='admin123',
        phone='+923001234567',
        cnic='42000-0000000-1',
    )
    user.role = 'admin'
    user.save()
    print('Super admin created: admin@ait.edu.pk / admin123')
else:
    print('Super admin already exists')
