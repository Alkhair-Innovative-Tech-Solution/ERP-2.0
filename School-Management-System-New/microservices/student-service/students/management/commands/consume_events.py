import logging
from django.core.management.base import BaseCommand
from ams_shared.events.consumer import start_consumer

logger = logging.getLogger(__name__)

QUEUE_NAME = "student-service.events"
ROUTING_KEYS = [
    "org.created", "org.updated",
    "campus.created", "campus.updated",
    "classes.level.created", "classes.level.updated",
    "classes.grade.created", "classes.grade.updated",
    "classes.classroom.created", "classes.classroom.updated",
]


def _sync_org(payload):
    from users.models import Organization
    org_id = payload.get('id')
    if not org_id:
        return
    fields = {
        'name': payload.get('name', f'Org-{org_id}'),
        'max_users': payload.get('max_users', 50),
        'max_students': payload.get('max_students', 1000),
        'max_campuses': payload.get('max_campuses', 3),
        'is_active': payload.get('is_active', True),
    }
    if payload.get('code_prefix'):
        fields['code_prefix'] = payload['code_prefix']
    if payload.get('code_pattern'):
        fields['code_pattern'] = payload['code_pattern']
    org, created = Organization.all_objects.get_or_create(id=org_id, defaults=fields)
    if not created:
        for k, v in fields.items():
            setattr(org, k, v)
        org.save(update_fields=list(fields.keys()))
    logger.info("Synced org %s (created=%s)", org_id, created)


def _sync_campus(payload):
    from campus.models import Campus
    campus_id = payload.get('id')
    if not campus_id:
        return
    fields = {
        'campus_name': payload.get('campus_name', f'Campus-{campus_id}'),
        'campus_code': payload.get('campus_code', ''),
        'status': payload.get('status', 'active'),
        'organization_id': payload.get('organization_id'),
    }
    campus, created = Campus.objects.get_or_create(id=campus_id, defaults=fields)
    if not created:
        for k, v in fields.items():
            if v is not None:
                setattr(campus, k, v)
        campus.save(update_fields=[k for k, v in fields.items() if v is not None])
    logger.info("Synced campus %s (created=%s)", campus_id, created)


def _sync_level(payload):
    from classes.models import Level
    level_id = payload.get('id')
    if not level_id:
        return
    fields = {
        'name': payload.get('name', f'Level-{level_id}'),
        'code': payload.get('code'),
        'shift': payload.get('shift', 'morning'),
        'campus_id': payload.get('campus_id'),
        'organization_id': payload.get('organization_id'),
    }
    level, created = Level.objects.get_or_create(id=level_id, defaults=fields)
    if not created:
        for k, v in fields.items():
            if v is not None:
                setattr(level, k, v)
        level.save(update_fields=[k for k, v in fields.items() if v is not None])
    logger.info("Synced level %s (created=%s)", level_id, created)


def _sync_grade(payload):
    from classes.models import Grade
    grade_id = payload.get('id')
    if not grade_id:
        return
    fields = {
        'name': payload.get('name', f'Grade-{grade_id}'),
        'code': payload.get('code'),
        'shift': payload.get('shift', 'morning'),
        'level_id': payload.get('level_id'),
        'campus_id': payload.get('campus_id'),
        'organization_id': payload.get('organization_id'),
    }
    grade, created = Grade.objects.get_or_create(id=grade_id, defaults=fields)
    if not created:
        for k, v in fields.items():
            if v is not None:
                setattr(grade, k, v)
        grade.save(update_fields=[k for k, v in fields.items() if v is not None])
    logger.info("Synced grade %s (created=%s)", grade_id, created)


def _sync_classroom(payload):
    from classes.models import ClassRoom, Grade
    classroom_id = payload.get('id')
    grade_id = payload.get('grade_id')
    if not classroom_id or not grade_id:
        return

    # Ensure grade exists locally (create placeholder if needed)
    grade, _ = Grade.objects.get_or_create(
        id=grade_id,
        defaults={
            'name': payload.get('grade_name', f'Grade-{grade_id}'),
            'code': payload.get('grade_code'),
            'level_id': payload.get('level_id'),
            'campus_id': payload.get('campus_id'),
            'organization_id': payload.get('organization_id'),
        }
    )

    fields = {
        'code': payload.get('code', ''),
        'section': payload.get('section', 'A'),
        'shift': payload.get('shift', 'morning'),
        'capacity': payload.get('capacity', 30),
        'grade': grade,
        'organization_id': payload.get('organization_id'),
    }
    classroom, created = ClassRoom.objects.get_or_create(id=classroom_id, defaults=fields)
    if not created:
        for k, v in fields.items():
            if v is not None:
                setattr(classroom, k, v)
        classroom.save(update_fields=[k for k, v in fields.items() if v is not None])
    logger.info("Synced classroom %s (created=%s)", classroom_id, created)


HANDLERS = {
    'org.created': _sync_org,
    'org.updated': _sync_org,
    'campus.created': _sync_campus,
    'campus.updated': _sync_campus,
    'classes.level.created': _sync_level,
    'classes.level.updated': _sync_level,
    'classes.grade.created': _sync_grade,
    'classes.grade.updated': _sync_grade,
    'classes.classroom.created': _sync_classroom,
    'classes.classroom.updated': _sync_classroom,
}


class _SuperuserContext:
    is_authenticated = True
    role = 'superadmin'
    org_id = None
    organization = None

    def is_superadmin(self):
        return True


def handle_event(routing_key, payload):
    try:
        from users.middleware import _user_var, _organization_var
        token_u = _user_var.set(_SuperuserContext())
        token_o = _organization_var.set(None)
    except Exception:
        token_u = token_o = None

    try:
        handler = HANDLERS.get(routing_key)
        if handler:
            handler(payload)
        else:
            logger.warning("No handler for routing_key: %s", routing_key)
    finally:
        try:
            if token_u is not None:
                _user_var.reset(token_u)
            if token_o is not None:
                _organization_var.reset(token_o)
        except Exception:
            pass


class Command(BaseCommand):
    help = "Consume RabbitMQ events and sync data locally"

    def handle(self, *args, **options):
        self.stdout.write("Starting student-service event consumer...")
        start_consumer(ROUTING_KEYS, handle_event, QUEUE_NAME)
