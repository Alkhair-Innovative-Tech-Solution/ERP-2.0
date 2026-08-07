"""
Phase C12: offline, one-time (re-runnable) backfill that links each local
Teacher/Principal/Coordinator to its central-auth Employee, via each
model's own central_user_id — exact same shape and rationale as Phase
C8's student-service command (students/management/commands/
remap_central_user_ids.py). Read that file's docstring for the full
argument on why this is a direct cross-database read (not an HTTP call,
not a live per-request lookup): the same reasoning applies verbatim here,
just against `employees_employee` instead of `auth_non_staff_identity`.

THE MATCH IS EXACT, NEVER FUZZY: `employees_employee.legacy_user_id`
(Phase B1's import key) is set to the ORIGINAL local `users.User.id` for
a staff member imported from SMS — the very same integer
Teacher/Principal/Coordinator.user_id already points at locally. The
match is a plain `Employee.legacy_user_id == <profile>.user_id` integer
equality — no name/email/username guessing anywhere in this file. A
profile whose `user_id` has no matching `legacy_user_id` on the other
side is left with `central_user_id = NULL` and reported as unmatched,
never guessed at.

One DB connection, one fetch of the whole legacy_user_id -> central UUID
map, applied to all three local models in a single pass (cheaper than
three separate connections, and keeps the "exact remap" logic in one
place — mirrors this phase's own audit table grouping all three `.user`
OneToOnes together).
"""
from django.core.management.base import BaseCommand
from django.conf import settings


class Command(BaseCommand):
    help = (
        "Backfill Teacher/Principal/Coordinator.central_user_id from "
        "auth-service's employees_employee.legacy_user_id (exact match only)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help="Report what would change without writing anything.",
        )

    def handle(self, *args, **options):
        import psycopg2
        from teachers.models import Teacher
        from principals.models import Principal
        from coordinator.models import Coordinator

        dry_run = options['dry_run']

        # ── 1. Fetch the legacy_user_id -> central UUID map from auth-service ──
        conn = psycopg2.connect(
            host=settings.CENTRAL_AUTH_DB_HOST,
            port=settings.CENTRAL_AUTH_DB_PORT,
            dbname=settings.CENTRAL_AUTH_DB_NAME,
            user=settings.CENTRAL_AUTH_DB_USER,
            password=settings.CENTRAL_AUTH_DB_PASSWORD,
            connect_timeout=5,
        )
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT legacy_user_id, id FROM employees_employee "
                    "WHERE legacy_user_id IS NOT NULL"
                )
                central_by_legacy_id = {row[0]: row[1] for row in cur.fetchall()}
        finally:
            conn.close()

        self.stdout.write(f"Fetched {len(central_by_legacy_id)} Employee rows from auth-service.")

        # ── 2. Exact-match against each local model's user_id, report + stamp ──
        total_matched = 0
        for model, label, code_field in (
            (Teacher, 'Teacher', 'employee_code'),
            (Principal, 'Principal', 'employee_code'),
            (Coordinator, 'Coordinator', 'employee_code'),
        ):
            matched, unmatched = 0, []
            candidates = model.all_objects.filter(
                user_id__isnull=False, central_user_id__isnull=True
            ).only('id', 'user_id', code_field)

            for profile in candidates:
                central_id = central_by_legacy_id.get(profile.user_id)
                if central_id is None:
                    unmatched.append(getattr(profile, code_field, None) or profile.id)
                    continue
                matched += 1
                if not dry_run:
                    profile.central_user_id = central_id
                    profile.save(update_fields=['central_user_id'])

            total_linked = model.all_objects.filter(central_user_id__isnull=False).count()
            total_matched += matched

            self.stdout.write(self.style.SUCCESS(
                f"{label}: {'[DRY RUN] Would match' if dry_run else 'Matched'}: {matched}. "
                f"Unmatched (no central identity for this user_id — left NULL, "
                f"not guessed at): {len(unmatched)}. "
                f"Total {label} rows with central_user_id set now: {total_linked}."
            ))
            if unmatched:
                self.stdout.write(f"Unmatched {label} identifiers: " + ", ".join(str(u) for u in unmatched[:50]))

        self.stdout.write(self.style.SUCCESS(f"Total matched across all three models: {total_matched}."))
