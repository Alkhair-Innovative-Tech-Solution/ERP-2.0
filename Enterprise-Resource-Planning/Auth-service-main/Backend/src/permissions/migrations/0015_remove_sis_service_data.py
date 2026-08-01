"""
Cleanup: remove the legacy 'sis' Service row and any ServiceAccess rows for
it. Data-only migration — does NOT touch the Service/ServiceAccess models
(shared, unchanged) or historical migrations (0001, 0004 are left alone).

'sis' ("School Information System") was a legacy test product, confirmed
unused by the owner. At the time this migration was written, live-DB
verification showed zero active ServiceAccess rows for 'sis' — this
migration is expected to be a no-op there and only remove the empty
Service registry row. See docs/CLEANUP_SIS_REMOVAL_RESULT.md.

Reversible: re-creates the Service row (ServiceAccess rows, if any existed,
cannot be reconstructed by a reverse migration — but none existed at
removal time, so nothing is lost in practice).
"""
from django.db import migrations


def remove_sis(apps, schema_editor):
    ServiceAccess = apps.get_model('permissions', 'ServiceAccess')
    Service = apps.get_model('permissions', 'Service')

    ServiceAccess.objects.filter(service='sis').delete()
    Service.objects.filter(code='sis').delete()


def restore_sis(apps, schema_editor):
    Service = apps.get_model('permissions', 'Service')
    Service.objects.get_or_create(code='sis', defaults={'name': 'School Information System', 'is_active': True})


class Migration(migrations.Migration):

    dependencies = [
        ('permissions', '0014_delete_hdmsrole'),
    ]

    operations = [
        migrations.RunPython(remove_sis, restore_sis),
    ]
