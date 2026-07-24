import logging
from django.core.management.base import BaseCommand
from ams_shared.events.consumer import start_consumer

logger = logging.getLogger(__name__)

QUEUE_NAME = "attendance-service.events"
ROUTING_KEYS = [
    "org.created", "org.updated",
    "campus.created", "campus.updated",
    "classes.level.created", "classes.level.updated",
    "classes.grade.created", "classes.grade.updated",
    "classes.classroom.created", "classes.classroom.updated",
    "student.upserted", "student.deleted",
]


def _sync_org(payload):
    from django.db import connection
    import json
    org_id = payload.get('id')
    if not org_id:
        return
    with connection.cursor() as cur:
        cur.execute("""
            INSERT INTO users_organization (id, name, code_prefix, code_pattern, max_users, max_students, max_campuses, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                name         = EXCLUDED.name,
                code_prefix  = EXCLUDED.code_prefix,
                code_pattern = EXCLUDED.code_pattern,
                max_users    = EXCLUDED.max_users,
                max_students = EXCLUDED.max_students,
                max_campuses = EXCLUDED.max_campuses,
                is_active    = EXCLUDED.is_active
        """, [
            org_id,
            payload.get('name', f'Org-{org_id}'),
            payload.get('code_prefix'),
            payload.get('code_pattern', 'PREFIX_SEQ4'),
            payload.get('max_users', 50),
            payload.get('max_students', 1000),
            payload.get('max_campuses', 3),
            payload.get('is_active', True),
        ])
    logger.info("Synced org %s", org_id)


def _sync_campus(payload):
    from django.db import connection
    campus_id = payload.get('id')
    if not campus_id:
        return
    with connection.cursor() as cur:
        cur.execute("""
            INSERT INTO campus_campus (id, campus_name, campus_code, status, organization_id)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                campus_name     = EXCLUDED.campus_name,
                campus_code     = EXCLUDED.campus_code,
                status          = EXCLUDED.status,
                organization_id = EXCLUDED.organization_id
        """, [
            campus_id,
            payload.get('campus_name', f'Campus-{campus_id}'),
            payload.get('campus_code', ''),
            payload.get('status', 'active'),
            payload.get('organization_id'),
        ])
    logger.info("Synced campus %s", campus_id)


def _upsert_dynamic(table, payload, pk='id'):
    """Upsert payload into `table`, using only columns that exist locally.

    Cross-service payloads omit created_at/updated_at (Django's auto_now is an
    ORM feature, not a DB default), so raw-SQL inserts would violate NOT NULL.
    We fill missing timestamp columns with NOW() on insert; created_at is never
    overwritten on update.
    """
    from django.db import connection
    from django.utils import timezone
    import json
    if not payload.get(pk):
        return
    payload = dict(payload)
    with connection.cursor() as cur:
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = %s AND table_schema = 'public'
        """, [table])
        local_cols = {r[0] for r in cur.fetchall()}

    now = timezone.now()
    for ts_col in ('created_at', 'updated_at'):
        if ts_col in local_cols and payload.get(ts_col) is None:
            payload[ts_col] = now

    cols = [c for c in payload if c in local_cols]
    if pk not in cols:
        return
    # created_at must stay fixed once set — don't overwrite it on conflict update
    non_pk = [c for c in cols if c != pk and c != 'created_at']
    col_list = ', '.join(f'"{c}"' for c in cols)
    placeholders = ', '.join(['%s'] * len(cols))
    updates = ', '.join(f'"{c}" = EXCLUDED."{c}"' for c in non_pk) or f'"{pk}" = EXCLUDED."{pk}"'
    values = [json.dumps(payload[c]) if isinstance(payload[c], (dict, list)) else payload[c] for c in cols]
    with connection.cursor() as cur:
        try:
            cur.execute(
                f'INSERT INTO {table} ({col_list}) VALUES ({placeholders}) '
                f'ON CONFLICT ("{pk}") DO UPDATE SET {updates}',
                values,
            )
        except Exception as e:
            logger.error("_upsert_dynamic %s id=%s: %s", table, payload.get(pk), e)


def _sync_level(payload):
    _upsert_dynamic('classes_level', payload)
    logger.info("Synced level %s", payload.get('id'))


def _sync_grade(payload):
    _upsert_dynamic('classes_grade', payload)
    logger.info("Synced grade %s", payload.get('id'))


def _sync_classroom(payload):
    # Ensure parent grade exists locally (FK) — create minimal placeholder if missing
    from django.db import connection
    grade_id = payload.get('grade_id')
    if grade_id:
        with connection.cursor() as cur:
            cur.execute("SELECT 1 FROM classes_grade WHERE id=%s", [grade_id])
            if not cur.fetchone():
                _upsert_dynamic('classes_grade', {
                    'id': grade_id,
                    'name': payload.get('grade_name', f'Grade-{grade_id}'),
                    'code': payload.get('grade_code'),
                    'shift': payload.get('shift', 'morning'),
                    'level_id': payload.get('level_id'),
                    'campus_id': payload.get('campus_id'),
                    'organization_id': payload.get('organization_id'),
                })
    # classes_classroom has no grade_name/grade_code/level_id columns — _upsert_dynamic
    # filters to real columns automatically.
    _upsert_dynamic('classes_classroom', payload)
    logger.info("Synced classroom %s", payload.get('id'))


def _upsert_student(payload):
    # Delegate to _upsert_dynamic which fills created_at/updated_at (the student
    # payload omits them; raw-SQL insert would otherwise hit NOT NULL).
    _upsert_dynamic('students_student', payload)


def _delete_student(payload):
    from django.db import connection
    student_id = payload.get('id')
    if not student_id:
        return
    with connection.cursor() as cur:
        cur.execute('UPDATE students_student SET is_deleted=TRUE WHERE id=%s', [student_id])


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
    'student.upserted': _upsert_student,
    'student.deleted': _delete_student,
}


def handle_event(routing_key, payload):
    handler = HANDLERS.get(routing_key)
    if handler:
        handler(payload)
    else:
        logger.warning("No handler for routing_key: %s", routing_key)


class Command(BaseCommand):
    help = "Consume RabbitMQ events and sync org/campus data locally"

    def handle(self, *args, **options):
        self.stdout.write("Starting attendance-service event consumer...")
        start_consumer(ROUTING_KEYS, handle_event, QUEUE_NAME)
