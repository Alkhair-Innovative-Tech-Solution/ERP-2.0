"""
Development settings for Communication Service.
"""
from .base import *

DEBUG = True
ALLOWED_HOSTS = ['*']
LOGGING['loggers']['apps']['level'] = 'DEBUG'

