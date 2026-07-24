"""
FoxFace (Foxit hosted platform) REST client.

The vendor runs a multi-tenant platform (foxface.foxit.pk) that ingests punches
from every device and exposes them over an API-key-authenticated REST API. We
*pull* the user logs on a schedule rather than self-hosting a broker.

This module is the ONLY place that knows the vendor's wire format. It returns a
list of normalised punch dicts:

    {
        'device_user_id': str,
        'device_serial':  str | None,
        'punch_dt':       aware datetime,
        'punch_type':     int,   # 0 = check-in, 1 = check-out
    }

biometric_core.process_punch() consumes those and applies all SMS-side rules.

Configuration (env, read in attendance_service/settings.py):
    FOXFACE_BASE_URL          e.g. https://foxface.foxit.pk
    FOXFACE_USERLOGS_API_KEY  the "USER LOGS" API key from the API Portal
    FOXFACE_USERLOGS_PATH     endpoint path for "get user logs by date range"
    FOXFACE_API_KEY_HEADER    header name the platform expects (default API_KEY)

NOTE: the exact endpoint path, query-param names and JSON field names below are
placeholders pending the API Portal contract. Everything is centralised in
_PARAMS / normalize_log so confirming them is a one-spot change. See
docs/FOXFACE_MASTER.md §3.3.
"""
from datetime import datetime
import logging

from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime

logger = logging.getLogger(__name__)


# --- vendor contract (confirmed against the foxface.foxit.pk API Portal) -------
# The platform takes ALL request params as HTTP headers (not query string):
#   key, fromDate, toDate (YYYY-MM-DD), LocationId (optional), deviceId, empCode.
_PARAM_FROM = 'fromDate'
_PARAM_TO = 'toDate'
_PARAM_DEVICE = 'deviceId'           # filter users/logs by a device serial
_DATE_FMT = '%Y-%m-%d'               # portal requires YYYY-MM-DD

# JSON keys for each *log* object — actual response:
#   {"deviceId","employeeCode","employeeName","logType","status","time"}
_FIELD_USER_ID = ('employeeCode', 'EmployeeCode', 'UserId', 'userId', 'PIN')
_FIELD_NAME = ('employeeName', 'EmployeeName', 'UserName', 'Name', 'name')
_FIELD_SERIAL = ('deviceId', 'DeviceId', 'SerialNumber', 'SN')
_FIELD_TIME = ('time', 'Time', 'LogDateTime', 'PunchTime', 'Timestamp')
_FIELD_DIRECTION = ('status', 'Status', 'InOut', 'Direction', 'PunchType')

# JSON keys for a *device* object (GET ALL DEVICES JSON). Online = connectionStatus
# (bool); `status` is the admin Active/InActive flag, not live connectivity.
_DFIELD_SERIAL = ('deviceId', 'DeviceId', 'SerialNumber', 'serialNumber', 'SN')
_DFIELD_NAME = ('deviceName', 'DeviceName', 'Name', 'name')
_DFIELD_ONLINE = ('connectionStatus', 'ConnectionStatus', 'IsOnline', 'isOnline', 'Online')

# Enrolled users are discovered from USERLOGS BY DEVICE ID (log rows), deduped by id.
_UFIELD_USER_ID = ('employeeCode', 'EmployeeCode', 'UserId', 'userId', 'PIN', 'Id')
_UFIELD_NAME = ('employeeName', 'EmployeeName', 'UserName', 'Name', 'FullName')
_UFIELD_SERIAL = ('deviceId', 'DeviceId', 'SerialNumber', 'SN')
# -----------------------------------------------------------------------------


class FoxFaceConfigError(RuntimeError):
    pass


