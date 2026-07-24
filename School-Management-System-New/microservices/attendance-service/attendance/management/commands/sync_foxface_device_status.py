"""
Mirror live device online/offline status from the FoxFace platform onto our
BiometricDevice rows. Run on a schedule (e.g. every 2-5 min) so the UI shows
real connectivity instead of just the is_active admin flag.

    python manage.py sync_foxface_device_status
"""
from django.core.management.base import BaseCommand
from django.utils import timezone

from attendance.models import BiometricDevice
from attendance.services.foxface_client import FoxFaceClient, FoxFaceConfigError


class Command(BaseCommand):
    help = "Update BiometricDevice.is_online from the FoxFace platform."

    def handle(self, *args, **opts):
        client = FoxFaceClient()
        try:
            devices = client.get_devices()
        except FoxFaceConfigError as e:
            self.stderr.write(self.style.ERROR(str(e)))
            return
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"FoxFace device fetch failed: {e}"))
            return

        now = timezone.now()
        status_by_serial = {d['serial']: d['is_online'] for d in devices}
        updated = 0
        for dev in BiometricDevice._base_manager.filter(serial_number__in=status_by_serial.keys()):
            dev.is_online = status_by_serial.get(dev.serial_number)
            dev.last_status_check = now
            dev.save(update_fields=['is_online', 'last_status_check'])
            updated += 1

        self.stdout.write(self.style.SUCCESS(
            f"FoxFace status sync: {len(devices)} platform devices, {updated} matched/updated."
        ))
