import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.getenv("SECRET_KEY", "staff-service-secret")
DEBUG = os.getenv("DEBUG", "False").lower() == "true"
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "*").split(",")
SERVICE_NAME = "staff-service"

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
    "django_cleanup.apps.CleanupConfig",
    "phonenumber_field",
    "teachers.apps.TeachersConfig",
    "coordinator.apps.CoordinatorConfig",
    "principals.apps.PrincipalsConfig",
    "users",
    "classes.apps.ClassesConfig",
    "students",
    "campus",
    "services",
]

AUTH_USER_MODEL = "users.User"

MIDDLEWARE = [
    "middleware.JsonErrorMiddleware",
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

ROOT_URLCONF = "staff_service.urls"
WSGI_APPLICATION = "staff_service.wsgi.application"

TEMPLATES = [{"BACKEND": "django.template.backends.django.DjangoTemplates",
               "DIRS": [], "APP_DIRS": True,
               "OPTIONS": {"context_processors": [
                   "django.template.context_processors.request",
                   "django.contrib.auth.context_processors.auth",
                   "django.contrib.messages.context_processors.messages"]}}]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "staff_db"),
        "USER": os.getenv("DB_USER", "staff_user"),
        "PASSWORD": os.getenv("DB_PASSWORD", "staff_pass"),
        "HOST": os.getenv("DB_HOST", "postgres-staff"),
        "PORT": os.getenv("DB_PORT", "5432"),
        "CONN_MAX_AGE": 60,
    },
    # Phase C12: the assign_teacher-hang fix. teachers/signals.py's
    # _sync_class_teacher_to_campus_db previously opened its own ad-hoc
    # `psycopg2.connect()` per m2m change, with no statement/lock timeout —
    # a lock held on campus-service's own tables (or a slow/unreachable
    # host) blocked that call, and gunicorn's sync worker, forever ("hangs
    # until killed"). This alias gives the exact same target DB a real,
    # Django-managed connection instead: pooled/lifecycle-managed by
    # Django rather than a bespoke connect()-per-call, AND — the actual
    # fix for the hang itself — a hard 5s statement_timeout / 3s
    # lock_timeout, so a blocked query is forcibly killed instead of
    # hanging indefinitely. See teachers/signals.py's updated
    # _sync_class_teacher_to_campus_db for the query using it (unchanged
    # SQL — see that file's comment for why raw SQL was kept rather than
    # switched to the ORM's QuerySet API).
    "campus_db": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("CAMPUS_DB_NAME", "campus_db"),
        "USER": os.getenv("CAMPUS_DB_USER", "campus_user"),
        "PASSWORD": os.getenv("CAMPUS_DB_PASSWORD", "campus_pass"),
        "HOST": os.getenv("CAMPUS_DB_HOST", "postgres-campus"),
        "PORT": os.getenv("CAMPUS_DB_PORT", "5432"),
        "CONN_MAX_AGE": 60,
        "CONNECT_TIMEOUT": 3,
        "OPTIONS": {
            "options": "-c statement_timeout=5000 -c lock_timeout=3000",
        },
    },
}
# No DATABASE_ROUTERS entry for 'campus_db' — deliberately not
# auto-routed. Every staff-service model (Teacher, ClassRoom, etc.)
# continues to use 'default' unless a call site explicitly passes
# using='campus_db' (only teachers/signals.py does).

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["staff_service.dual_auth.DualAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 100,
    "EXCEPTION_HANDLER": "utils.exceptions.custom_exception_handler",
}

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": os.getenv("REDIS_URL", "redis://redis:6379/4"),
        "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
    }
}

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
STATIC_URL = "/staff-admin/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_TZ = True
INTERNAL_SERVICE_SECRET = os.getenv("INTERNAL_SERVICE_SECRET", "")
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
# NOTE: this Django *setting* (AUTH_SERVICE_URL) was, before Phase C12,
# an orphaned mirror of the raw AUTH_SERVICE_URL env var — confirmed
# nothing in this codebase ever read `settings.AUTH_SERVICE_URL`;
# sync_staff_to_auth.py and user_creation_service.py both read the raw
# env var directly via os.getenv(). Phase C12's central_auth/jwks.py is
# the first thing that actually consults this Django setting (hardcoded
# `getattr(settings, 'AUTH_SERVICE_URL', ...)`, part of the unchanged
# template) — and it needs to mean the CENTRAL auth-service (:8000), not
# the legacy org/user-sync one (:8001) that the raw env var of the same
# name points at everywhere else in this service. Repointed to reuse
# Phase B4's existing CENTRAL_AUTH_URL env var (services/
# central_auth_sync_service.py already points it at the same central
# auth-service) instead of the raw AUTH_SERVICE_URL env var, which — and
# every other file that reads it directly — stays untouched.
AUTH_SERVICE_URL = os.getenv("CENTRAL_AUTH_URL", "http://host.docker.internal:8000")

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True").lower() == "true"
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "no-reply.ait@iak.ngo")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "no-reply.ait@iak.ngo")

# Internal service URLs for cross-service calls
CAMPUS_SERVICE_URL = os.getenv("CAMPUS_SERVICE_URL", "http://campus-service:8003")

# Silence cross-service FK checks for timetable.Subject not installed here
SILENCED_SYSTEM_CHECKS = ["fields.E300", "fields.E307"]

# Skip migration 0005 which depends on timetable app
MIGRATION_MODULES = {
    "teachers": "teachers_staff_migrations",
}

# ── Django admin over the gateway (https://ams.idaraalkhair.sbs/staff-admin/) ──
CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.getenv("CSRF_TRUSTED_ORIGINS", "https://ams.idaraalkhair.sbs").split(",")
    if o.strip()
]
# Per-service cookie names so admin sessions on the shared domain don't clash
SESSION_COOKIE_NAME = "staff_sessionid"
CSRF_COOKIE_NAME = "staff_csrftoken"
