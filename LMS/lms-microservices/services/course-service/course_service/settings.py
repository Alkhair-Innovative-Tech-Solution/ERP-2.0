"""
Django settings for course_service.
"""
import os
import sys
if "/app" not in sys.path:
    sys.path.insert(0, "/app")
from pathlib import Path
import sys

# Build paths inside the project
BASE_DIR = Path(__file__).resolve().parent.parent

# Add shared directory to path - Docker path is /app/shared, local is ../../shared
# Add /app to sys.path so 'shared.common' resolves correctly
if '/app' not in sys.path:
    sys.path.insert(0, '/app')
if '/app/shared' not in sys.path:
    sys.path.insert(0, '/app/shared')

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-change-in-production')
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
DEBUG = os.getenv('DEBUG', 'True') == 'True'
ALLOWED_HOSTS = ['*']
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')

INSTALLED_APPS = [
    'courses',
    'batches',
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
    'course_service.middleware.DisableCSRFForAPI',  # Custom middleware to exempt API paths
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    # 🔹 Multi-Tenancy: Extract org_id from request headers
    'common.organization.OrganizationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'ninja.compatibility.files.fix_request_files_middleware',
]

# Disable CSRF for API endpoints (API Gateway handles auth)
CSRF_EXEMPT_PATHS = [
    '/api/',
    '/health/',
]

ROOT_URLCONF = 'course_service.urls'

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

WSGI_APPLICATION = 'course_service.wsgi.application'

# Database
USE_SQLITE = os.getenv('USE_SQLITE', 'False') == 'True'

if USE_SQLITE:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('DB_NAME', 'course_db'),
            'USER': os.getenv('DB_USER', 'lms_user'),
            'PASSWORD': os.getenv('DB_PASSWORD', 'lms_password'),
            'HOST': os.getenv('DB_HOST', 'postgres-course'),
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
FORCE_SCRIPT_NAME = '/d-course'
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'common.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}

# CORS
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# CSRF Settings for Admin Panel
# Production Domains for CSRF
CSRF_TRUSTED_ORIGINS = ["http://10.0.8.141:8000", "http://10.0.8.141",
    'https://lms.iak.ngo',
    'https://ait.iak.ngo',
    'http://lms.iak.ngo',
    'http://ait.iak.ngo',
    'http://10.0.8.141',
]

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'

