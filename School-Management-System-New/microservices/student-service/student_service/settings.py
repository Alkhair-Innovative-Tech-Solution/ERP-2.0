import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.getenv("SECRET_KEY", "student-service-secret")
DEBUG = os.getenv("DEBUG", "False").lower() == "true"
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "*").split(",")
SERVICE_NAME = "student-service"

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
    "students",
    "student_status",
    "behaviour",
    "users",
    "classes.apps.ClassesConfig",
    "coordinator",
    "teachers",
    "campus",
    "services",
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

ROOT_URLCONF = "student_service.urls"
WSGI_APPLICATION = "student_service.wsgi.application"

TEMPLATES = [{"BACKEND": "django.template.backends.django.DjangoTemplates",
               "DIRS": [], "APP_DIRS": True,
               "OPTIONS": {"context_processors": [
                   "django.template.context_processors.request",
                   "django.contrib.auth.context_processors.auth",
                   "django.contrib.messages.context_processors.messages"]}}]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "student_db"),
        "USER": os.getenv("DB_USER", "student_user"),
        "PASSWORD": os.getenv("DB_PASSWORD", "student_pass"),
        "HOST": os.getenv("DB_HOST", "postgres-student"),
        "PORT": os.getenv("DB_PORT", "5432"),
        "CONN_MAX_AGE": 60,
    }
}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["student_service.dual_auth.DualAuthentication"],
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
        "LOCATION": os.getenv("REDIS_URL", "redis://redis:6379/5"),
        "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
    }
}

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
STATIC_URL = "/student-admin/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_TZ = True
INTERNAL_SERVICE_SECRET = os.getenv("INTERNAL_SERVICE_SECRET", "")
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")

CAMPUS_SERVICE_URL = os.getenv("CAMPUS_SERVICE_URL", "http://campus-service:8003")

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://host.docker.internal:8000")

# Phase C8: read-only connection info for the auth-service's shared Postgres,
# used ONLY by `students/management/commands/remap_central_user_ids.py` (an
# offline batch tool, never touched at request time) to resolve
# Student.central_user_id from auth_non_staff_identity.legacy_user_id — see
# that command's docstring. Same host.docker.internal + published-port path
# every SMS service already uses for AUTH_SERVICE_URL/JWKS; no new infra.
CENTRAL_AUTH_DB_HOST = os.getenv("CENTRAL_AUTH_DB_HOST", "host.docker.internal")
CENTRAL_AUTH_DB_PORT = os.getenv("CENTRAL_AUTH_DB_PORT", "5432")
CENTRAL_AUTH_DB_NAME = os.getenv("CENTRAL_AUTH_DB_NAME", "auth_db")
CENTRAL_AUTH_DB_USER = os.getenv("CENTRAL_AUTH_DB_USER", "erp_admin")
CENTRAL_AUTH_DB_PASSWORD = os.getenv("CENTRAL_AUTH_DB_PASSWORD", "")

SILENCED_SYSTEM_CHECKS = ["fields.E300", "fields.E307"]
MIGRATION_MODULES = {"teachers": "teachers_student_migrations"}

# ── Django admin over the gateway (https://ams.idaraalkhair.sbs/student-admin/) ──
CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.getenv("CSRF_TRUSTED_ORIGINS", "https://ams.idaraalkhair.sbs").split(",")
    if o.strip()
]
# Per-service cookie names so admin sessions on the shared domain don't clash
SESSION_COOKIE_NAME = "student_sessionid"
CSRF_COOKIE_NAME = "student_csrftoken"
