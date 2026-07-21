"""
Django settings for core project.
"""
from pathlib import Path
import os
import dj_database_url

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-dev-key-change-in-prod')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.environ.get('DEBUG', 'True') == 'True'

# API robustness: Prevent 500 errors on POST requests missing trailing slashes
APPEND_SLASH = True

# JWT Configuration — RS256 asymmetric signing
# jwt_utils.py loads key files from JWT_PRIVATE_KEY_PATH / JWT_PUBLIC_KEY_PATH env vars
# See: docs/jwt-key-management.md
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'RS256')
ACCESS_TOKEN_EXPIRY_HOURS = 1
REFRESH_TOKEN_EXPIRY_DAYS = 7

ALLOWED_HOSTS = [h.strip() for h in os.environ.get('ALLOWED_HOSTS', '*').split(',')]
CORS_ALLOW_ALL_ORIGINS = os.environ.get('CORS_ALLOW_ALL_ORIGINS', 'True') == 'True'
CORS_ALLOWED_ORIGINS = [o.strip() for o in os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',') if o.strip()]
CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',') if o.strip()]

# Proxy awareness
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
# Session cookie configuration for microservices
SESSION_COOKIE_NAME = 'auth_sessionid'
SESSION_COOKIE_PATH = '/'

# Explicitly use prefixed paths to avoid redirect loops
LOGIN_URL = '/auth-admin/login/'
LOGIN_REDIRECT_URL = '/auth-admin/'

# Additional CORS settings
CORS_ALLOW_CREDENTIALS = True
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
CORS_EXPOSE_HEADERS = ['Authorization']

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'ninja',
    'employees',
    'authentication',
    'permissions',
    'audit',
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

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
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

WSGI_APPLICATION = 'core.wsgi.application'

# Database
# Use AUTH_DATABASE_URL or DATABASE_URL from .env
# Fallback to local default if neither are set or if they are empty
default_db_url = (
    os.environ.get('AUTH_DATABASE_URL') or
    os.environ.get('DATABASE_URL') or 
    'postgresql://erp_admin:erp_admin_password_change_me_in_prod@localhost:5432/auth_db'
)
DATABASES = {
    'default': dj_database_url.parse(default_db_url, conn_max_age=600)
}

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': os.getenv('AUTH_REDIS_URL') or os.getenv('REDIS_URL') or 'redis://127.0.0.1:6379/0',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/auth-admin/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Media files (Resume uploads)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# WhiteNoise Configuration
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Email Configuration
# SECURE EMAIL CONFIG (Pulled from .env)
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.environ.get('EMAIL_HOST')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD')
DEFAULT_FROM_EMAIL = f"IAK HR System <{EMAIL_HOST_USER}>"
