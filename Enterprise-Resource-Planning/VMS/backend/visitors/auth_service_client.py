"""
HTTP client for communicating with the centralized Auth-Service.

All methods cache responses in Redis (5-min TTL) and raise
AuthServiceUnavailable when the service is unreachable so callers
can decide whether to fall back to local auth or return a 503.
"""
import hashlib
import requests
from django.conf import settings
from django.core.cache import cache

AUTH_SERVICE_URL = getattr(settings, 'AUTH_SERVICE_URL', 'http://localhost:8000')
TIMEOUT = getattr(settings, 'AUTH_SERVICE_TIMEOUT', 5)
CACHE_TTL = 300  # 5 minutes


class AuthServiceUnavailable(Exception):
    """Raised when auth-service cannot be reached."""


def _get(path, *, params=None, token=None):
    """Internal GET helper — raises AuthServiceUnavailable on connection errors."""
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    try:
        resp = requests.get(
            f'{AUTH_SERVICE_URL}{path}',
            params=params,
            headers=headers,
            timeout=TIMEOUT,
        )
        return resp
    except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
        raise AuthServiceUnavailable("Auth Service is currently unreachable.")


def _post(path, *, data):
    """Internal POST helper — raises AuthServiceUnavailable on connection errors."""
    try:
        resp = requests.post(
            f'{AUTH_SERVICE_URL}{path}',
            json=data,
            timeout=TIMEOUT,
        )
        return resp
    except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
        raise AuthServiceUnavailable("Auth Service is currently unreachable.")


# ── Login ────────────────────────────────────────────────────────────────────

def login_vms(employee_code: str, password: str) -> dict:
    """
    POST /api/auth/login-vms on auth-service.

    Returns the full response dict on success.
    Raises AuthServiceUnavailable if unreachable.
    Raises PermissionError (403) or ValueError (401) for auth failures.
    """
    resp = _post('/api/auth/login-vms', data={'employee_code': employee_code, 'password': password})
    if resp.status_code == 200:
        return resp.json()
    if resp.status_code == 403:
        raise PermissionError(resp.json().get('detail', 'No VMS access.'))
    raise ValueError(resp.json().get('detail', 'Invalid credentials.'))


# ── Employees ────────────────────────────────────────────────────────────────

def get_employees(filters: dict = None) -> list:
    """
    GET /api/employees — returns list of employee dicts.
    Caches per unique filter combination.
    """
    params = filters or {}
    cache_key = f'vms:employees:{hashlib.md5(str(sorted(params.items())).encode()).hexdigest()}'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    resp = _get('/api/employees/employees', params=params)
    if resp.status_code != 200:
        return []

    data = resp.json()
    if isinstance(data, dict):
        employees = data.get('employees') or data.get('results') or []
    else:
        employees = data
    cache.set(cache_key, employees, CACHE_TTL)
    return employees


def get_employee(employee_id: str) -> dict | None:
    """GET /api/employees/{employee_id}. Cached per ID."""
    cache_key = f'vms:emp:{employee_id}'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    resp = _get(f'/api/employees/employees/{employee_id}')
    if resp.status_code != 200:
        return None

    emp = resp.json()
    cache.set(cache_key, emp, CACHE_TTL)
    return emp


# ── Departments ──────────────────────────────────────────────────────────────

def get_departments() -> list:
    """GET /api/departments. Cached."""
    cache_key = 'vms:departments'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    resp = _get('/api/employees/departments')
    if resp.status_code != 200:
        return []

    data = resp.json()
    departments = data.get('results', data) if isinstance(data, dict) else data
    cache.set(cache_key, departments, CACHE_TTL)
    return departments


# ── Designations ─────────────────────────────────────────────────────────────

def get_designations(dept_code: str = None) -> list:
    """GET /api/designations, optionally filtered by dept_code. Cached."""
    params = {'dept_code': dept_code} if dept_code else {}
    cache_key = f'vms:designations:{dept_code or "all"}'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    resp = _get('/api/employees/designations', params=params)
    if resp.status_code != 200:
        return []

    data = resp.json()
    designations = data.get('results', data) if isinstance(data, dict) else data
    cache.set(cache_key, designations, CACHE_TTL)
    return designations
