"""
Django settings for File Service.
"""
import os
from decouple import config

ENVIRONMENT = config('ENVIRONMENT', default='dev')

if ENVIRONMENT == 'production':
    from .prod import *
elif ENVIRONMENT == 'development':
    from .dev import *
else:
    from .dev import *


