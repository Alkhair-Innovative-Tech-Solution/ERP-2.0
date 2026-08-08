import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.getenv("SECRET_KEY", "ai-service-secret-change-in-production")
DEBUG = os.getenv("DEBUG", "False").lower() == "true"
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "*").split(",")

SERVICE_NAME = "ai-service"

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "ai_chat",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.middleware.common.CommonMiddleware",
]

APPEND_SLASH = False
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
CORS_ALLOW_HEADERS = ["accept", "authorization", "content-type", "origin", "x-requested-with"]

ROOT_URLCONF = "ai_service.urls"

TEMPLATES = [{"BACKEND": "django.template.backends.django.DjangoTemplates", "DIRS": [], "APP_DIRS": True, "OPTIONS": {"context_processors": []}}]

WSGI_APPLICATION = "ai_service.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "ai_db"),
        "USER": os.getenv("DB_USER", "ai_user"),
        "PASSWORD": os.getenv("DB_PASSWORD", "ai_pass"),
        "HOST": os.getenv("DB_HOST", "postgres-ai"),
        "PORT": os.getenv("DB_PORT", "5432"),
        "CONN_MAX_AGE": 60,
    }
}

# Cross-service DB env vars (psycopg2 direct connections)
STUDENT_DB  = {"host": os.getenv("STUDENT_DB_HOST",  "postgres-student"),  "dbname": os.getenv("STUDENT_DB_NAME",  "student_db"),  "user": os.getenv("STUDENT_DB_USER",  "student_user"),  "password": os.getenv("STUDENT_DB_PASSWORD",  "student_pass"),  "port": os.getenv("STUDENT_DB_PORT",  "5432")}
ATTENDANCE_DB = {"host": os.getenv("ATTENDANCE_DB_HOST", "postgres-attendance"), "dbname": os.getenv("ATTENDANCE_DB_NAME", "attendance_db"), "user": os.getenv("ATTENDANCE_DB_USER", "attendance_user"), "password": os.getenv("ATTENDANCE_DB_PASSWORD", "attendance_pass"), "port": os.getenv("ATTENDANCE_DB_PORT", "5432")}
STAFF_DB    = {"host": os.getenv("STAFF_DB_HOST",    "postgres-staff"),    "dbname": os.getenv("STAFF_DB_NAME",    "staff_db"),    "user": os.getenv("STAFF_DB_USER",    "staff_user"),    "password": os.getenv("STAFF_DB_PASSWORD",    "staff_pass"),    "port": os.getenv("STAFF_DB_PORT",    "5432")}
CAMPUS_DB   = {"host": os.getenv("CAMPUS_DB_HOST",   "postgres-campus"),   "dbname": os.getenv("CAMPUS_DB_NAME",   "campus_db"),   "user": os.getenv("CAMPUS_DB_USER",   "campus_user"),   "password": os.getenv("CAMPUS_DB_PASSWORD",   "campus_pass"),   "port": os.getenv("CAMPUS_DB_PORT",   "5432")}
RESULT_DB   = {"host": os.getenv("RESULT_DB_HOST",   "postgres-result"),   "dbname": os.getenv("RESULT_DB_NAME",   "result_db"),   "user": os.getenv("RESULT_DB_USER",   "result_user"),   "password": os.getenv("RESULT_DB_PASSWORD",   "result_pass"),   "port": os.getenv("RESULT_DB_PORT",   "5432")}
TIMETABLE_DB = {"host": os.getenv("TIMETABLE_DB_HOST", "postgres-timetable"), "dbname": os.getenv("TIMETABLE_DB_NAME", "timetable_db"), "user": os.getenv("TIMETABLE_DB_USER", "timetable_user"), "password": os.getenv("TIMETABLE_DB_PASSWORD", "timetable_pass"), "port": os.getenv("TIMETABLE_DB_PORT", "5432")}

REST_FRAMEWORK = {
    # Phase D-R4: DualAuthentication now delegates straight to
    # CentralAuthAuthentication (RS256), wrapped as AiCentralAuthUser — the
    # legacy HS256/JWTStatelessUserAuthentication branch is gone. See
    # ai_service/dual_auth.py and docs/PHASE_D_R4R6_REMOVAL_RESULT.md.
    "DEFAULT_AUTHENTICATION_CLASSES": ["ai_service.dual_auth.DualAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
        "ai_service.dual_auth.DualServiceSubscribed",
    ],
}

# Phase C13: central_auth/jwks.py reads settings.AUTH_SERVICE_URL.
AUTH_SERVICE_URL = os.getenv("CENTRAL_AUTH_URL", "http://host.docker.internal:8000")

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=24),
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": os.getenv("REDIS_URL", "redis://redis:6379/5"),
        "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
    }
}


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
