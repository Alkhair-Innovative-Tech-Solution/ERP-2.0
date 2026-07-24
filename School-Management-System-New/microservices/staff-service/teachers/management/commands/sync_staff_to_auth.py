import os
import json
import urllib.request
import urllib.error
from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from django.db import connection


AUTH_URL = os.getenv("AUTH_SERVICE_URL", "http://auth-service:8001")
SECRET = os.getenv("INTERNAL_SERVICE_SECRET", "")
DEFAULT_PASSWORD = "12345"


def _sync_to_auth(email, username, first_name, last_name, role, org_data):
    payload = json.dumps({
        "email": email,
        "password": DEFAULT_PASSWORD,
        "username": username,
        "first_name": first_name,
        "last_name": last_name,
        "role": role,
        "organization": org_data,
        "has_changed_default_password": False,
    }).encode()
    req = urllib.request.Request(
        f"{AUTH_URL}/api/internal/create-user/",
        data=payload,
        headers={"Content-Type": "application/json", "X-Internal-Secret": SECRET},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return True, f"created (HTTP {resp.status})"
    except urllib.error.HTTPError as e:
        if e.code == 409:
            return True, "already exists in auth"
        return False, f"HTTP {e.code}: {e.read().decode()[:200]}"
    except Exception as e:
        return False, str(e)


def _fetch_all_staff(staff_type):
    """Use raw SQL to bypass OrganizationManager (no thread-local user in management cmds)."""
    rows = []

    if staff_type in ("all", "principal"):
        with connection.cursor() as c:
            c.execute("""
                SELECT p.id, p.full_name, p.email, p.employee_code,
                       o.id, o.name, o.code_prefix, o.code_pattern
                FROM principals_principal p
                LEFT JOIN users_organization o ON o.id = p.organization_id
                WHERE p.is_deleted = FALSE
            """)
            rows += [("principal", r) for r in c.fetchall()]

    if staff_type in ("all", "teacher"):
        with connection.cursor() as c:
            c.execute("""
                SELECT t.id, t.full_name, t.email, t.employee_code,
                       o.id, o.name, o.code_prefix, o.code_pattern
                FROM teachers_teacher t
                LEFT JOIN users_organization o ON o.id = t.organization_id
                WHERE t.is_deleted = FALSE
            """)
            rows += [("teacher", r) for r in c.fetchall()]

    if staff_type in ("all", "coordinator"):
        with connection.cursor() as c:
            c.execute("""
                SELECT c.id, c.full_name, c.email, c.employee_code,
                       o.id, o.name, o.code_prefix, o.code_pattern
                FROM coordinator_coordinator c
                LEFT JOIN users_organization o ON o.id = c.organization_id
                WHERE c.is_deleted = FALSE
            """)
            rows += [("coordinator", r) for r in c.fetchall()]

    return rows


def _local_user_exists(email, username):
    with connection.cursor() as c:
        c.execute(
            "SELECT id FROM users_user WHERE email = %s OR username = %s LIMIT 1",
            [email, username or ""]
        )
        return c.fetchone() is not None


def _create_local_user(email, username, full_name, role, org_id, campus_id, phone):
    """Insert local User row directly so we bypass manager filtering."""
    from users.models import User
    name_parts = (full_name or "").strip().split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ""
    try:
        user = User(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
            role=role,
            organization_id=org_id,
            campus_id=campus_id,
            phone_number=phone or "",
            is_verified=True,
        )
        user.password = make_password(DEFAULT_PASSWORD)
        user.save_base(raw=True)  # bypasses model signals that re-trigger creation
        return user
    except Exception as e:
        return None


class Command(BaseCommand):
    help = "Sync existing staff (principals, teachers, coordinators) to auth-service"

    def add_arguments(self, parser):
        parser.add_argument(
            "--type",
            choices=["all", "principal", "teacher", "coordinator"],
            default="all",
        )
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        staff_type = options["type"]
        dry_run = options["dry_run"]

        rows = _fetch_all_staff(staff_type)
        self.stdout.write(f"Found {len(rows)} staff records.")

        ok = skipped = failed = 0

        for role, (sid, full_name, email, employee_code, org_id, org_name, code_prefix, code_pattern) in rows:
            label = f"{role} {full_name} ({email})"

            if not employee_code:
                self.stdout.write(self.style.WARNING(f"[SKIP] {label} — no employee_code"))
                skipped += 1
                continue

            if dry_run:
                self.stdout.write(f"[DRY-RUN] Would sync {label} (code={employee_code})")
                continue

            # Ensure local user exists
            if not _local_user_exists(email, employee_code):
                self.stdout.write(f"[LOCAL] Creating local user for {label}")
                # Get campus_id and phone from raw SQL
                table = {"principal": "principals_principal", "teacher": "teachers_teacher", "coordinator": "coordinator_coordinator"}[role]
                campus_col = "current_campus_id" if role == "teacher" else "campus_id"
                with connection.cursor() as c:
                    c.execute(f"SELECT {campus_col}, contact_number FROM {table} WHERE id = %s", [sid])
                    row = c.fetchone()
                campus_id = row[0] if row else None
                phone = row[1] if row else ""
                _create_local_user(email, employee_code, full_name, role, org_id, campus_id, phone)

            # Build org_data for auth-service
            org_data = None
            if org_id:
                org_data = {
                    "id": org_id,
                    "name": org_name or f"Org-{org_id}",
                    "code_prefix": code_prefix,
                    "code_pattern": code_pattern or "PREFIX_SEQ4",
                }

            name_parts = (full_name or "").strip().split(" ", 1)
            success, msg = _sync_to_auth(
                email=email,
                username=employee_code,
                first_name=name_parts[0],
                last_name=name_parts[1] if len(name_parts) > 1 else "",
                role=role,
                org_data=org_data,
            )

            if success:
                self.stdout.write(self.style.SUCCESS(f"[AUTH]  {label} → {msg}"))
                ok += 1
            else:
                self.stdout.write(self.style.ERROR(f"[FAIL]  {label} → {msg}"))
                failed += 1

        self.stdout.write(f"\nDone: {ok} synced, {skipped} skipped, {failed} failed.")
