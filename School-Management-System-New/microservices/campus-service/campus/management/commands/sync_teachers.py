"""
Sync teacher records from staff-service into campus-service DB.
Required so campus-service can store class_teacher_id on classrooms (FK).
"""
import os
import json
import logging
import psycopg2
import psycopg2.extras
from django.core.management.base import BaseCommand
from django.db import connection

logger = logging.getLogger(__name__)


def _staff_conn():
    return psycopg2.connect(
        host=os.getenv('STAFF_DB_HOST', 'postgres-staff'),
        dbname=os.getenv('STAFF_DB_NAME', 'staff_db'),
        user=os.getenv('STAFF_DB_USER', 'staff_user'),
        password=os.getenv('STAFF_DB_PASSWORD', 'staff_pass'),
        port=5432, connect_timeout=5,
    )


def sync_teachers():
    try:
        conn = _staff_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM teachers_teacher")
            rows = cur.fetchall()
            col_names = [d.name for d in cur.description]
        conn.close()
    except Exception as e:
        logger.warning("sync_teachers: cannot reach staff DB: %s", e)
        return 0

    if not rows:
        return 0

    skip_cols = {'user_id'}
    col_names = [c for c in col_names if c not in skip_cols]

    with connection.cursor() as cur:
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'teachers_teacher' AND table_schema = 'public'
        """)
        local_cols = {r[0] for r in cur.fetchall()}

    common = [c for c in col_names if c in local_cols]
    if 'id' not in common:
        return 0
    non_pk = [c for c in common if c != 'id']
    if not non_pk:
        return 0

    col_list = ', '.join('"' + c + '"' for c in common)
    phs = ', '.join(['%s'] * len(common))
    updates = ', '.join('"' + c + '" = EXCLUDED."' + c + '"' for c in non_pk)
    sql = (
        'INSERT INTO teachers_teacher (' + col_list + ') '
        'VALUES (' + phs + ') '
        'ON CONFLICT ("id") DO UPDATE SET ' + updates
    )

    synced = 0
    with connection.cursor() as cur:
        for row in rows:
            vals = [
                json.dumps(row[c]) if isinstance(row[c], (dict, list)) else row[c]
                for c in common
            ]
            try:
                cur.execute(sql, vals)
                synced += 1
            except Exception as e:
                logger.error("sync_teachers teacher id=%s: %s", row.get('id'), e)

    # Backfill class_teacher_id on classrooms from staff DB
    try:
        conn = _staff_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id, class_teacher_id FROM classes_classroom WHERE class_teacher_id IS NOT NULL")
            ct_rows = cur.fetchall()
        conn.close()
        if ct_rows:
            with connection.cursor() as cur:
                for row in ct_rows:
                    try:
                        cur.execute(
                            "UPDATE classes_classroom SET class_teacher_id = %s WHERE id = %s",
                            [row['class_teacher_id'], row['id']]
                        )
                    except Exception as e:
                        logger.error("sync_teachers class_teacher id=%s: %s", row['id'], e)
    except Exception as e:
        logger.warning("sync_teachers class_teacher backfill: %s", e)

    return synced


class Command(BaseCommand):
    help = "Sync teacher records from staff-service into campus-service DB"

    def handle(self, *args, **options):
        self.stdout.write("Syncing teachers...")
        n = sync_teachers()
        self.stdout.write(f"  {n} teachers synced.")
