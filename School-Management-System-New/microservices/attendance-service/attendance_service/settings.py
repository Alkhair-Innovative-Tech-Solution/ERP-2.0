import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.getenv("SECRET_KEY", "attendance-service-secret")
DEBUG = os.getenv("DEBUG", "False").lower() == "true"
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "*").split(",")
SERVICE_NAME = "attendance-service"

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "django_filters",
    "channels",
    "attendance",
    "users",
    "services",
    "campus",
    "classes.apps.ClassesConfig",
    "coordinator",
    "teachers",
    "students",
    # Phase C10: vendored in the Dockerfile (COPY microservices/staff-service/
    # principals/) same as coordinator/teachers, but never registered here —
    # a pre-existing gap (confirmed against timetable-service's settings.py,
    # which DOES register it) that breaks BOTH legacy and central-auth
    # principal-tier code paths identically ("Model class principals.models
    # .Principal doesn't declare an explicit app_label and isn't in an
    # application in INSTALLED_APPS" — not a central-auth-specific bug,
    # found live while proving this phase's 7-day edit window with a
    # principal-tier resolution path).
    "principals",
]

AUTH_USER_MODEL = "users.User"

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "users.middleware.OrganizationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "attendance_service.urls"
ASGI_APPLICATION = "attendance_service.asgi.application"
WSGI_APPLICATION = "attendance_service.wsgi.application"

TEMPLATES = [{"BACKEND": "django.template.backends.django.DjangoTemplates",
               "DIRS": [], "APP_DIRS": True,
               "OPTIONS": {"context_processors": [
                   "django.template.context_processors.request",
                   "django.contrib.auth.context_processors.auth",
                   "django.contrib.messages.context_processors.messages"]}}]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "attendance_db"),
        "USER": os.getenv("DB_USER", "attendance_user"),
        "PASSWORD": os.getenv("DB_PASSWORD", "attendance_pass"),
        "HOST": os.getenv("DB_HOST", "postgres-attendance"),
        "PORT": os.getenv("DB_PORT", "5432"),
        "CONN_MAX_AGE": 60,
    }
}

REST_FRAMEWORK = {
    # Phase D-R4: DualAuthentication now delegates straight to
    # CentralAuthAuthentication (RS256/JWKS) — the legacy HS256 branch is
    # gone. See docs/PHASE_D_R4R6_REMOVAL_RESULT.md.
    "DEFAULT_AUTHENTICATION_CLASSES": ["attendance_service.dual_auth.DualAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 100,
}

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": os.getenv("REDIS_URL", "redis://redis:6379/6"),
        "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
    }
}

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [os.getenv("REDIS_URL", "redis://redis:6379/6")]},
    }
}

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
STATIC_URL = "/attendance-admin/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_TZ = True
INTERNAL_SERVICE_SECRET = os.getenv("INTERNAL_SERVICE_SECRET", "")
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")

STAFF_SERVICE_URL = os.getenv("STAFF_SERVICE_URL", "http://staff-service:8004")
STUDENT_SERVICE_URL = os.getenv("STUDENT_SERVICE_URL", "http://student-service:8005")

# Phase C10: central auth JWKS verification (central_auth/jwks.py).
AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://host.docker.internal:8000")

# --- FoxFace (Foxit hosted face-recognition platform) -------------------------
# Used by `manage.py sync_foxface_logs` to pull user logs into StaffAttendance.
# Confirmed against the vendor API Portal (foxface.foxit.pk). All params — key,
# fromDate, toDate, LocationId — are sent as HTTP *headers*, not query string.
# NOTE: keys default to the known tenant keys so it runs out-of-box; move them to
# env / a secret store for production.
FOXFACE_BASE_URL = os.getenv("FOXFACE_BASE_URL", "http://foxface.foxit.pk")
FOXFACE_API_KEY_HEADER = os.getenv("FOXFACE_API_KEY_HEADER", "key")
FOXFACE_USERLOGS_API_KEY = os.getenv("FOXFACE_USERLOGS_API_KEY", "Foxit_12345678_0987654321098112")
FOXFACE_DEVICE_API_KEY = os.getenv("FOXFACE_DEVICE_API_KEY", "Foxit_12345678_098765432109879036")
FOXFACE_USERLOGS_PATH = os.getenv("FOXFACE_USERLOGS_PATH", "api/UserLogApi/GetUserLogsByDate")
# Live device status (GET ALL DEVICES JSON) + enrolled-user discovery (USERLOGS BY
# DEVICE ID). Both authorize with the USER LOGS key on this deployment.
FOXFACE_DEVICES_PATH = os.getenv("FOXFACE_DEVICES_PATH", "api/DeviceApi/GetAllDevicesJson")
FOXFACE_USERS_PATH = os.getenv("FOXFACE_USERS_PATH", "api/UserLogApi/GetUserLogsByDeviceId")

SILENCED_SYSTEM_CHECKS = ["fields.E300", "fields.E307"]
MIGRATION_MODULES = {"teachers": "teachers_attendance_migrations"}

# ── Django admin over the gateway (https://ams.idaraalkhair.sbs/attendance-admin/) ──
CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.getenv("CSRF_TRUSTED_ORIGINS", "https://ams.idaraalkhair.sbs").split(",")
    if o.strip()
]
# Per-service cookie names so admin sessions on the shared domain don't clash
SESSION_COOKIE_NAME = "attendance_sessionid"
CSRF_COOKIE_NAME = "attendance_csrftoken"
