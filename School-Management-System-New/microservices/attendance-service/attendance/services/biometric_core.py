"""
Device-agnostic biometric attendance core.

Single source of truth for turning a raw "punch" (a person identified at a
biometric device at a point in time) into a StaffAttendance row. Every
transport — legacy ADMS HTTP push (ZKTeco-style), the FoxFace REST pull, a
future MQTT subscriber — normalises its payload into the small set of fields
below and calls process_punch(). None of the attendance/identification/timing
rules live in the transport code.

Punch types (normalised):
    0 = check-in   (also break-in / generic "in")
    1 = check-out
"""
from datetime import datetime, time
from django.utils import timezone


CHECK_IN_TYPES = (0, 2, 3, 4)
CHECK_OUT_TYPES = (1,)


def resolve_device(device_serial):
    """Active BiometricDevice for a serial number, or None."""
    from ..models import BiometricDevice
    if not device_serial:
        return None
    return BiometricDevice._base_manager.filter(
        serial_number=str(device_serial), is_active=True
    ).first()


def resolve_user_from_device(device, device_user_id, device_user_name=None):
    """
    Map a device-side user id to an SMS user.

    Resolution order:
      1. Existing BiometricEmployeeMapping for (device, device_user_id).
      2. Fallback match on User.biometric_id, then User.username (same org).

    Side effects (matches legacy adms_push behaviour):
      - Found staff with no mapping  -> auto-create the mapping.
      - Unknown id                   -> create a placeholder mapping (user=None)
                                        so an admin can link it later.

    Returns (user_obj_or_None, mapping_or_None).
    """
    from ..models import BiometricEmployeeMapping
    from users.models import User

    if device is None:
        return None, None

    uid = str(device_user_id)
    mapping = BiometricEmployeeMapping._base_manager.filter(
        device=device, device_user_id=uid
    ).first()

    if mapping and mapping.user:
        return mapping.user, mapping

    user_obj = (
        User.objects.filter(organization=device.organization, biometric_id=uid).first()
        or User.objects.filter(organization=device.organization, username=uid).first()
    )

    if not user_obj:
        # Unknown id -> placeholder mapping for later linking.
        BiometricEmployeeMapping._base_manager.get_or_create(
            device=device,
            device_user_id=uid,
            defaults={
                'organization': device.organization,
                'is_active': True,
                'device_user_name': device_user_name or f"User {uid}",
            },
        )
        return None, None

    # Found staff without a mapping -> auto-map.
    if not mapping:
        mapping, _ = BiometricEmployeeMapping._base_manager.get_or_create(
            device=device,
            device_user_id=uid,
            defaults={
                'organization': user_obj.organization,
                'user': user_obj,
                'is_active': True,
                'device_user_name': user_obj.get_full_name(),
            },
        )
    return user_obj, mapping


def resolve_shift_start_grace(user_obj):
    """
    (check_in_time, grace_minutes) for lateness calc.

    Order: employee shift assignment -> campus shift preset -> campus full_day
    default -> hardcoded 08:00 / 10 min.
    """
    from ..models import CampusDefaultTiming

    shift_start = time(8, 0)
    grace = 10
    resolved = False

    try:
        emp_timing = user_obj.shift_timing
        if emp_timing and emp_timing.is_active:
            if emp_timing.shift_type == 'custom' and emp_timing.check_in_time:
                return emp_timing.check_in_time, emp_timing.grace_minutes
            if emp_timing.shift_type in ('morning', 'afternoon', 'full_day'):
                campus_timing = CampusDefaultTiming.objects.filter(
                    campus_id=user_obj.campus_id,
                    shift_type=emp_timing.shift_type,
                    is_active=True,
                ).first()
                if campus_timing:
                    return campus_timing.check_in_time, campus_timing.grace_minutes
    except Exception:
        pass

    if not resolved:
        try:
            campus_timing = CampusDefaultTiming.objects.filter(
                campus_id=user_obj.campus_id, shift_type='full_day', is_active=True
            ).first()
            if campus_timing:
                return campus_timing.check_in_time, campus_timing.grace_minutes
        except Exception:
            pass

    return shift_start, grace


