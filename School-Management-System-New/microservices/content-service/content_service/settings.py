import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.getenv("SECRET_KEY", "content-service-secret")
DEBUG = os.getenv("DEBUG", "False").lower() == "true"
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "*").split(",")
SERVICE_NAME = "content-service"

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
    "content",
    "users",
    "campus",
    "classes.apps.ClassesConfig",
    "coordinator",
    "teachers",
    "principals",
    "services",
]

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

AUTH_USER_MODEL = "users.User"
ROOT_URLCONF = "content_service.urls"
WSGI_APPLICATION = "content_service.wsgi.application"

TEMPLATES = [{"BACKEND": "django.template.backends.django.DjangoTemplates",
               "DIRS": [], "APP_DIRS": True,
               "OPTIONS": {"context_processors": [
                   "django.template.context_processors.request",
                   "django.contrib.auth.context_processors.auth",
                   "django.contrib.messages.context_processors.messages"]}}]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "content_db"),
        "USER": os.getenv("DB_USER", "content_user"),
        "PASSWORD": os.getenv("DB_PASSWORD", "content_pass"),
        "HOST": os.getenv("DB_HOST", "postgres-content"),
        "PORT": os.getenv("DB_PORT", "5432"),
        "CONN_MAX_AGE": 60,
    }
}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["ams_shared.jwt.validator.ServiceJWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
}

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": os.getenv("REDIS_URL", "redis://redis:6379/13"),
        "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
    }
}

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
STATIC_URL = "/content-admin/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_TZ = True

INTERNAL_SERVICE_SECRET = os.getenv("INTERNAL_SERVICE_SECRET", "")
SUBJECT_SERVICE_URL = os.getenv("SUBJECT_SERVICE_URL", "http://subject-service:8012")

MIGRATION_MODULES = {
    "teachers": "teachers_campus_migrations",
}

SILENCED_SYSTEM_CHECKS = ["fields.E300", "fields.E307"]

# --- Uploads -----------------------------------------------------------------
# Keep the in-memory threshold small so large files (e.g. videos) STREAM to a
# temp file on disk instead of being buffered whole in RAM. The real per-file
# size caps are enforced per content-type in ContentItemCreateSerializer, and
# nginx caps the whole request body (client_max_body_size 200M).
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024        # 5 MB → above this, stream to disk
DATA_UPLOAD_MAX_MEMORY_SIZE = 250 * 1024 * 1024      # request-body ceiling (file parts excluded)

# ── Django admin over the gateway (https://ams.idaraalkhair.sbs/content-admin/) ──
CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.getenv("CSRF_TRUSTED_ORIGINS", "https://ams.idaraalkhair.sbs").split(",")
    if o.strip()
]
# Per-service cookie names so admin sessions on the shared domain don't clash
SESSION_COOKIE_NAME = "content_sessionid"
CSRF_COOKIE_NAME = "content_csrftoken"
