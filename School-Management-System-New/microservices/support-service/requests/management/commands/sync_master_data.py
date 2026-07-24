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


def sync_campuses():
    try:
        conn = _src_conn(
            host=os.getenv('CAMPUS_DB_HOST', 'postgres-campus'),
            dbname=os.getenv('CAMPUS_DB_NAME', 'campus_db'),
            user=os.getenv('CAMPUS_DB_USER', 'campus_user'),
            password=os.getenv('CAMPUS_DB_PASSWORD', 'campus_pass'),
        )
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM campus_campus")
            rows = cur.fetchall()
            col_names = [d.name for d in cur.description]
        conn.close()
    except Exception as e:
        logger.warning("sync_campuses: cannot reach campus DB: %s", e)
        return 0

    return _upsert_table(rows, col_names, 'campus_campus')


class Command(BaseCommand):
    help = "Sync orgs and campuses from source DBs on startup"

    def handle(self, *args, **options):
        self.stdout.write("Syncing orgs...")
        n = sync_orgs()
        self.stdout.write(f"  {n} orgs synced.")

        self.stdout.write("Syncing campuses...")
        n = sync_campuses()
        self.stdout.write(f"  {n} campuses synced.")
