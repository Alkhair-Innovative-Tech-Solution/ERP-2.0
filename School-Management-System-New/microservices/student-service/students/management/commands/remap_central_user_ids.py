"""
Phase C8: offline, one-time (re-runnable) backfill that links each local
Student to its central-auth NonStaffIdentity, via Student.central_user_id.

WHY THIS IS A SEPARATE OFFLINE COMMAND, NOT A LIVE REQUEST-TIME LOOKUP:
a central-auth student token's own `user_id` claim already IS the
NonStaffIdentity's UUID primary key — so at request time nothing needs to
be "looked up" at all, central_user_id just needs to already be populated
so `Student.all_objects.filter(central_user_id=token_user_id)` can find the
right row. This command is what populates it, exactly once per student
(re-running is a safe no-op for already-linked rows — see --dry-run/idempotency
notes below).

THE MATCH IS EXACT, NEVER FUZZY (A3's rule, restated in this phase's own
prompt): `auth_non_staff_identity.legacy_user_id` (Phase B2's import key) is
set to the ORIGINAL local `users.User.id` for a student imported from SMS —
the very same integer `Student.user_id` already points at locally. So the
match is a plain `NonStaffIdentity.legacy_user_id == Student.user_id`
integer equality — no name/email/username guessing anywhere in this file.
A Student whose `user_id` has no matching `legacy_user_id` on the other
side is left with `central_user_id = NULL` and reported as unmatched, never
guessed at.

WHY A DIRECT CROSS-DATABASE QUERY (not an HTTP call): auth-service exposes
no endpoint for this lookup today (checked — only an internal Django ORM
filter inside its own SMS-import script, employees/sms_import.py:292, never
routed). The auth-service Postgres is already reachable from every
container on this host via `host.docker.internal:<published-port>` — the
exact same path every SMS service already uses for AUTH_SERVICE_URL/JWKS
(see student_service/settings.py's CENTRAL_AUTH_DB_* comment) — so this
reuses existing connectivity rather than standing up anything new. This
command is the ONLY place in student-service that ever opens that
connection; it is never touched at request time (no live cross-service call
sits in the request path for anything else in this phase).
"""
from django.core.management.base import BaseCommand
from django.conf import settings


class Command(BaseCommand):
    help = (
        "Backfill Student.central_user_id from auth-service's "
        "auth_non_staff_identity.legacy_user_id (exact match only)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help="Report what would change without writing anything.",
        )

    def handle(self, *args, **options):
        import psycopg2
        from students.models import Student

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
                    "SELECT legacy_user_id, id FROM auth_non_staff_identity "
                    "WHERE legacy_user_id IS NOT NULL AND person_type = 'student'"
                )
                central_by_legacy_id = {row[0]: row[1] for row in cur.fetchall()}
        finally:
            conn.close()

        self.stdout.write(f"Fetched {len(central_by_legacy_id)} student NonStaffIdentity rows from auth-service.")

        # ── 2. Exact-match against local Student.user_id, report + stamp ──
        matched, unmatched, already_linked = 0, [], 0
        candidates = Student.all_objects.filter(
            user_id__isnull=False, central_user_id__isnull=True
        ).only('id', 'student_id', 'user_id')

        for student in candidates:
            central_id = central_by_legacy_id.get(student.user_id)
            if central_id is None:
                unmatched.append(student.student_id or student.id)
                continue
            matched += 1
            if not dry_run:
                student.central_user_id = central_id
                student.save(update_fields=['central_user_id'])

        total_linked = Student.all_objects.filter(central_user_id__isnull=False).count()

        self.stdout.write(self.style.SUCCESS(
            f"{'[DRY RUN] Would match' if dry_run else 'Matched'}: {matched}. "
            f"Unmatched (no central identity for this user_id — left NULL, "
            f"not guessed at): {len(unmatched)}. "
            f"Total Student rows with central_user_id set now: {total_linked}."
        ))
        if unmatched:
            self.stdout.write("Unmatched student_ids: " + ", ".join(str(s) for s in unmatched[:50]))
