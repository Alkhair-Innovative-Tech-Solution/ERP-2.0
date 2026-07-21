"""
Production settings for File Service.
"""
from .base import *

DEBUG = False
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=False, cast=bool)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='').split(',')
LOGGING['loggers']['apps']['level'] = 'INFO'


