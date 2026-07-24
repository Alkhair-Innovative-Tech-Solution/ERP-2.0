"""
Pull recent punches from the FoxFace hosted platform and upsert StaffAttendance.

Run on a schedule (cron / Celery beat / a docker sidecar loop), e.g. every
5 minutes:

    python manage.py sync_foxface_logs                 # last 15 min (overlap)
    python manage.py sync_foxface_logs --minutes 60
    python manage.py sync_foxface_logs --from "2026-06-23 00:00:00" \
                                       --to   "2026-06-23 23:59:59"

The poll window deliberately overlaps the previous run; upserts are idempotent
(see biometric_core.upsert_staff_attendance), so re-seeing a punch is harmless.
A single tenant API key returns logs for all of that tenant's devices; we map
each log to its BiometricDevice by serial number, so one command covers every
school on the platform.
"""
from datetime import datetime

from django.core.management.base import BaseCommand
from django.utils import timezone

from attendance.services.biometric_core import process_punch, resolve_device
from attendance.services.foxface_client import FoxFaceClient, FoxFaceConfigError


class Command(BaseCommand):
    help = "Pull user logs from the FoxFace platform into StaffAttendance."

    def add_arguments(self, parser):
        # The platform filters logs by DATE (YYYY-MM-DD), so the window is day-grained.
        parser.add_argument(
            '--days', type=int, default=1,
            help="Pull today plus this many previous days (default 1 = today + yesterday).",
        )
        parser.add_argument('--from', dest='from_dt', default=None,
                            help='Window start date "YYYY-MM-DD" (overrides --days).')
        parser.add_argument('--to', dest='to_dt', default=None,
                            help='Window end date "YYYY-MM-DD" (defaults to today).')

    def _parse(self, value):
        dt = datetime.strptime(value, '%Y-%m-%d')
        return timezone.make_aware(dt) if timezone.is_naive(dt) else dt

    def handle(self, *args, **opts):
        now = timezone.now()
        until = self._parse(opts['to_dt']) if opts['to_dt'] else now
        if opts['from_dt']:
            since = self._parse(opts['from_dt'])
        else:
            since = until - timezone.timedelta(days=opts['days'])

        self.stdout.write(f"FoxFace sync window: {since:%Y-%m-%d} -> {until:%Y-%m-%d}")

        client = FoxFaceClient()
        try:
            punches = client.get_punches(since, until)
        except FoxFaceConfigError as e:
            self.stderr.write(self.style.ERROR(str(e)))
            return
        except Exception as e:  # network / HTTP / JSON
            self.stderr.write(self.style.ERROR(f"FoxFace fetch failed: {e}"))
            return

        stats = {'marked': 0, 'unknown_user': 0, 'no_device': 0}
        device_cache = {}

        for p in punches:
            serial = p.get('device_serial')
            if serial not in device_cache:
                device_cache[serial] = resolve_device(serial)
            device = device_cache[serial]

            result = process_punch(
                device=device,
                device_user_id=p['device_user_id'],
                punch_dt=p['punch_dt'],
                punch_type=p['punch_type'],
                device_user_name=p.get('device_user_name'),
            )
            stats[result] = stats.get(result, 0) + 1

        # Stamp last_sync on the devices we just polled.
        for device in device_cache.values():
            if device is not None:
                device.last_sync = now
                device.save(update_fields=['last_sync'])

        self.stdout.write(self.style.SUCCESS(
            f"FoxFace sync done: {len(punches)} logs | "
            f"marked={stats['marked']} unknown_user={stats['unknown_user']} "
            f"no_device={stats['no_device']}"
        ))
