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
    skip_cols = {'plan_id', 'created_by_id', 'student_id_pattern', 'employee_id_pattern'}
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
    n = _upsert_table(rows, col_names, 'classes_classroom')

    # Backfill class_teacher_id from staff DB (campus DB may have NULL teacher data)
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
                        logger.error("sync_classrooms class_teacher id=%s: %s", row['id'], e)
    except Exception as e:
        logger.warning("sync_classrooms class_teacher backfill: %s", e)

    return n


def _student_conn():
    return _src_conn(
        host=os.getenv('STUDENT_DB_HOST', 'postgres-student'),
        dbname=os.getenv('STUDENT_DB_NAME', 'student_db'),
        user=os.getenv('STUDENT_DB_USER', 'student_user'),
        password=os.getenv('STUDENT_DB_PASSWORD', 'student_pass'),
    )


def sync_student_users():
    """Sync student user records from student-service so students_student FK doesn't fail."""
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


def _staff_conn():
    return _src_conn(
        host=os.getenv('STAFF_DB_HOST', 'postgres-staff'),
        dbname=os.getenv('STAFF_DB_NAME', 'staff_db'),
        user=os.getenv('STAFF_DB_USER', 'staff_user'),
        password=os.getenv('STAFF_DB_PASSWORD', 'staff_pass'),
    )


def sync_teachers():
    """Sync teacher records from staff-service so attendance-service can check classroom access."""
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
    skip_cols = {'user_id'}
    col_names = [c for c in col_names if c not in skip_cols]
    synced = _upsert_table(rows, col_names, 'teachers_teacher')

    # Sync M2M: teacher → assigned classrooms
    try:
        conn = _staff_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM teachers_teacher_assigned_classrooms")
            m2m_rows = cur.fetchall()
        conn.close()
        if m2m_rows:
            with connection.cursor() as cur:
                for row in m2m_rows:
                    try:
                        cur.execute(
                            "INSERT INTO teachers_teacher_assigned_classrooms (id, teacher_id, classroom_id) "
                            "VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                            [row['id'], row['teacher_id'], row['classroom_id']]
                        )
                    except Exception as e:
                        logger.error("sync_teachers m2m row %s: %s", row, e)
    except Exception as e:
        logger.warning("sync_teachers m2m: %s", e)

    # Sync M2M: teacher → assigned coordinators
    try:
        conn = _staff_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM teachers_teacher_assigned_coordinators")
            coord_rows = cur.fetchall()
        conn.close()
        if coord_rows:
            with connection.cursor() as cur:
                for row in coord_rows:
                    try:
                        cur.execute(
                            "INSERT INTO teachers_teacher_assigned_coordinators (id, teacher_id, coordinator_id) "
                            "VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                            [row['id'], row['teacher_id'], row['coordinator_id']]
                        )
                    except Exception as e:
                        logger.error("sync_teachers coord m2m row %s: %s", row, e)
    except Exception as e:
        logger.warning("sync_teachers coord m2m: %s", e)

    return synced


def _auth_conn():
    return _src_conn(
        host=os.getenv('AUTH_DB_HOST', 'postgres-auth'),
        dbname=os.getenv('AUTH_DB_NAME', 'auth_db'),
        user=os.getenv('AUTH_DB_USER', 'auth_user'),
        password=os.getenv('AUTH_DB_PASSWORD', 'auth_pass'),
    )


def sync_staff_users():
    """
    Sync principal, coordinator, teacher, and admin user records from auth_db into
    the local users_user table so staff attendance views can query them.
    Enriches campus_id from principals_principal / coordinator_coordinator in staff_db
    since the auth_db stores campus_id as NULL for most staff roles.
    """
    STAFF_ROLES = ('principal', 'coordinator', 'teacher', 'org_admin',
                   'accounts_officer', 'admissions_counselor', 'compliance_officer')

    # --- 1. Pull staff users from auth_db ---
    try:
        conn = _auth_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            placeholders = ', '.join(['%s'] * len(STAFF_ROLES))
            cur.execute(
                f"SELECT * FROM users_user WHERE role IN ({placeholders}) AND is_deleted = false",
                list(STAFF_ROLES)
            )
            rows = cur.fetchall()
            col_names = [d.name for d in cur.description]
        conn.close()
    except Exception as e:
        logger.warning("sync_staff_users: cannot reach auth DB: %s", e)
        return 0

    if not rows:
        return 0

    # Convert RealDictRow → regular dicts so we can mutate them
    rows = [dict(r) for r in rows]

    # --- 2. Enrich campus_id from staff_db ---
    campus_by_code = {}  # employee_code → campus_id
    campus_by_email = {}  # email → campus_id
    try:
        conn = _staff_conn()
        with conn.cursor() as cur:
            # Principals
            cur.execute("SELECT employee_code, email, campus_id FROM principals_principal WHERE is_deleted = false")
            for code, email, cid in cur.fetchall():
                if cid:
                    if code:
                        campus_by_code[code] = cid
                    if email:
                        campus_by_email[email] = cid
            # Coordinators
            cur.execute("SELECT employee_code, email, campus_id FROM coordinator_coordinator WHERE is_deleted = false")
            for code, email, cid in cur.fetchall():
                if cid:
                    if code:
                        campus_by_code[code] = cid
                    if email:
                        campus_by_email[email] = cid
            # Teachers (current_campus_id)
            cur.execute("SELECT employee_code, email, current_campus_id FROM teachers_teacher")
            for code, email, cid in cur.fetchall():
                if cid:
                    if code:
                        campus_by_code[code] = cid
                    if email:
                        campus_by_email[email] = cid
        conn.close()
    except Exception as e:
        logger.warning("sync_staff_users: cannot reach staff DB for campus enrichment: %s", e)

    for row in rows:
        if not row.get('campus_id'):
            code = row.get('username') or row.get('employee_code') or ''
            email = row.get('email') or ''
            row['campus_id'] = campus_by_code.get(code) or campus_by_email.get(email)

    return _upsert_table(rows, col_names, 'users_user')


class Command(BaseCommand):
    help = "Sync orgs, campuses, levels, grades, classrooms, students, and teachers from source DBs on startup"

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

        self.stdout.write("Syncing teachers...")
        n = sync_teachers()
        self.stdout.write(f"  {n} teachers synced.")

        self.stdout.write("Syncing classrooms...")
        n = sync_classrooms()
        self.stdout.write(f"  {n} classrooms synced.")

        self.stdout.write("Syncing student users...")
        n = sync_student_users()
        self.stdout.write(f"  {n} student users synced.")

        self.stdout.write("Syncing students...")
        n = sync_students()
        self.stdout.write(f"  {n} students synced.")

        self.stdout.write("Syncing staff users (principal/coordinator/teacher)...")
        n = sync_staff_users()
        self.stdout.write(f"  {n} staff users synced.")
