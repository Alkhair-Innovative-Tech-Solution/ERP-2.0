import os
from pathlib import Path
import sys

BASE_DIR = Path(__file__).resolve().parent.parent

# Add shared directory to Python path
for shared_path in [Path('/app/shared'), BASE_DIR / 'shared', BASE_DIR.parent.parent / 'shared']:
    if shared_path.exists():
        sys.path.insert(0, str(shared_path))
        break

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-content-service-key')
DEBUG = os.getenv('DEBUG', 'True') == 'True'
ALLOWED_HOSTS = ['*']
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')

INSTALLED_APPS = [
    'content',
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
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    # 🔹 Multi-Tenancy: Extract org_id from request headers
    'common.organization.OrganizationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'content_service.urls'

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

WSGI_APPLICATION = 'content_service.wsgi.application'

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
            'NAME': os.getenv('DB_NAME', 'content_db'),
            'USER': os.getenv('DB_USER', 'lms_user'),
            'PASSWORD': os.getenv('DB_PASSWORD', 'lms_password'),
            'HOST': os.getenv('DB_HOST', 'postgres-content'),
            'PORT': os.getenv('DB_PORT', '5432'),
        }
    }

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

FORCE_SCRIPT_NAME = '/d-content'
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'

CSRF_TRUSTED_ORIGINS = ["http://10.0.8.141:8000", "http://10.0.8.141",
    'https://lms.iak.ngo',
    'https://ait.iak.ngo',
    'http://lms.iak.ngo',
    'http://ait.iak.ngo',
    'http://10.0.8.141',
]
