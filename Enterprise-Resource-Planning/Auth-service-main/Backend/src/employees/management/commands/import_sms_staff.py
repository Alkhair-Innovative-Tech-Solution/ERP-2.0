"""
CLI wrapper around employees.sms_import.import_staff_records.

Reads a JSON array of SMS staff records (see employees/sms_import.py's
SMS_STAFF_RECORD_FIELDS docstring for the exact contract) from a file and
imports them. No dataset is hardcoded here — this command is a thin
transport shim; swapping --json-file for a live SMS DB query is the only
change needed to wire this to the real SMS database later.

Usage:
    python manage.py import_sms_staff --json-file /path/to/records.json
"""
import json

from django.core.management.base import BaseCommand, CommandError

from employees.sms_import import import_staff_records


class Command(BaseCommand):
    help = "Import SMS staff user records (JSON file of SMS_STAFF_RECORD_FIELDS-shaped dicts) into central auth's SMS01 tenant. Idempotent."

    def add_arguments(self, parser):
        parser.add_argument("--json-file", required=True, help="Path to a JSON file containing an array of staff records")
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

        summary = import_staff_records(records, tenant_code=options["tenant_code"])

        self.stdout.write(self.style.SUCCESS(
            f"Import done: {summary['created']} created, {summary['updated']} updated, {len(summary['errors'])} errors."
        ))
        for record, message in summary["errors"]:
            self.stdout.write(self.style.ERROR(
                f"  FAILED legacy_user_id={record.get('legacy_user_id')} email={record.get('email')}: {message}"
            ))
