"""
Development settings for File Service.
"""
from .base import *

DEBUG = True
ALLOWED_HOSTS = ['*']
LOGGING['loggers']['apps']['level'] = 'DEBUG'


