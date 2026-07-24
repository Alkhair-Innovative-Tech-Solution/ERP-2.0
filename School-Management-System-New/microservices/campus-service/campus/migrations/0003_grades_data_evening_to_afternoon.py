from django.db import migrations


def evening_to_afternoon(apps, schema_editor):
    """Campus.grades_data is the JSON source the post_save signal reads to
    (re)create Level/Grade/ClassRoom rows. A frontend bug tagged the second
    shift in "Both Shifts" campuses as 'evening' instead of 'afternoon' — fix
    it here too so a future re-save of the campus doesn't resurrect it."""
    Campus = apps.get_model('campus', 'Campus')
    for campus in Campus.objects.all():
        entries = campus.grades_data
        if not isinstance(entries, list):
            continue
        changed = False
        for entry in entries:
            if isinstance(entry, dict) and entry.get('shift') == 'evening':
                entry['shift'] = 'afternoon'
                changed = True
        if changed:
            campus.save(update_fields=['grades_data'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('campus', '0002_initial'),
    ]

    operations = [
        migrations.RunPython(evening_to_afternoon, noop_reverse),
    ]
