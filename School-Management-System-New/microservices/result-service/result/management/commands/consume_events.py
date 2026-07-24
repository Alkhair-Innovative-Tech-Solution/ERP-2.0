import logging
from django.core.management.base import BaseCommand
from ams_shared.events.consumer import start_consumer

logger = logging.getLogger(__name__)

QUEUE_NAME = "result-service.events"
ROUTING_KEYS = [
    "org.created", "org.updated",
    "campus.created", "campus.updated",
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


HANDLERS = {
    'org.created': _sync_org,
    'org.updated': _sync_org,
    'campus.created': _sync_campus,
    'campus.updated': _sync_campus,
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
        self.stdout.write("Starting result-service event consumer...")
        start_consumer(ROUTING_KEYS, handle_event, QUEUE_NAME)
