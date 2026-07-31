"""
Base Django settings for File Service.
"""
import os
import sys
from pathlib import Path
from decouple import config
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Add shared directory to Python path for importing shared code
# Try Docker mount path first, then fallback to relative path
docker_shared_path = Path('/shared')
local_shared_path = BASE_DIR.parent.parent.parent / 'services' / 'shared'
SHARED_PATH = docker_shared_path if docker_shared_path.exists() else local_shared_path
if str(SHARED_PATH) not in sys.path:
    sys.path.append(str(SHARED_PATH))

# Import shared logging configuration
try:
    from logging_config import get_logging_config
except ImportError:
    # Fallback if shared code not available
    def get_logging_config():
        return {
            'version': 1,
            'disable_existing_loggers': False,
            'formatters': {
                'verbose': {
                    'format': '{levelname} {asctime} {module} {message}',
                    'style': '{',
                },
            },
            'handlers': {
                'console': {
                    'class': 'logging.StreamHandler',
                    'formatter': 'verbose',
                },
            },
            'root': {
                'handlers': ['console'],
                'level': 'INFO',
            },
            'loggers': {
                'django': {
                    'handlers': ['console'],
                    'level': 'INFO',
                    'propagate': False,
                },
                'apps': {
                    'handlers': ['console'],
                    'level': 'DEBUG',
                    'propagate': False,
                },
            },
        }

SECRET_KEY = config('SECRET_KEY', default='django-insecure-change-me')
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='*').split(',')

# Proxy awareness
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
CSRF_TRUSTED_ORIGINS = [
    'http://10.0.8.135',
    'http://localhost',
    'http://127.0.0.1',
]

# Session cookie configuration for microservices
SESSION_COOKIE_NAME = 'file_sessionid'
SESSION_COOKIE_PATH = '/'

# Explicitly use prefixed paths to avoid redirect loops
LOGIN_URL = '/file-admin/login/'
LOGIN_REDIRECT_URL = '/file-admin/'

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'ninja',
    # Shared apps
    'users',  # Shared User model
    'departments',  # Referenced by User model
    # Local apps
    'apps.files',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

ROOT_URLCONF = 'core.urls'
WSGI_APPLICATION = 'core.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME', default='hdms_db'),
        'USER': config('DB_USER', default='hdms_user'),
        'PASSWORD': config('DB_PASSWORD', default='hdms_pwd'),
        'HOST': config('DB_HOST', default='pgbouncer'),  # Connect through PgBouncer
        'PORT': config('DB_PORT', default='6432'),  # PgBouncer port
        'CONN_MAX_AGE': 0,
        'OPTIONS': {
            'connect_timeout': int(config('DB_CONNECT_TIMEOUT', default=20))
            # Note: 'options' parameter not supported by PgBouncer in transaction pooling mode
        }
    }
}

# Cache Configuration (Redis)
REDIS_PASSWORD = config('REDIS_PASSWORD', default='')
REDIS_URL = config('REDIS_URL', default=f"redis://:{REDIS_PASSWORD}@erp_redis:6379/1" if REDIS_PASSWORD else "redis://erp_redis:6379/1")

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': REDIS_URL,
    }
}

# Connection error handling is managed by Django ORM, cache framework, and Celery
# Errors will be logged automatically via Django's logging configuration

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/file-admin/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
MEDIA_URL = '/media/'
MEDIA_ROOT = config('MEDIA_ROOT', default=BASE_DIR / 'media')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Use shared User model - users app is in shared apps directory
docker_shared_apps = Path('/shared/apps')
local_shared_apps = (docker_shared_path if docker_shared_path.exists() else local_shared_path) / 'apps'
shared_apps_path = docker_shared_apps if docker_shared_apps.exists() else local_shared_apps

if str(shared_apps_path) not in sys.path:
    sys.path.append(str(shared_apps_path))

AUTH_USER_MODEL = 'users.User'



# Celery Configuration (Redis database 2)
if REDIS_PASSWORD:
    CELERY_BROKER_URL = f"redis://:{REDIS_PASSWORD}@erp_redis:6379/2"
else:
    CELERY_BROKER_URL = "redis://erp_redis:6379/2"
CELERY_RESULT_BACKEND = CELERY_BROKER_URL

def _load_jwt_public_key() -> str:
    """Load RSA public key for JWT verification. Fail fast if misconfigured."""
    import os
    from pathlib import Path
    path = os.getenv('JWT_PUBLIC_KEY_PATH', '')
    if not path:
        raise ValueError("JWT_PUBLIC_KEY_PATH not set — required for RS256 token verification")
    key_path = Path(path)
    if not key_path.exists():
        raise FileNotFoundError(f"JWT public key not found: {key_path}")
    return key_path.read_text()


SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=config('ACCESS_TOKEN_LIFETIME', default=60, cast=int)),
    'REFRESH_TOKEN_LIFETIME': timedelta(minutes=config('REFRESH_TOKEN_LIFETIME', default=1440, cast=int)),
    'ALGORITHM': config('JWT_ALGORITHM', default='RS256'),
    'SIGNING_KEY': None,        # This service never signs tokens
    'VERIFYING_KEY': _load_jwt_public_key(),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

# Service URLs
# Hyphenated hostname — the erp_network alias also supports the underscored
# form, but Django's own HTTP_HOST validation on the auth-service side
# rejects it (RFC 1034/1035 forbids underscores in hostnames), same fix
# ticket-service (2b) and communication-service (2c) needed.
AUTH_SERVICE_URL = config('AUTH_SERVICE_URL', default='http://auth-service:8000')
AUTH_SERVICE_TIMEOUT = config('AUTH_SERVICE_TIMEOUT', default=5, cast=int)
USER_SERVICE_URL = config('USER_SERVICE_URL', default='http://user-service:8001')
TICKET_SERVICE_URL = config('TICKET_SERVICE_URL', default='http://ticket-service:8002')
COMMUNICATION_SERVICE_URL = config('COMMUNICATION_SERVICE_URL', default='http://communication-service:8003')
FILE_SERVICE_URL = config('FILE_SERVICE_URL', default='http://file-service:8005')

# File Upload Settings
MAX_FILE_SIZE = config('MAX_FILE_SIZE', default=524288000, cast=int)  # 500MB
ALLOWED_IMAGE_TYPES = config('ALLOWED_IMAGE_TYPES', default='image/jpeg,image/png,image/gif').split(',')
ALLOWED_DOCUMENT_TYPES = config('ALLOWED_DOCUMENT_TYPES', default='application/pdf,text/plain').split(',')
ALLOWED_VIDEO_TYPES = config('ALLOWED_VIDEO_TYPES', default='video/mp4').split(',')

# Logging - use shared logging configuration
LOGGING = get_logging_config()

# CORS Configuration (for development, allow all origins)
CORS_ALLOW_ALL_ORIGINS = config('CORS_ALLOW_ALL_ORIGINS', default=True, cast=bool)
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS', default='http://localhost:3000,http://127.0.0.1:3000').split(',')
CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]
