"""
Django settings for auth_service.
"""
import os
from pathlib import Path
import sys

import sys
# Build paths inside the project
BASE_DIR = Path(__file__).resolve().parent.parent

# Add shared directory to path
SHARED_PATHS = [
    Path('/app/shared'),
    BASE_DIR / 'shared',
    BASE_DIR.parent.parent / 'shared',
]

for shared_path in SHARED_PATHS:
    if shared_path.exists():
        sys.path.insert(0, str(shared_path))
        break

from dotenv import load_dotenv
load_dotenv(os.path.join(BASE_DIR, '.env'))

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-change-in-production')
DEBUG = os.getenv('DEBUG', 'True') == 'True'
ALLOWED_HOSTS = ['*']

# Email Configuration
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD')
DEFAULT_FROM_EMAIL = EMAIL_HOST_USER

INSTALLED_APPS = [
    # 'profiles',
    'users',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'django_redis',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'auth_service.urls'

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

WSGI_APPLICATION = 'auth_service.wsgi.application'

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME', 'auth_db'),
        'USER': os.getenv('DB_USER', 'lms_user'),
        'PASSWORD': os.getenv('DB_PASSWORD', 'lms_password'),
        'HOST': os.getenv('DB_HOST', 'postgres-auth'),
        'PORT': os.getenv('DB_PORT', '5432'),
    }
}

AUTH_USER_MODEL = 'users.User'

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
FORCE_SCRIPT_NAME = '/d-auth'
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'common.authentication.JWTAuthentication',
        'rest_framework.authentication.TokenAuthentication',
        # 'rest_framework.authentication.SessionAuthentication', # Disabled to prevent CSRF issues on stateless API
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}

# CORS
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:3004,http://localhost:3005,http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3002,http://127.0.0.1:3003,http://127.0.0.1:3004,http://127.0.0.1:3005,https://lms.iak.ngo,https://ait.iak.ngo,http://lms.iak.ngo,http://ait.iak.ngo,http://10.0.8.141').split(',')
CORS_ALLOW_CREDENTIALS = True

# Redis Cache
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': os.getenv('REDIS_URL', 'redis://redis:6379/1'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}

# JWT Settings
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')

from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=2),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'SIGNING_KEY': JWT_SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

NINJA_JWT = {
    'SIGNING_KEY': JWT_SECRET_KEY,
}

# Production/Development Domains
DOMAIN = os.getenv('LMS_DOMAIN', 'localhost')
PROTOCOL = os.getenv('API_PROTOCOL', 'http')
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3001')

CSRF_TRUSTED_ORIGINS = ["http://10.0.8.141:8000", "http://10.0.8.141",
    f"{PROTOCOL}://{DOMAIN}",
    f"{PROTOCOL}://ait.iak.ngo",
    f"{PROTOCOL}://lms.iak.ngo",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]

# Add additional domains if they exist in env
AIT_DOMAIN = os.getenv('AIT_DOMAIN')
if AIT_DOMAIN:
    CSRF_TRUSTED_ORIGINS.append(f"{PROTOCOL}://{AIT_DOMAIN}")

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Toggles based on DEBUG mode
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'


