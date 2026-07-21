import os, sys, django
sys.path.insert(0,'/app')
os.environ['DJANGO_SETTINGS_MODULE']='course_service.settings'
django.setup()
from courses.models import Room, Branch
for r in Room.objects.all():
    b = r.branch
    name = b.name if b else 'None'
    bid = str(b.id) if b else 'N/A'
    print(f'Room {r.name}: branch={name} (id={bid})')