def upsert_staff_attendance(user_obj, punch_dt, punch_type, device=None):
    """
    Idempotent upsert of one StaffAttendance row from a single punch.

    Re-running the same punch (e.g. an overlapping API poll window) does not
    create duplicates: check-in keeps the earliest time, check-out the latest.
    Returns the StaffAttendance row.
    """
    from ..models import StaffAttendance

    if timezone.is_naive(punch_dt):
        punch_dt = timezone.make_aware(punch_dt)
    punch_date = punch_dt.date()
    punch_time = punch_dt.time()
    punch_type = int(punch_type)

    if punch_type in CHECK_IN_TYPES:
        rec, created = StaffAttendance._base_manager.get_or_create(
            user=user_obj,
            date=punch_date,
            defaults={
                'organization': user_obj.organization,
                'campus': user_obj.campus,
                'check_in_time': punch_time,
                'status': 'present',
                'source': 'biometric',
                'device': device,
            },
        )
        if created:
            shift_start, grace = resolve_shift_start_grace(user_obj)
            late_mins = int(
                (datetime.combine(punch_date, punch_time)
                 - datetime.combine(punch_date, shift_start)).total_seconds() // 60
            )
            if late_mins > grace:
                rec.late_minutes = late_mins
                rec.status = 'late'
                rec.save(update_fields=['late_minutes', 'status'])
        elif not rec.check_in_time or punch_time < rec.check_in_time:
            rec.check_in_time = punch_time
            rec.save(update_fields=['check_in_time'])
        return rec

    # check-out
    rec, _ = StaffAttendance._base_manager.get_or_create(
        user=user_obj,
        date=punch_date,
        defaults={
            'organization': user_obj.organization,
            'campus': user_obj.campus,
            'status': 'present',
            'source': 'biometric',
            'device': device,
        },
    )
    if not rec.check_out_time or punch_time > rec.check_out_time:
        rec.check_out_time = punch_time
        rec.save(update_fields=['check_out_time'])
    return rec


def _match_staff(organization, device_user_id):
    """Find an SMS user for a device id via biometric_id then username (same org)."""
    from users.models import User
    uid = str(device_user_id)
    org_id = getattr(organization, 'id', organization)
    return (
        User.objects.filter(organization_id=org_id, biometric_id=uid).first()
        or User.objects.filter(organization_id=org_id, username=uid).first()
    )


def upsert_device_user_mapping(device, device_user_id, device_user_name=None):
    """
    Pre-load an enrolled device user into a BiometricEmployeeMapping (so it shows in
    the mapping UI before anyone punches) and auto-link it to a staff member by
    biometric_id/username if one matches. Idempotent.

    Returns (mapping, linked: bool).
    """
    from ..models import BiometricEmployeeMapping

    uid = str(device_user_id)
    mapping, _ = BiometricEmployeeMapping._base_manager.get_or_create(
        device=device,
        device_user_id=uid,
        defaults={
            'organization': device.organization,
            'is_active': True,
            'device_user_name': device_user_name or f"User {uid}",
        },
    )
    # Keep the display name fresh.
    if device_user_name and mapping.device_user_name != device_user_name:
        mapping.device_user_name = device_user_name
        mapping.save(update_fields=['device_user_name'])

    if mapping.user_id:
        return mapping, True

    staff = _match_staff(device.organization, uid)
    if staff:
        mapping.user = staff
        mapping.save(update_fields=['user'])
        return mapping, True
    return mapping, False


def auto_link_placeholder_mappings(device=None, organization=None):
    """
    Re-run auto-linking over unlinked mappings (user=None): match each device id to a
    staff by biometric_id/username and link it. Returns the number newly linked.

    Scope by `device`, or by `organization`, or (default) all unlinked mappings.
    """
    from ..models import BiometricEmployeeMapping

    qs = BiometricEmployeeMapping._base_manager.filter(user__isnull=True)
    if device is not None:
        qs = qs.filter(device=device)
    elif organization is not None:
        org_id = getattr(organization, 'id', organization)
        qs = qs.filter(organization_id=org_id)

    linked = 0
    for mapping in qs.select_related('device'):
        org = mapping.organization or (mapping.device.organization if mapping.device else None)
        staff = _match_staff(org, mapping.device_user_id) if org else None
        if staff:
            mapping.user = staff
            mapping.save(update_fields=['user'])
            linked += 1
    return linked


def process_punch(device, device_user_id, punch_dt, punch_type, device_user_name=None):
    """
    High-level entry point: identify the person at `device` and upsert their
    attendance for this punch.

    `device` may be a BiometricDevice or None. Returns one of:
      'no_device' | 'unknown_user' | 'marked'.
    """
    if device is None:
        return 'no_device'

    user_obj, mapping = resolve_user_from_device(device, device_user_id, device_user_name)
    if not user_obj:
        return 'unknown_user'

    upsert_staff_attendance(
        user_obj, punch_dt, punch_type,
        device=(mapping.device if mapping else device),
    )
    return 'marked'
