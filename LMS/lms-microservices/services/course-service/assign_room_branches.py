import os, sys, django
sys.path.insert(0,'/app')
os.environ['DJANGO_SETTINGS_MODULE']='course_service.settings'
django.setup()
from courses.models import Room, Branch

branches_by_name = {b.name: b for b in Branch.objects.all()}
branches_by_code = {b.code: b for b in Branch.objects.all()}

# Assign rooms to different branches
room_updates = {
    '0 | C': 'Main Branch',
    '1 | A': 'Main Branch',
    '2 | A': 'Main Branch',
    '2 | B': 'Main Branch',
    '2 | C': 'Main Branch',
    '1 | B': 'Main Branch',
}

# Room capacity overrides (set when room doesn't have one or needs specific value)
capacity_updates = {
    '0 | C': 33,
    '2 | C': 50,
}

updated = 0
for room_name, branch_name in room_updates.items():
    branch = branches_by_name.get(branch_name) or branches_by_code.get('MAIN')
    if not branch:
        print(f'Branch {branch_name} not found (and no code=MAIN fallback)')
        continue
    cnt = Room.objects.filter(name=room_name).update(branch=branch)
    updated += cnt
    print(f'Room "{room_name}" -> {branch_name} ({cnt})')

# Apply capacity overrides
for room_name, cap in capacity_updates.items():
    cnt = Room.objects.filter(name=room_name).update(capacity=cap)
    if cnt:
        print(f'Room "{room_name}" capacity -> {cap}')

# Now reassign scheduled class branches from their rooms
from courses.models import ScheduledClass
reassigned = 0
for sc in ScheduledClass.objects.filter(active=True).select_related('room__branch'):
    if sc.room and sc.room.branch:
        sc.branch = sc.room.branch
        sc.save(update_fields=['branch'])
        reassigned += 1

print(f'Reassigned {reassigned} scheduled classes from rooms')
print('Done')
