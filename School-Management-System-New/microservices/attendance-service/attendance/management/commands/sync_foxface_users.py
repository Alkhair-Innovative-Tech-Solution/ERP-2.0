"""
Pre-load enrolled device users from the FoxFace platform into our mapping table
and auto-link them to staff (by biometric_id/username). This lets a principal see
and link device users in the UI *before* anyone punches.

    python manage.py sync_foxface_users                 # all our FoxFace devices
    python manage.py sync_foxface_users --serial 2385083
"""
from django.core.management.base import BaseCommand

from attendance.models import BiometricDevice
from attendance.services.biometric_core import upsert_device_user_mapping
from attendance.services.foxface_client import FoxFaceClient, FoxFaceConfigError


class Command(BaseCommand):
    help = "Sync enrolled users from FoxFace into mappings and auto-link to staff."

    def add_arguments(self, parser):
        parser.add_argument('--serial', default=None,
                            help="Only this device serial (default: all FoxFace devices).")

    def handle(self, *args, **opts):
        client = FoxFaceClient()

        devices = BiometricDevice._base_manager.filter(device_type='foxface')
        if opts['serial']:
            devices = devices.filter(serial_number=opts['serial'])
        devices = list(devices)
        if not devices:
            self.stderr.write(self.style.WARNING("No matching FoxFace devices registered."))
            return

        total_seen = total_linked = 0
        for dev in devices:
            try:
                users = client.get_device_users(dev.serial_number)
            except FoxFaceConfigError as e:
                self.stderr.write(self.style.ERROR(str(e)))
                return
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"[{dev.serial_number}] fetch failed: {e}"))
                continue

            for u in users:
                # If the platform scopes by device, serial may be blank — use this device.
                _, linked = upsert_device_user_mapping(
                    dev, u['device_user_id'], u.get('device_user_name'))
                total_seen += 1
                total_linked += 1 if linked else 0

            self.stdout.write(f"  {dev.name} ({dev.serial_number}): {len(users)} users")

        self.stdout.write(self.style.SUCCESS(
            f"FoxFace user sync: {total_seen} enrolled users, {total_linked} linked to staff."
        ))
