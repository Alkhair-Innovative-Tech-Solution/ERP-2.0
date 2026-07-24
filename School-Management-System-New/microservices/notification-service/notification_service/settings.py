import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.getenv("SECRET_KEY", "notification-service-secret")
DEBUG = os.getenv("DEBUG", "False").lower() == "true"
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "*").split(",")
SERVICE_NAME = "notification-service"

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
    "notifications",
    "users",
    "services",
    "campus",
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

ROOT_URLCONF = "notification_service.urls"
ASGI_APPLICATION = "notification_service.asgi.application"
WSGI_APPLICATION = "notification_service.wsgi.application"

TEMPLATES = [{"BACKEND": "django.template.backends.django.DjangoTemplates",
               "DIRS": [], "APP_DIRS": True,
               "OPTIONS": {"context_processors": [
                   "django.template.context_processors.request",
                   "django.contrib.auth.context_processors.auth",
                   "django.contrib.messages.context_processors.messages"]}}]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "notification_db"),
        "USER": os.getenv("DB_USER", "notification_user"),
        "PASSWORD": os.getenv("DB_PASSWORD", "notification_pass"),
        "HOST": os.getenv("DB_HOST", "postgres-notification"),
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
    ],
}

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": os.getenv("REDIS_URL", "redis://redis:6379/10"),
        "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
    }
}

# WebSocket via Django Channels — always uses Redis in this service
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [os.getenv("REDIS_URL", "redis://redis:6379/10")]},
    }
}

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
STATIC_URL = "/notification-admin/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_TZ = True
INTERNAL_SERVICE_SECRET = os.getenv("INTERNAL_SERVICE_SECRET", "")
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# --- Web Push (VAPID) ---------------------------------------------------------
# Used by notifications/services.py (pywebpush) and the /push/vapid-public-key/
# endpoint.
VAPID_PUBLIC_KEY = os.getenv(
    'VAPID_PUBLIC_KEY',
    'BGcgOu_IhXXZD9kPjYqO3GoVJ0XkJerRvO9Xkx1uqeCAs9QbVGbGo73zkBSSCZPwiFqwE-RKoz-bkXdpz_Ejozo'
)
VAPID_PRIVATE_KEY_PATH = os.getenv('VAPID_PRIVATE_KEY_PATH', str(BASE_DIR / 'vapid_private.pem'))
# Embedded fallback so web push works on any server without copying the (gitignored)
# PEM file. The push code writes this to VAPID_PRIVATE_KEY_PATH if that file is missing.
# For better security set VAPID_PRIVATE_KEY via env instead.
VAPID_PRIVATE_KEY = os.getenv('VAPID_PRIVATE_KEY', """-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgpqV5pyGiFgR7I6N9
qXSRqT2tIQ9+XRbH4fN5O344XvChRANCAARnIDrvyIV12Q/ZD42KjtxqFSdF5CXq
0bzvV5MdbqnggLPUG1RmxqO985AUkgmT8IhasBPkSqM/m5F3ac/xI6M6
-----END PRIVATE KEY-----
""")
VAPID_CLAIM_EMAIL = os.getenv('VAPID_CLAIM_EMAIL', 'no-reply.ait@iak.ngo')

# ── Django admin over the gateway (https://ams.idaraalkhair.sbs/notification-admin/) ──
CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.getenv("CSRF_TRUSTED_ORIGINS", "https://ams.idaraalkhair.sbs").split(",")
    if o.strip()
]
# Per-service cookie names so admin sessions on the shared domain don't clash
SESSION_COOKIE_NAME = "notification_sessionid"
CSRF_COOKIE_NAME = "notification_csrftoken"
