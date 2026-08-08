import os
from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from django.db import connection

from services.central_auth_sync_service import sync_staff_to_central_auth


DEFAULT_PASSWORD = "12345"

# Phase D-R6: _sync_to_auth() (the auth-8001 write, flag-gated by
# WRITE_TO_AUTH_8001) is removed — auth-8001 no longer exists (D-R5). This
# command now only does local-user creation + the central-auth dual-write
# below. See docs/PHASE_D_R4R6_REMOVAL_RESULT.md.


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

            # Fetch profile fields (campus/phone always; cnic/dob/gender/
            # joining_date needed too, for the Phase B4 central-auth
            # dual-write — central auth's Employee contract requires them,
            # SMS's own auth-8001 sync doesn't).
            table = {"principal": "principals_principal", "teacher": "teachers_teacher", "coordinator": "coordinator_coordinator"}[role]
            campus_col = "current_campus_id" if role == "teacher" else "campus_id"
            with connection.cursor() as c:
                c.execute(
                    f"SELECT {campus_col}, contact_number, cnic, dob, gender, joining_date FROM {table} WHERE id = %s",
                    [sid],
                )
                profile_row = c.fetchone()
            campus_id, phone, cnic, dob, gender, joining_date = profile_row if profile_row else (None, "", None, None, None, None)

            # Ensure local user exists
            if not _local_user_exists(email, employee_code):
                self.stdout.write(f"[LOCAL] Creating local user for {label}")
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

            # Phase B4 dual-write: also land this identity in central
            # auth's SMS01 tenant — no-ops unless SYNC_TO_CENTRAL_AUTH=true.
            # Carry the REAL local password hash (not DEFAULT_PASSWORD
            # blindly) — the local user may already have a changed password
            # from a prior sync/login.
            with connection.cursor() as c:
                c.execute("SELECT id, password FROM users_user WHERE email = %s OR username = %s LIMIT 1", [email, employee_code])
                local_user_row = c.fetchone()
            local_user_id, password_hash = local_user_row if local_user_row else (None, make_password(DEFAULT_PASSWORD))

            ca_ok, ca_msg = sync_staff_to_central_auth(
                legacy_user_id=local_user_id or sid,
                email=email,
                username=employee_code,
                role=role,
                password_hash=password_hash,
                full_name=full_name,
                cnic=cnic,
                dob=dob,
                gender=gender,
                phone=phone,
                joining_date=joining_date,
            )
            if ca_ok:
                self.stdout.write(self.style.SUCCESS(f"[CENTRAL-AUTH] {label} → {ca_msg}"))
            elif "disabled" not in ca_msg:
                self.stdout.write(self.style.WARNING(f"[CENTRAL-AUTH] {label} → {ca_msg}"))

        self.stdout.write(f"\nDone: {ok} synced, {skipped} skipped, {failed} failed.")
