import logging
from django.core.management.base import BaseCommand
from ams_shared.events.consumer import start_consumer

logger = logging.getLogger(__name__)

QUEUE_NAME = "timetable-service.events"
ROUTING_KEYS = [
    "org.created", "org.updated",
    "campus.created", "campus.updated",
    "classes.level.created", "classes.level.updated",
    "classes.grade.created", "classes.grade.updated",
    "classes.classroom.created", "classes.classroom.updated",
]


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


def _sync_org(payload):
    _upsert_dynamic('users_organization', payload)
    logger.info("Synced org %s", payload.get('id'))


def _sync_campus(payload):
    _upsert_dynamic('campus_campus', payload)
    logger.info("Synced campus %s", payload.get('id'))


def _sync_level(payload):
    _upsert_dynamic('classes_level', payload)
    logger.info("Synced level %s", payload.get('id'))


def _sync_grade(payload):
    _upsert_dynamic('classes_grade', payload)
    logger.info("Synced grade %s", payload.get('id'))


def _sync_classroom(payload):
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
    _upsert_dynamic('classes_classroom', payload)
    logger.info("Synced classroom %s", payload.get('id'))


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


def handle_event(routing_key, payload):
    handler = HANDLERS.get(routing_key)
    if handler:
        handler(payload)
    else:
        logger.warning("No handler for routing_key: %s", routing_key)


class Command(BaseCommand):
    help = "Consume RabbitMQ events and sync org/campus/classes data locally"

    def handle(self, *args, **options):
        self.stdout.write("Starting timetable-service event consumer...")
        start_consumer(ROUTING_KEYS, handle_event, QUEUE_NAME)
