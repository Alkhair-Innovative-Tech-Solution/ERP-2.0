"""
Startup sync: pulls orgs + campuses from source DBs into this service's DB.
Fetches ALL columns dynamically so schema mismatches don't cause failures.
Uses raw SQL UPSERT to bypass OrganizationManager filtering.
"""
import os
import json
import logging
import psycopg2
import psycopg2.extras
from django.core.management.base import BaseCommand
from django.db import connection

logger = logging.getLogger(__name__)


def _src_conn(host, dbname, user, password, port=5432):
    return psycopg2.connect(
        host=host, dbname=dbname, user=user, password=password,
        port=port, connect_timeout=5
    )


def _upsert_table(src_rows, col_names, table, pk='id'):
    """
    Upsert rows into local table.
    Only uses columns that exist in BOTH source and local table.
    """
    if not src_rows:
        return 0

    # Find columns that exist locally
    with connection.cursor() as cur:
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = %s AND table_schema = 'public'
        """, [table])
        local_cols = {r[0] for r in cur.fetchall()}

    # Intersect — only sync columns present in both
    common = [c for c in col_names if c in local_cols]
    if pk not in common:
        logger.error("_upsert_table: pk '%s' not in common columns for %s", pk, table)
        return 0

    non_pk = [c for c in common if c != pk]
    if not non_pk:
        return 0

    col_list = ', '.join(f'"{c}"' for c in common)
    placeholders = ', '.join(['%s'] * len(common))
    updates = ', '.join(f'"{c}" = EXCLUDED."{c}"' for c in non_pk)
    sql = f"""
        INSERT INTO {table} ({col_list})
        VALUES ({placeholders})
        ON CONFLICT ("{pk}") DO UPDATE SET {updates}
    """

    synced = 0
    with connection.cursor() as cur:
        for row in src_rows:
            # Serialize dicts/lists (JSONB columns) to JSON strings
            values = [
                json.dumps(row[c]) if isinstance(row[c], (dict, list)) else row[c]
                for c in common
            ]
            try:
                cur.execute(sql, values)
                synced += 1
            except Exception as e:
                logger.error("_upsert_table %s id=%s: %s", table, row.get(pk), e)
    return synced


def sync_orgs():
    try:
        conn = _src_conn(
            host=os.getenv('ORG_DB_HOST', 'postgres-org'),
            dbname=os.getenv('ORG_DB_NAME', 'org_db'),
            user=os.getenv('ORG_DB_USER', 'org_user'),
            password=os.getenv('ORG_DB_PASSWORD', 'org_pass'),
        )
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM users_organization")
            rows = cur.fetchall()
            col_names = [d.name for d in cur.description]
        conn.close()
    except Exception as e:
        logger.warning("sync_orgs: cannot reach org DB: %s", e)
        return 0

    # Skip FK columns that may not exist in this service's local DB
    skip_cols = {'plan_id', 'created_by_id'}
    col_names = [c for c in col_names if c not in skip_cols]

    # Clear any conflicting code_prefix from stale local records before upsert
    incoming_prefixes = [r['code_prefix'] for r in rows if r.get('code_prefix')]
    incoming_ids = [r['id'] for r in rows]
    if incoming_prefixes:
        with connection.cursor() as cur:
            cur.execute(
                "UPDATE users_organization SET code_prefix = NULL "
                "WHERE code_prefix = ANY(%s) AND id != ALL(%s)",
                [incoming_prefixes, incoming_ids]
            )

    return _upsert_table(rows, col_names, 'users_organization')


def _campus_conn():
    return _src_conn(
        host=os.getenv('CAMPUS_DB_HOST', 'postgres-campus'),
        dbname=os.getenv('CAMPUS_DB_NAME', 'campus_db'),
        user=os.getenv('CAMPUS_DB_USER', 'campus_user'),
        password=os.getenv('CAMPUS_DB_PASSWORD', 'campus_pass'),
    )


def sync_campuses():
    try:
        conn = _campus_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM campus_campus")
            rows = cur.fetchall()
            col_names = [d.name for d in cur.description]
        conn.close()
    except Exception as e:
        logger.warning("sync_campuses: cannot reach campus DB: %s", e)
        return 0

    return _upsert_table(rows, col_names, 'campus_campus')


def sync_levels():
    try:
        conn = _campus_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM classes_level")
            rows = cur.fetchall()
            col_names = [d.name for d in cur.description]
        conn.close()
    except Exception as e:
        logger.warning("sync_levels: cannot reach campus DB: %s", e)
        return 0
    return _upsert_table(rows, col_names, 'classes_level')


def sync_grades():
    try:
        conn = _campus_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM classes_grade")
            rows = cur.fetchall()
            col_names = [d.name for d in cur.description]
        conn.close()
    except Exception as e:
        logger.warning("sync_grades: cannot reach campus DB: %s", e)
        return 0
    return _upsert_table(rows, col_names, 'classes_grade')


def sync_classrooms():
    try:
        conn = _campus_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM classes_classroom")
            rows = cur.fetchall()
            col_names = [d.name for d in cur.description]
        conn.close()
    except Exception as e:
        logger.warning("sync_classrooms: cannot reach campus DB: %s", e)
        return 0
    # Null out class_teacher_id to avoid FK issues (teacher not synced here)
    for row in rows:
        row['class_teacher_id'] = None
    return _upsert_table(rows, col_names, 'classes_classroom')


def _staff_conn():
    return _src_conn(
        host=os.getenv('STAFF_DB_HOST', 'postgres-staff'),
        dbname=os.getenv('STAFF_DB_NAME', 'staff_db'),
        user=os.getenv('STAFF_DB_USER', 'staff_user'),
        password=os.getenv('STAFF_DB_PASSWORD', 'staff_pass'),
    )


def sync_staff_users():
    """Sync teacher/coordinator/principal user accounts so teacher FK resolves."""
    try:
        conn = _staff_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM users_user")
            rows = cur.fetchall()
            col_names = [d.name for d in cur.description]
        conn.close()
    except Exception as e:
        logger.warning("sync_staff_users: cannot reach staff DB: %s", e)
        return 0
    return _upsert_table(rows, col_names, 'users_user')


def sync_teachers():
    """Sync teachers from staff-service so result.teacher FK resolves."""
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
    return _upsert_table(rows, col_names, 'teachers_teacher')


def sync_coordinators():
    """Sync coordinators from staff-service so result.coordinator FK resolves."""
    try:
        conn = _staff_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM coordinator_coordinator")
            rows = cur.fetchall()
            col_names = [d.name for d in cur.description]
        conn.close()
    except Exception as e:
        logger.warning("sync_coordinators: cannot reach staff DB: %s", e)
        return 0
    return _upsert_table(rows, col_names, 'coordinator_coordinator')


def sync_teacher_coordinator_assignments():
    """Sync teacher↔coordinator M2M so assigned_coordinators.exists() works."""
    try:
        conn = _staff_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM teachers_teacher_assigned_coordinators")
            rows = cur.fetchall()
            col_names = [d.name for d in cur.description]
        conn.close()
    except Exception as e:
        logger.warning("sync_teacher_coordinator_assignments: cannot reach staff DB: %s", e)
        return 0
    if not rows:
        return 0
    local_cols_set = set()
    with connection.cursor() as cur:
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'teachers_teacher_assigned_coordinators' AND table_schema = 'public'
        """)
        local_cols_set = {r[0] for r in cur.fetchall()}
    common = [c for c in col_names if c in local_cols_set]
    if not common:
        return 0
    col_list = ', '.join(f'"{c}"' for c in common)
    placeholders = ', '.join(['%s'] * len(common))
    sql = f"""
        INSERT INTO teachers_teacher_assigned_coordinators ({col_list})
        VALUES ({placeholders})
        ON CONFLICT DO NOTHING
    """
    synced = 0
    with connection.cursor() as cur:
        for row in rows:
            try:
                cur.execute(sql, [row[c] for c in common])
                synced += 1
            except Exception as e:
                logger.error("sync_teacher_coordinator_assignments row=%s: %s", row, e)
    return synced


