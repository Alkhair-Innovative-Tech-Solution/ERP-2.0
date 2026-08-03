"""
CLI wrapper around employees.sms_import.import_student_records.

Reads a JSON array of SMS student records (see employees/sms_import.py's
SMS_STUDENT_RECORD_FIELDS docstring for the exact contract) from a file and
imports them as NonStaffIdentity (person_type='student') identities. No
dataset is hardcoded here — same shape as import_sms_staff, students' twin.

Usage:
    python manage.py import_sms_students --json-file /path/to/records.json
"""
import json

from django.core.management.base import BaseCommand, CommandError

from employees.sms_import import import_student_records


class Command(BaseCommand):
    help = "Import SMS student user records (JSON file of SMS_STUDENT_RECORD_FIELDS-shaped dicts) into central auth's SMS01 tenant as NonStaffIdentity. Idempotent."

    def add_arguments(self, parser):
        parser.add_argument("--json-file", required=True, help="Path to a JSON file containing an array of student records")
        parser.add_argument("--tenant-code", default="SMS01", help="Destination tenant code (default: SMS01)")

    def handle(self, *args, **options):
        path = options["json_file"]
        try:
            with open(path) as f:
                records = json.load(f)
        except FileNotFoundError:
            raise CommandError(f"File not found: {path}")
        except json.JSONDecodeError as e:
            raise CommandError(f"Invalid JSON in {path}: {e}")

        if not isinstance(records, list):
            raise CommandError("JSON file must contain a top-level array of record objects")

        summary = import_student_records(records, tenant_code=options["tenant_code"])

        self.stdout.write(self.style.SUCCESS(
            f"Import done: {summary['created']} created, {summary['updated']} updated, {len(summary['errors'])} errors."
        ))
        for record, message in summary["errors"]:
            self.stdout.write(self.style.ERROR(
                f"  FAILED legacy_user_id={record.get('legacy_user_id')} email={record.get('email')}: {message}"
            ))