class FoxFaceClient:
    def __init__(self, base_url=None, timeout=30):
        self.base_url = (base_url or getattr(settings, 'FOXFACE_BASE_URL', '')).rstrip('/')
        self.key_header = getattr(settings, 'FOXFACE_API_KEY_HEADER', 'API_KEY')
        self.timeout = timeout
        # Two API-key groups from the portal: user-logs and device.
        self.userlogs_key = getattr(settings, 'FOXFACE_USERLOGS_API_KEY', '')
        self.device_key = getattr(settings, 'FOXFACE_DEVICE_API_KEY', '')
        # Endpoint paths (from the API Portal).
        self.logs_path = getattr(settings, 'FOXFACE_USERLOGS_PATH', '').lstrip('/')
        self.devices_path = getattr(settings, 'FOXFACE_DEVICES_PATH', '').lstrip('/')
        self.users_path = getattr(settings, 'FOXFACE_USERS_PATH', '').lstrip('/')

    def _require(self, **named):
        missing = [n for n, v in named.items() if not v]
        if not self.base_url:
            missing.insert(0, 'FOXFACE_BASE_URL')
        if missing:
            raise FoxFaceConfigError(
                "Missing FoxFace config: " + ", ".join(missing)
                + ". Set it in the attendance-service environment."
            )

    def _get(self, path, api_key, params=None):
        """
        GET {base}/{path} with all params as HTTP *headers* (vendor requirement),
        return the response 'data' list (unwrapped). A 404 'Record not found' is a
        normal empty result, not an error.
        """
        import requests
        url = f"{self.base_url}/{path}"
        headers = {self.key_header: api_key, 'Accept': 'application/json'}
        for k, v in (params or {}).items():
            if v is not None:
                headers[k] = str(v)
        resp = requests.get(url, headers=headers, timeout=self.timeout)
        if resp.status_code == 404:
            return []
        resp.raise_for_status()
        payload = resp.json()
        if isinstance(payload, dict):
            for key in ('data', 'Data', 'result', 'Result', 'logs', 'Logs',
                        'devices', 'Devices', 'users', 'Users', 'items'):
                if isinstance(payload.get(key), list):
                    return payload[key]
            return []
        return payload if isinstance(payload, list) else []

    # ── User logs (attendance) ───────────────────────────────────────────────
    def fetch_logs(self, since, until):
        """Raw log dicts for the [since, until] date range (aware datetimes)."""
        self._require(FOXFACE_USERLOGS_API_KEY=self.userlogs_key,
                      FOXFACE_USERLOGS_PATH=self.logs_path)
        return self._get(self.logs_path, self.userlogs_key, {
            _PARAM_FROM: since.strftime(_DATE_FMT),
            _PARAM_TO: until.strftime(_DATE_FMT),
        })

    def get_punches(self, since, until):
        """fetch_logs() + normalise; skips and logs un-parseable rows."""
        punches = []
        for raw in self.fetch_logs(since, until):
            punch = normalize_log(raw)
            if punch:
                punches.append(punch)
            else:
                logger.warning("FoxFace: could not normalise log row: %r", raw)
        return punches

    # ── Devices (live status) ────────────────────────────────────────────────
    def get_devices(self):
        """Normalised device dicts: {serial, name, is_online}. Authorized by the
        USER LOGS key on this deployment."""
        self._require(FOXFACE_USERLOGS_API_KEY=self.userlogs_key,
                      FOXFACE_DEVICES_PATH=self.devices_path)
        out = []
        for raw in self._get(self.devices_path, self.userlogs_key):
            d = normalize_device(raw)
            if d:
                out.append(d)
            else:
                logger.warning("FoxFace: could not normalise device row: %r", raw)
        return out

    # ── Enrolled users (discovered from per-device logs, deduped) ─────────────
    def get_device_users(self, device_serial=None):
        """Distinct enrolled users for a device: {device_user_id, device_user_name,
        device_serial}. Derived from USERLOGS BY DEVICE ID (deviceId header)."""
        self._require(FOXFACE_USERLOGS_API_KEY=self.userlogs_key,
                      FOXFACE_USERS_PATH=self.users_path)
        params = {_PARAM_DEVICE: device_serial} if device_serial else {}
        seen = {}
        for raw in self._get(self.users_path, self.userlogs_key, params):
            u = normalize_device_user(raw)
            if u and u['device_user_id'] not in seen:
                seen[u['device_user_id']] = u
        return list(seen.values())


def _first(raw, keys):
    for k in keys:
        if k in raw and raw[k] not in (None, ''):
            return raw[k]
    return None


def _parse_dt(value):
    if isinstance(value, datetime):
        dt = value
    else:
        s = str(value).strip()
        dt = parse_datetime(s)
        if dt is None:
            for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M'):
                try:
                    dt = datetime.strptime(s, fmt)
                    break
                except ValueError:
                    continue
    if dt is None:
        return None
    return timezone.make_aware(dt) if timezone.is_naive(dt) else dt


def _parse_direction(value):
    """Map the platform's in/out indicator to 0 (in) / 1 (out). FoxFace uses
    status='entr' (entry) / 'exit'."""
    if value is None:
        return 0
    s = str(value).strip().lower()
    if s in ('1', 'out', 'exit', 'checkout', 'check-out', 'o'):
        return 1
    if s in ('0', 'in', 'entr', 'entry', 'checkin', 'check-in', 'i'):
        return 0
    try:
        return 1 if int(s) == 1 else 0
    except ValueError:
        return 0


def _parse_online(value):
    """Map the platform's status indicator to True/False/None (unknown)."""
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    s = str(value).strip().lower()
    if s in ('1', 'true', 'online', 'active', 'connected', 'yes'):
        return True
    if s in ('0', 'false', 'offline', 'inactive', 'disconnected', 'no'):
        return False
    return None


def normalize_log(raw):
    """
    Vendor log dict -> normalised punch dict, or None if it lacks the essentials.
    """
    if not isinstance(raw, dict):
        return None
    user_id = _first(raw, _FIELD_USER_ID)
    when = _parse_dt(_first(raw, _FIELD_TIME))
    if user_id is None or when is None:
        return None
    return {
        'device_user_id': str(user_id),
        'device_user_name': (str(_first(raw, _FIELD_NAME)) if _first(raw, _FIELD_NAME) else None),
        'device_serial': (str(_first(raw, _FIELD_SERIAL))
                          if _first(raw, _FIELD_SERIAL) is not None else None),
        'punch_dt': when,
        'punch_type': _parse_direction(_first(raw, _FIELD_DIRECTION)),
    }


def normalize_device(raw):
    """Vendor device dict -> {serial, name, is_online}, or None if no serial."""
    if not isinstance(raw, dict):
        return None
    serial = _first(raw, _DFIELD_SERIAL)
    if serial is None:
        return None
    return {
        'serial': str(serial),
        'name': (str(_first(raw, _DFIELD_NAME)) if _first(raw, _DFIELD_NAME) else None),
        'is_online': _parse_online(_first(raw, _DFIELD_ONLINE)),
    }


def normalize_device_user(raw):
    """Vendor enrolled-user dict -> {device_user_id, device_user_name, device_serial}."""
    if not isinstance(raw, dict):
        return None
    user_id = _first(raw, _UFIELD_USER_ID)
    if user_id is None:
        return None
    return {
        'device_user_id': str(user_id),
        'device_user_name': (str(_first(raw, _UFIELD_NAME)) if _first(raw, _UFIELD_NAME) else None),
        'device_serial': (str(_first(raw, _UFIELD_SERIAL))
                          if _first(raw, _UFIELD_SERIAL) is not None else None),
    }
