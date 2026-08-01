# Data migration: backfill Coordinator.user from the existing
# employee_code == username convention (see coordinator/models.py:187-198,
# pre-existing signals.py string-matching). Coordinators with no matching
# User are left with user=NULL — no link is invented.
from django.db import migrations


def backfill_coordinator_user(apps, schema_editor):
    Coordinator = apps.get_model('coordinator', 'Coordinator')
    User = apps.get_model('users', 'User')

    matched = 0
    unmatched = []

    for coordinator in Coordinator.objects.filter(user__isnull=True):
        if not coordinator.employee_code:
            unmatched.append((coordinator.id, coordinator.full_name, coordinator.employee_code))
            continue
        user = User.objects.filter(username=coordinator.employee_code).first()
        if user:
            coordinator.user_id = user.id
            coordinator.save(update_fields=['user'])
            matched += 1
        else:
            unmatched.append((coordinator.id, coordinator.full_name, coordinator.employee_code))

    print(f"\n[Coordinator FK backfill] matched: {matched}, unmatched: {len(unmatched)}")
    if unmatched:
        print("[Coordinator FK backfill] unmatched coordinators (id, full_name, employee_code):")
        for row in unmatched:
            print(f"  {row}")


def noop_reverse(apps, schema_editor):
    # Reversible as a no-op: clearing the FK back to NULL is destructive and
    # unnecessary — the schema migration (0004) already removes the column
    # on reverse, taking the data with it.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('coordinator', '0004_coordinator_user'),
    ]

    operations = [
        migrations.RunPython(backfill_coordinator_user, noop_reverse),
    ]
