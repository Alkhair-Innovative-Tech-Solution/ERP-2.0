"""
Django settings for course_service.
"""
import os
from pathlib import Path
import sys

# Build paths inside the project
BASE_DIR = Path(__file__).resolve().parent.parent

# Add shared directory to path - Docker path is /app/shared, local is ../../shared
SHARED_PATHS = [
    Path('/app/shared'),  # Docker path (absolute)
    BASE_DIR / 'shared',  # Docker path (relative)
    BASE_DIR.parent.parent / 'shared',  # Local development path
]

for shared_path in SHARED_PATHS:
    if shared_path.exists():
        sys.path.insert(0, str(shared_path))
        break

from decouple import config

SECRET_KEY = config('SECRET_KEY', default='django-insecure-change-in-production')
JWT_SECRET_KEY = config('JWT_SECRET_KEY')
DEBUG = config('DEBUG', default=True, cast=bool)
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'tests',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'admission_service.middleware.DisableCSRFForAPI',  # Custom middleware to exempt API paths
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    # 🔹 Multi-Tenancy: Extract org_id from request headers
    'common.organization.OrganizationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# Disable CSRF for API endpoints (API Gateway handles auth)
CSRF_EXEMPT_PATHS = [
    '/api/',
    '/health/',
]

ROOT_URLCONF = 'admission_service.urls'

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

WSGI_APPLICATION = 'admission_service.wsgi.application'

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME', 'admission_db'),
        'USER': os.getenv('DB_USER', 'lms_user'),
        'PASSWORD': os.getenv('DB_PASSWORD', 'lms_password'),
        'HOST': os.getenv('DB_HOST', 'postgres-admission'),
        'PORT': os.getenv('DB_PORT', '5432'),
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files
FORCE_SCRIPT_NAME = '/d-admission'
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# JWT Settings
from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=2),  # 2 hours for test
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': JWT_SECRET_KEY,
    'VERIFYING_KEY': None,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
}

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'shared.common.authentication.JWTAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour'
    }
}

# CORS
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000,https://lms.iak.ngo,https://ait.iak.ngo,http://10.0.8.141:3000,http://10.0.8.141').split(',')
CORS_ALLOW_CREDENTIALS = True

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# CSRF Settings for Admin Panel
CSRF_TRUSTED_ORIGINS = ["http://10.0.8.141:8000", "http://10.0.8.141",
    'https://lms.iak.ngo',
    'https://ait.iak.ngo',
    'http://lms.iak.ngo',
    'http://ait.iak.ngo',
    'http://10.0.8.141',
]

# Session and CSRF Cookie Settings
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'

# Service URLs
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:3000')
LMS_SERVICE_URL = config('LMS_SERVICE_URL', default='http://localhost:8001')
AUTH_SERVICE_URL = config('AUTH_SERVICE_URL', default='http://auth-service:8001')
REGISTRATION_SERVICE_URL = config('REGISTRATION_SERVICE_URL', default='http://localhost:8002')
LMS_SERVICE_API_KEY = config('LMS_SERVICE_API_KEY', default='your-secret-key')

# Email Configuration
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default=None)
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default=None)
DEFAULT_FROM_EMAIL = EMAIL_HOST_USER