def _student_conn():
    return _src_conn(
        host=os.getenv('STUDENT_DB_HOST', 'postgres-student'),
        dbname=os.getenv('STUDENT_DB_NAME', 'student_db'),
        user=os.getenv('STUDENT_DB_USER', 'student_user'),
        password=os.getenv('STUDENT_DB_PASSWORD', 'student_pass'),
    )


def sync_student_users():
    """Sync user accounts from student-service so students_student user_id FK resolves."""
    try:
        conn = _student_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM users_user")
            rows = cur.fetchall()
            col_names = [d.name for d in cur.description]
        conn.close()
    except Exception as e:
        logger.warning("sync_student_users: cannot reach student DB: %s", e)
        return 0
    return _upsert_table(rows, col_names, 'users_user')


def sync_students():
    """Sync students from student-service so result-service student FK resolves."""
    try:
        conn = _student_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM students_student")
            rows = cur.fetchall()
            col_names = [d.name for d in cur.description]
        conn.close()
    except Exception as e:
        logger.warning("sync_students: cannot reach student DB: %s", e)
        return 0
    return _upsert_table(rows, col_names, 'students_student')


class Command(BaseCommand):
    help = "Sync orgs, campuses, and students from source DBs on startup"

    def handle(self, *args, **options):
        self.stdout.write("Syncing orgs...")
        n = sync_orgs()
        self.stdout.write(f"  {n} orgs synced.")

        self.stdout.write("Syncing campuses...")
        n = sync_campuses()
        self.stdout.write(f"  {n} campuses synced.")

        self.stdout.write("Syncing levels...")
        n = sync_levels()
        self.stdout.write(f"  {n} levels synced.")

        self.stdout.write("Syncing grades...")
        n = sync_grades()
        self.stdout.write(f"  {n} grades synced.")

        self.stdout.write("Syncing classrooms...")
        n = sync_classrooms()
        self.stdout.write(f"  {n} classrooms synced.")

        self.stdout.write("Syncing staff users...")
        n = sync_staff_users()
        self.stdout.write(f"  {n} staff users synced.")

        self.stdout.write("Syncing teachers...")
        n = sync_teachers()
        self.stdout.write(f"  {n} teachers synced.")

        self.stdout.write("Syncing coordinators...")
        n = sync_coordinators()
        self.stdout.write(f"  {n} coordinators synced.")

        self.stdout.write("Syncing teacher-coordinator assignments...")
        n = sync_teacher_coordinator_assignments()
        self.stdout.write(f"  {n} assignments synced.")

        self.stdout.write("Syncing student users...")
        n = sync_student_users()
        self.stdout.write(f"  {n} student users synced.")

        self.stdout.write("Syncing students...")
        n = sync_students()
        self.stdout.write(f"  {n} students synced.")
